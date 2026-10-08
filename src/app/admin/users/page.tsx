'use client'

import { useCallback, useMemo, useState } from 'react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { Loader2, AlertCircle, X } from 'lucide-react'
import { AdminUserListItem, AdminUserStatusFilter } from '@/lib/api'
import { ArchiveDialogUser, ArchiveUserDialog, RestoreUserDialog } from './_components/UserArchiveDialogs'
import { BulkAction, BulkActionBar, BulkActionDialog } from './_components/BulkUserActions'
import { ColumnPicker, UsersTable, useUsersReactTable } from './_components/UsersTable'
import { SORTABLE_COLUMNS, USER_COLUMNS, describeActiveFilters } from './_components/usersColumns'
import { PageSize, Pagination } from './_components/Pagination'
import { ExportMenu } from './_components/ExportMenu'
import {
  DEFAULT_COLUMN_FILTERS,
  FilterChange,
  UserColumnFilters,
  UsersTableProvider,
  joinedFromForPreset,
} from './_components/columnFilters'
import {
  useAdminUserCountries,
  useAdminUsers,
  useBanUserMutation,
  useInvalidateAdminUsers,
  type AdminUsersParams,
} from './_hooks/useAdminUsers'

// Active is the default status so archived (reversibly removed) users stay out of the way.
const STATUS_LABELS: Record<AdminUserStatusFilter, string> = {
  active: 'active',
  banned: 'banned',
  archived: 'archived',
  all: '',
}

function toDialogUser(u: AdminUserListItem): ArchiveDialogUser {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || 'Unnamed user'
  return { id: u.id, name, phone: u.phone, email: u.email }
}

// Driving licences are reviewed in /admin/dl-verification, where the admin can see
// the uploaded document and record a reason. The DL column here is read-only status:
// verifying from this page wrote a separate no-document record, which then blocked
// the review queue for that driver.

