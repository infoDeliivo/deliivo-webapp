import { adminApi, type AdminUserListItem } from '@/lib/api'
import { countryLabel } from '@/lib/country'
import type { AdminUsersParams } from '../_hooks/useAdminUsers'
import {
  DL_BADGE,
  LOCALE_LABELS,
  PAYOUT_BADGE,
  PENDING_LINKS,
  VEHICLE_BADGE,
  fullName,
} from '../_components/usersColumns'

/**
 * The users export is built entirely in the browser: rows come from the same paged list
 * API the table uses, and the file is generated client-side, so the server does no extra
 * work beyond serving list pages.
 */

export type ExportFormat = 'csv' | 'xlsx'

/** Largest page the list API allows. */
const FETCH_PAGE_SIZE = 100

/** Guards the browser against an accidental export of the entire user base. */
export const MAX_EXPORT_ROWS = 10_000

interface ExportColumn {
  header: string
  value: (u: AdminUserListItem) => string
  /** Approximate width in characters for the Excel sheet. */
  width: number
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })

/** Same wording as the table cells, so the file reads like the screen. */
const EXPORT_COLUMNS: Record<string, ExportColumn> = {
  user: { header: 'Name', value: (u) => fullName(u), width: 24 },
  email: { header: 'Email', value: (u) => u.email ?? '', width: 30 },
  phone: { header: 'Phone', value: (u) => u.phone ?? '', width: 16 },
  language: {
    header: 'Language',
    value: (u) => (u.preferredLocale ? LOCALE_LABELS[u.preferredLocale] ?? u.preferredLocale.toUpperCase() : ''),
    width: 12,
  },
  country: { header: 'Country', value: (u) => (u.detectedCountry ? countryLabel(u.detectedCountry) : ''), width: 18 },
  status: {
    header: 'Status',
    value: (u) => (u.archivedAt ? 'Archived' : u.isBanned ? 'Banned' : 'Active'),
    width: 10,
  },
  pending: {
    header: 'Pending',
    value: (u) =>
      u.verification.pending
        .map((item) => `${PENDING_LINKS[item.kind].label}${item.count > 1 ? ` (${item.count})` : ''}`)
        .join(', '),
    width: 22,
  },
  dl: { header: 'DL', value: (u) => DL_BADGE[u.verification.dl].label, width: 12 },
  vehicle: { header: 'Vehicle', value: (u) => VEHICLE_BADGE[u.verification.vehicle.state].label, width: 12 },
  payout: {
    header: 'Payout',
    value: (u) =>
      `${PAYOUT_BADGE[u.verification.payout.state].label}${u.verification.payout.mismatch ? ' (identity mismatch)' : ''}`,
    width: 16,
  },
  joined: { header: 'Joined', value: (u) => dateFormatter.format(new Date(u.createdAt)), width: 12 },
}

/** Keeps the table's column order; drops ids with no export form (select, actions). */
export function exportColumnsFor(columnIds: string[]): ExportColumn[] {
  return columnIds.flatMap((id) => (EXPORT_COLUMNS[id] ? [EXPORT_COLUMNS[id]] : []))
}

/** Pages through the list API with the table's filters and sort. */
export async function fetchAllUsers(
  params: Omit<AdminUsersParams, 'page' | 'limit'>,
  onProgress?: (loaded: number, total: number) => void,
): Promise<AdminUserListItem[]> {
  const users: AdminUserListItem[] = []
  let page = 1
  let totalPages = 1
  do {
    const { data } = await adminApi.getUsers({ ...params, page, limit: FETCH_PAGE_SIZE })
    if (data.pagination.total > MAX_EXPORT_ROWS) {
      throw new Error(
        `${data.pagination.total} users match these filters. Narrow them to ${MAX_EXPORT_ROWS.toLocaleString()} or fewer to export.`,
      )
    }
    users.push(...data.users)
    totalPages = data.pagination.totalPages
    onProgress?.(users.length, data.pagination.total)
    page += 1
  } while (page <= totalPages)
  return users
}

/**
 * Spreadsheet apps run cells that start with = + - @ as formulas. Prefix those with a quote,
 * except phone-style numbers ("+3725…"), which are plain data.
 */
export function neutralizeFormula(value: string): string {
  if (/^[=@\t\r]/.test(value)) return `'${value}`
  if (/^[+-]/.test(value) && !/^[+-][\d\s()-]+$/.test(value)) return `'${value}`
  return value
}

function csvCell(value: string): string {
  const safe = neutralizeFormula(value)
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(users: AdminUserListItem[], columns: ExportColumn[]): string {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(','),
    ...users.map((u) => columns.map((c) => csvCell(c.value(u))).join(',')),
  ]
  // BOM so Excel opens UTF-8 names (Lietuvių, Русский) correctly.
  return `﻿${lines.join('\r\n')}\r\n`
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function exportFileName(format: ExportFormat, now = new Date()): string {
  return `users-${dateFormatter.format(now)}.${format}`
}

export async function writeUsersFile(users: AdminUserListItem[], columns: ExportColumn[], format: ExportFormat) {
  const fileName = exportFileName(format)
  if (format === 'csv') {
    downloadBlob(new Blob([toCsv(users, columns)], { type: 'text/csv;charset=utf-8' }), fileName)
    return
  }
  // Loaded on demand so the Excel writer is not in the page bundle until someone exports.
  const { default: writeXlsxFile } = await import('write-excel-file')
  await writeXlsxFile(
    [
      columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const })),
      // Cells are typed as strings, so Excel never evaluates them as formulas.
      ...users.map((u) => columns.map((c) => ({ value: c.value(u), type: String }))),
    ],
    { fileName, columns: columns.map((c) => ({ width: c.width })), stickyRowsCount: 1, sheet: 'Users' },
  )
}
