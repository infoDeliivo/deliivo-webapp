'use client'

import { useEffect, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Columns3 } from 'lucide-react'
import type { AdminUserListItem } from '@/lib/api'
import { DEFAULT_HIDDEN_COLUMNS } from './usersColumns'
import { isBulkSelectable } from './BulkUserActions'
import { FloatingMenu, useFloatingMenu } from './FloatingMenu'

const VISIBILITY_STORAGE_KEY = 'admin.users.columnVisibility'

// Visibility is a per-admin convenience: storage may be blocked, so every access is guarded.
function readVisibility(): VisibilityState {
  try {
    const raw = window.localStorage.getItem(VISIBILITY_STORAGE_KEY)
    if (!raw) return DEFAULT_HIDDEN_COLUMNS
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
      )
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_HIDDEN_COLUMNS
}

function writeVisibility(state: VisibilityState) {
  try {
    window.localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore: visibility simply resets next visit
  }
}

/**
 * The table instance lives in the page so the column picker can sit outside the table card.
 * Column visibility is owned here and persisted per admin.
 */
export function useUsersReactTable({
  data,
  columns,
  sorting,
  onSortingChange,
  pageCount,
  rowSelection,
  onRowSelectionChange,
}: {
  data: AdminUserListItem[]
  columns: ColumnDef<AdminUserListItem>[]
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  pageCount: number
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
}): Table<AdminUserListItem> {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_HIDDEN_COLUMNS)

  // Read after mount so the server render and first client render match.
  useEffect(() => {
    setColumnVisibility(readVisibility())
  }, [])

  const handleVisibilityChange: OnChangeFn<VisibilityState> = (updater) => {
    setColumnVisibility((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      writeVisibility(next)
      return next
    })
  }

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange,
    onRowSelectionChange,
    enableRowSelection: (row) => isBulkSelectable(row.original),
    onColumnVisibilityChange: handleVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    enableMultiSort: false,
    // First click on a column sorts ascending, matching how admins read names and emails.
    sortDescFirst: false,
  })

  return table
}

export function ColumnPicker({ table }: { table: Table<AdminUserListItem> }) {
  const { open, toggle, close, anchorRef, menuRef } = useFloatingMenu()
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide())

  return (
    <div ref={anchorRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm hover:border-gray-300 transition-colors"
      >
        <Columns3 className="w-3.5 h-3.5" /> Columns
      </button>
      <FloatingMenu
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        menuRef={menuRef}
        align="right"
        className="w-44 py-1"
      >
        <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-gray-400">Show columns</p>
        {hideableColumns.map((column) => (
          <label
            key={column.id}
            className="group flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
              className="peer sr-only"
            />
            {/* Drawn box; the real input stays in the tree for keyboard and screen readers. */}
            <span
              aria-hidden
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-white transition-colors group-hover:border-gray-400 peer-checked:border-[#F97316] peer-checked:bg-[#F97316] peer-focus-visible:ring-2 peer-focus-visible:ring-[#F97316]/40 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {column.columnDef.meta?.label ??
              (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)}
          </label>
        ))}
      </FloatingMenu>
    </div>
  )
}

export function UsersTable({ table }: { table: Table<AdminUserListItem> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] leading-5">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => {
            return (
              <tr key={headerGroup.id} className="bg-gray-100 border-b border-gray-200">
                {headerGroup.headers.map((header, index) => {
                  const edge =
                    header.column.id === 'select'
                      ? 'w-px pl-6 pr-0'
                      : index === 0 || index === headerGroup.headers.length - 1
                        ? 'px-6'
                        : 'px-4'
                  const sorted = header.column.getIsSorted()
                  const content = flexRender(header.column.columnDef.header, header.getContext())
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={`text-left ${edge} py-4 text-[13px] font-semibold text-gray-700 whitespace-nowrap`}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    >
                      {header.column.getCanSort() ? (
                        // The header content is itself a filter button, so sorting gets its own button.
                        <span className="inline-flex items-center gap-1">
                          {content}
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            aria-label={`Sort by ${header.column.columnDef.meta?.label ?? header.column.id}`}
                            className="p-0.5 rounded hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40"
                          >
                            {sorted === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[#F97316]" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-[#F97316]" />
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </button>
                        </span>
                      ) : (
                        content
                      )}
                    </th>
                  )
                })}
              </tr>
            )
          })}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-gray-50 transition-colors ${
                row.getIsSelected() ? 'bg-orange-50/60' : 'hover:bg-gray-50/50'
              }`}
            >
              {row.getVisibleCells().map((cell, index, cells) => (
                <td
                  key={cell.id}
                  className={`${
                    cell.column.id === 'select'
                      ? 'w-px pl-6 pr-0'
                      : index === 0 || index === cells.length - 1
                        ? 'px-6'
                        : 'px-4'
                  } py-3`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