export default function AdminUsersPage() {
  const [columnFilters, setColumnFilters] = useState<UserColumnFilters>(DEFAULT_COLUMN_FILTERS)
  const [sorting, setSorting] = useState<SortingState>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(10)
  const [archiving, setArchiving] = useState<ArchiveDialogUser | null>(null)
  const [restoring, setRestoring] = useState<ArchiveDialogUser | null>(null)
  // Selection survives paging, so an admin can pick users across pages. It is cleared when
  // filters or sort change, because those change which users the selection was made from.
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  // Last-seen row for each selected user, so users picked on other pages stay actionable.
  const [selectedCache, setSelectedCache] = useState<Record<string, AdminUserListItem>>({})
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)

  const setFilter = useCallback<FilterChange>((key, value) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
    setRowSelection({})
  }, [])

  const f = columnFilters
  const statusFilter = f.status
  const sort = sorting[0]
  // Shared by the table query and the export, so a file always matches the screen.
  const listParams = {
    status: f.status,
    name: f.name || undefined,
    email: f.email || undefined,
    phone: f.phone || undefined,
    language: f.language === 'any' ? undefined : f.language,
    country: f.country === 'any' ? undefined : f.country,
    joinedFrom: f.joined === 'any' ? undefined : joinedFromForPreset(f.joined),
    dlVerified: f.dl === 'any' ? undefined : f.dl === 'verified',
    pending: f.pending === 'awaiting' || undefined,
    vehicleState: f.vehicle === 'any' ? undefined : f.vehicle,
    payoutState: f.payout === 'any' ? undefined : f.payout,
    sortBy: sort ? SORTABLE_COLUMNS[sort.id] : undefined,
    sortDir: sort ? (sort.desc ? 'desc' : 'asc') : undefined,
  } satisfies Omit<AdminUsersParams, 'page' | 'limit'>
  const usersQuery = useAdminUsers({ ...listParams, page, limit: pageSize })
  const countries = useAdminUserCountries(statusFilter).data ?? []
  const banMutation = useBanUserMutation()
  const invalidateUsers = useInvalidateAdminUsers()

  const users = usersQuery.data?.users ?? []
  const pagination = usersQuery.data?.pagination
  const totalPages = pagination?.totalPages || 1
  const error = usersQuery.error ? usersQuery.error.message || 'Failed to load users' : ''

  const busyUserId = banMutation.isPending ? (banMutation.variables?.userId ?? null) : null
  const tableContext = useMemo(
    () => ({
      filters: columnFilters,
      setFilter,
      countries,
      actions: {
        busyUserId,
        onToggleBan: (u: AdminUserListItem) => banMutation.mutate({ userId: u.id, ban: !u.isBanned }),
        onArchive: (u: AdminUserListItem) => setArchiving(toDialogUser(u)),
        onRestore: (u: AdminUserListItem) => setRestoring(toDialogUser(u)),
      },
    }),
    // banMutation.mutate is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnFilters, setFilter, countries, busyUserId],
  )
  const table = useUsersReactTable({
    data: users,
    columns: USER_COLUMNS,
    sorting,
    onSortingChange: (updater) => {
      setSorting(updater)
      setPage(1)
      setRowSelection({})
    },
    pageCount: totalPages,
    rowSelection,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater
      setRowSelection(next)
      setSelectedCache((prev) => {
        const cache: Record<string, AdminUserListItem> = {}
        for (const id of Object.keys(next)) if (next[id] && prev[id]) cache[id] = prev[id]
        for (const u of users) if (next[u.id]) cache[u.id] = u
        return cache
      })
    },
  })
  // Rows on the current page are fresh; rows from other pages come from the cache.
  const selectedUsers = Object.keys(rowSelection)
    .filter((id) => rowSelection[id])
    .flatMap((id) => {
      const user = users.find((u) => u.id === id) ?? selectedCache[id]
      return user ? [user] : []
    })

  const activeFilters = describeActiveFilters(columnFilters, DEFAULT_COLUMN_FILTERS)
  const clearAllFilters = () => {
    setColumnFilters(DEFAULT_COLUMN_FILTERS)
    setPage(1)
    setRowSelection({})
  }

  // Users that failed stay selected so the admin can retry them.
  function afterBulkAction(failedIds: string[]) {
    setBulkAction(null)
    setRowSelection(Object.fromEntries(failedIds.map((id) => [id, true])))
    invalidateUsers()
  }

  // Archive and restore move the user to another tab, so the list is refetched rather than patched.
  function afterArchiveChange() {
    setArchiving(null)
    setRestoring(null)
    invalidateUsers()
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Users Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {usersQuery.isPending ? (
                'Loading users…'
              ) : (
                <>
                  <span className="font-semibold text-gray-800 tabular-nums">{pagination?.total ?? 0}</span>{' '}
                  {STATUS_LABELS[statusFilter] ? `${STATUS_LABELS[statusFilter]} ` : ''}
                  {pagination?.total === 1 ? 'user' : 'users'}
                  {activeFilters.length > 0 ? ' match your filters' : ''}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportMenu
              params={listParams}
              total={pagination?.total ?? 0}
              selectedUsers={selectedUsers}
              columnIds={table.getVisibleLeafColumns().map((column) => column.id)}
            />
            <ColumnPicker table={table} />
          </div>
        </div>

        {activeFilters.length > 0 && (
          <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <li key={filter.key}>
                <button
                  type="button"
                  onClick={() => setFilter(filter.key, DEFAULT_COLUMN_FILTERS[filter.key])}
                  aria-label={`Remove filter ${filter.label}`}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 py-1 pl-3 pr-2 text-xs font-medium text-[#C2410C] hover:border-[#F97316] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40"
                >
                  {filter.label}
                  <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
              >
                Clear all
              </button>
            </li>
          </ul>
        )}
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {usersQuery.isPending ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
          </div>
        ) : (
          <div className={usersQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            {selectedUsers.length > 0 && (
              <BulkActionBar selected={selectedUsers} onAction={setBulkAction} onClear={() => setRowSelection({})} />
            )}
            <UsersTableProvider value={tableContext}>
              <UsersTable table={table} />
            </UsersTableProvider>

            {users.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-sm font-medium text-gray-700">No users match these filters</p>
                {activeFilters.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-2 text-xs font-medium text-[#F97316] hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {users.length > 0 && pagination && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={pagination.total}
                totalPages={totalPages}
                onPageChange={(next) => {
                  setPage(Math.min(Math.max(1, next), totalPages))
                }}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            )}
          </div>
        )}
      </div>

      {archiving && (
        <ArchiveUserDialog user={archiving} onClose={() => setArchiving(null)} onDone={afterArchiveChange} />
      )}
      {bulkAction && (
        <BulkActionDialog
          action={bulkAction}
          users={selectedUsers}
          onClose={() => setBulkAction(null)}
          onDone={afterBulkAction}
        />
      )}
      {restoring && (
        <RestoreUserDialog user={restoring} onClose={() => setRestoring(null)} onDone={afterArchiveChange} />
      )}
    </div>
  )
}
