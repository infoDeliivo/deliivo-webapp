'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import type { AdminUserListItem } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api'
import { showError, showSuccess } from '@/lib/app-feedback'
import type { AdminUsersParams } from '../_hooks/useAdminUsers'
import { exportColumnsFor, fetchAllUsers, writeUsersFile, type ExportFormat } from '../_lib/exportUsers'
import { FloatingMenu, useFloatingMenu } from './FloatingMenu'

const FORMATS: ReadonlyArray<{ format: ExportFormat; label: string; hint: string; icon: typeof FileText }> = [
  { format: 'csv', label: 'CSV', hint: 'Any spreadsheet or tool', icon: FileText },
  { format: 'xlsx', label: 'Excel', hint: '.xlsx workbook', icon: FileSpreadsheet },
]

/**
 * Exports what the admin is looking at: the selected rows when there is a selection,
 * otherwise every user matching the current filters and sort, with the visible columns.
 */
export function ExportMenu({
  params,
  total,
  selectedUsers,
  columnIds,
}: {
  params: Omit<AdminUsersParams, 'page' | 'limit'>
  total: number
  selectedUsers: AdminUserListItem[]
  columnIds: string[]
}) {
  const { open, toggle, close, anchorRef, menuRef } = useFloatingMenu()
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const busy = progress !== null
  const count = selectedUsers.length || total
  const scope = selectedUsers.length ? `${selectedUsers.length} selected` : `${total} matching`

  async function run(format: ExportFormat) {
    close()
    const columns = exportColumnsFor(columnIds)
    setProgress({ loaded: 0, total: count })
    try {
      const users = selectedUsers.length
        ? selectedUsers
        : await fetchAllUsers(params, (loaded, all) => setProgress({ loaded, total: all }))
      await writeUsersFile(users, columns, format)
      showSuccess('Export ready', `${users.length} ${users.length === 1 ? 'user' : 'users'} exported`)
    } catch (err) {
      showError('Could not export users', getApiErrorMessage(err, 'Export failed'))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div ref={anchorRef}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy || count === 0}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm hover:border-gray-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {busy ? `Exporting ${progress.loaded}/${progress.total}` : 'Export'}
      </button>
      <FloatingMenu
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        menuRef={menuRef}
        align="right"
        className="w-56 py-1"
      >
        <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-gray-400">Export {scope} users</p>
        {FORMATS.map(({ format, label, hint, icon: Icon }) => (
          <button
            key={format}
            type="button"
            onClick={() => run(format)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50"
          >
            <Icon className="w-4 h-4 text-gray-400 shrink-0" />
            <span>
              <span className="block text-[13px] text-gray-800">{label}</span>
              <span className="block text-[11px] text-gray-400">{hint}</span>
            </span>
          </button>
        ))}
      </FloatingMenu>
    </div>
  )
}
