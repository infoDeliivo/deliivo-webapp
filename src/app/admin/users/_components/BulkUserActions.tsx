'use client'

import { useState } from 'react'
import { Archive, Ban, Loader2, ShieldCheck, X } from 'lucide-react'
import { adminApi, getApiErrorMessage, type AdminUserListItem } from '@/lib/api'
import { showError, showSuccess } from '@/lib/app-feedback'
import { DialogFrame, cancelButtonClass, inputClass } from './UserArchiveDialogs'

// Bulk actions call the same per-user endpoints as the row menu, a few at a time, so one
// failing user does not stop the rest and the backend is not flooded.

export type BulkAction = 'ban' | 'unban' | 'archive'

const BULK_CONCURRENCY = 4

/** Rows a bulk action may touch: admins and archived users are never selectable. */
export function isBulkSelectable(u: AdminUserListItem): boolean {
  return u.role !== 'ADMIN' && !u.archivedAt
}

/** The users an action applies to: ban skips the already banned, unban the not banned. */
export function bulkTargets(action: BulkAction, users: AdminUserListItem[]): AdminUserListItem[] {
  if (action === 'ban') return users.filter((u) => !u.isBanned)
  if (action === 'unban') return users.filter((u) => u.isBanned)
  return users
}

/** Runs `fn` for every item with at most `limit` in flight; returns the items that failed. */
export async function runLimited<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<unknown>,
): Promise<{ item: T; error: unknown }[]> {
  const failed: { item: T; error: unknown }[] = []
  let next = 0
  async function worker() {
    while (next < items.length) {
      const item = items[next++]
      try {
        await fn(item)
      } catch (error) {
        failed.push({ item, error })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return failed
}

const plural = (n: number) => `${n} ${n === 1 ? 'user' : 'users'}`

export function BulkActionBar({
  selected,
  onAction,
  onClear,
}: {
  selected: AdminUserListItem[]
  onAction: (action: BulkAction) => void
  onClear: () => void
}) {
  const toBan = bulkTargets('ban', selected).length
  const toUnban = bulkTargets('unban', selected).length
  const button =
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors'

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-2 border-b border-orange-100 bg-orange-50 px-6 py-2.5"
    >
      <span className="text-xs font-semibold text-[#C2410C] tabular-nums">{selected.length} selected</span>
      <span className="mx-1 h-4 w-px bg-orange-200" aria-hidden />
      {toBan > 0 && (
        <button
          type="button"
          onClick={() => onAction('ban')}
          className={`${button} border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50`}
        >
          <Ban className="h-3 w-3" /> Ban {toBan}
        </button>
      )}
      {toUnban > 0 && (
        <button
          type="button"
          onClick={() => onAction('unban')}
          className={`${button} border-green-200 bg-white text-green-700 hover:bg-green-50`}
        >
          <ShieldCheck className="h-3 w-3" /> Unban {toUnban}
        </button>
      )}
      <button
        type="button"
        onClick={() => onAction('archive')}
        className={`${button} border-amber-200 bg-white text-amber-700 hover:bg-amber-50`}
      >
        <Archive className="h-3 w-3" /> Archive {selected.length}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
      >
        <X className="h-3 w-3" /> Clear selection
      </button>
    </div>
  )
}

const COPY: Record<
  BulkAction,
  { title: string; verb: string; busy: string; done: string; failed: string; tone: string; note: string }
> = {
  ban: {
    title: 'Ban users',
    verb: 'Ban',
    busy: 'Banning…',
    done: 'banned',
    failed: 'Failed to ban user',
    tone: 'bg-yellow-600 hover:bg-yellow-700',
    note: 'Banned users can no longer log in. You can unban them later.',
  },
  unban: {
    title: 'Unban users',
    verb: 'Unban',
    busy: 'Unbanning…',
    done: 'unbanned',
    failed: 'Failed to unban user',
    tone: 'bg-green-600 hover:bg-green-700',
    note: 'These users can log in again.',
  },
  archive: {
    title: 'Archive users',
    verb: 'Archive',
    busy: 'Archiving…',
    done: 'archived',
    failed: 'Failed to archive user',
    tone: 'bg-amber-600 hover:bg-amber-700',
    note:
      'The users are signed out and can no longer log in. Their upcoming rides and bookings are cancelled with a full refund. Their data is kept, so you can restore them from the Archived tab. Cancelled bookings do not come back on restore.',
  },
}

export function BulkActionDialog({
  action,
  users,
  onClose,
  onDone,
}: {
  action: BulkAction
  users: AdminUserListItem[]
  onClose: () => void
  /** Called after the run with the ids that failed, so they can stay selected. */
  onDone: (failedIds: string[]) => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const copy = COPY[action]
  const targets = bulkTargets(action, users)

  async function submit() {
    setBusy(true)
    const trimmed = reason.trim() || undefined
    const failed = await runLimited(targets, BULK_CONCURRENCY, (u) =>
      action === 'ban'
        ? adminApi.banUser(u.id)
        : action === 'unban'
          ? adminApi.unbanUser(u.id)
          : adminApi.archiveUser(u.id, { reason: trimmed }),
    )
    setBusy(false)
    const ok = targets.length - failed.length
    if (ok > 0) showSuccess(`${plural(ok)} ${copy.done}`)
    if (failed.length > 0) {
      showError(
        `${plural(failed.length)} not ${copy.done}`,
        getApiErrorMessage(failed[0].error, copy.failed),
      )
    }
    onDone(failed.map((f) => f.item.id))
  }

  return (
    <DialogFrame title={copy.title} subtitle={`${plural(targets.length)} selected`} onClose={busy ? () => {} : onClose}>
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">{copy.note}</div>

      <ul className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50 text-xs text-gray-700">
        {targets.map((u) => (
          <li key={u.id} className="flex justify-between gap-3 px-3 py-1.5">
            <span className="truncate font-medium">
              {[u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'Unnamed user'}
            </span>
            <span className="truncate text-gray-400">{u.email ?? u.phone ?? ''}</span>
          </li>
        ))}
      </ul>

      {action === 'archive' && (
        <>
          <label htmlFor="bulk-archive-reason" className="mt-4 block text-xs font-medium text-gray-600">
            Reason (optional, for admins only, applied to every user)
          </label>
          <textarea
            id="bulk-archive-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Test accounts on production"
            className={inputClass}
          />
        </>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className={cancelButtonClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || targets.length === 0}
          onClick={submit}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${copy.tone}`}
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          {busy ? copy.busy : `${copy.verb} ${plural(targets.length)}`}
        </button>
      </div>
    </DialogFrame>
  )
}
