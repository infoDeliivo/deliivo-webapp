'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Archive, Loader2, RotateCcw, Trash2, X } from 'lucide-react'
import { adminApi, getApiErrorMessage } from '@/lib/api'
import { showError, showSuccess } from '@/lib/app-feedback'

// Archive is the reversible way to remove a user: the account is locked and hidden but its data
// is kept, so Restore brings it straight back. Permanent deletion (purge) is only offered from the
// archive.

export type ArchiveDialogUser = {
  id: string
  name: string
  phone: string | null
  email: string | null
}

function DialogFrame({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const cancelButtonClass =
  'rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50'
const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/30 focus:outline-none'

export function ArchiveUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: ArchiveDialogUser
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await adminApi.archiveUser(user.id, { reason: reason.trim() || undefined })
      showSuccess('User archived', `${user.name} can be restored from the Archived tab.`)
      onDone()
    } catch (err) {
      showError('Could not archive user', getApiErrorMessage(err, 'Failed to archive user'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogFrame title="Archive user" subtitle={user.name} onClose={onClose}>
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        The user is signed out and can no longer log in. Their upcoming rides and bookings are cancelled
        with a full refund. Their data is kept, so you can restore the account later. Cancelled
        bookings do not come back on restore.
      </div>

      <label htmlFor="archive-reason" className="mt-4 block text-xs font-medium text-gray-600">
        Reason (optional, for admins only)
      </label>
      <textarea
        id="archive-reason"
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Test account on production"
        className={inputClass}
      />

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={cancelButtonClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
          {busy ? 'Archiving…' : 'Archive'}
        </button>
      </div>
    </DialogFrame>
  )
}

export function RestoreUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: ArchiveDialogUser
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await adminApi.restoreUser(user.id)
      showSuccess('User restored', `${user.name} can log in again.`)
      onDone()
    } catch (err) {
      showError('Could not restore user', getApiErrorMessage(err, 'Failed to restore user'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogFrame title="Restore user" subtitle={user.name} onClose={onClose}>
      <p className="text-xs text-gray-600">
        The account becomes active again and the user can log in. Rides and bookings cancelled when it
        was archived stay cancelled. A ban that was in place before archiving stays in place.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={cancelButtonClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          {busy ? 'Restoring…' : 'Restore'}
        </button>
      </div>
    </DialogFrame>
  )
}

export function PurgeUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: ArchiveDialogUser
  onClose: () => void
  onDone: () => void
}) {
  const [confirmIdentifier, setConfirmIdentifier] = useState('')
  const [busy, setBusy] = useState(false)

  // The account is confirmed by its phone, or its email when it has no phone (the backend applies
  // the same rule).
  const confirmLabel = user.phone ? "the user's phone number" : "the user's email"
  const expected = user.phone ?? user.email ?? ''

  async function submit() {
    setBusy(true)
    try {
      await adminApi.purgeUser(user.id, { confirmIdentifier: confirmIdentifier.trim() })
      showSuccess('User permanently deleted', `${user.name} and their data have been removed.`)
      onDone()
    } catch (err) {
      showError('Could not delete user', getApiErrorMessage(err, 'Failed to permanently delete user'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogFrame title="Delete permanently" subtitle={user.name} onClose={onClose}>
      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
        This removes the account and its rides, bookings and payment records. It cannot be undone.
        Only an audit record of the deletion is kept.
      </div>

      <label htmlFor="purge-confirm" className="mt-4 block text-xs font-medium text-gray-600">
        Type {confirmLabel} to confirm
        {expected && <span className="ml-1 font-mono text-gray-400">({expected})</span>}
      </label>
      <input
        id="purge-confirm"
        value={confirmIdentifier}
        onChange={(e) => setConfirmIdentifier(e.target.value)}
        className={inputClass}
      />

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={cancelButtonClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !confirmIdentifier.trim()}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          {busy ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
    </DialogFrame>
  )
}
