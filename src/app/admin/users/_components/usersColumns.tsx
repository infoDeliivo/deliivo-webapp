'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef, RowData } from '@tanstack/react-table'
import { Archive, Check, ChevronDown, Eye, Minus, RotateCcw, User as UserIcon } from 'lucide-react'
import type {
  AdminDlState,
  AdminPayoutState,
  AdminUserListItem,
  AdminUserSortField,
  AdminVehicleState,
} from '@/lib/api'
import { countryLabel, countryName } from '@/lib/country'
import { FloatingMenu, useFloatingMenu } from './FloatingMenu'
import {
  HeaderSelectFilter,
  HeaderTextFilter,
  useUsersTable,
  type FilterOption,
  type UserColumnFilters,
} from './columnFilters'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Plain-text name for the column picker when the header renders a component. */
    label?: string
  }
}

/** Columns the API can sort by, keyed by column id. */
export const SORTABLE_COLUMNS: Record<string, AdminUserSortField> = {
  user: 'firstName',
  email: 'email',
  joined: 'createdAt',
}

const pill = 'text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap'
const Dash = ({ title }: { title?: string }) => (
  <span className="text-gray-300" title={title}>
    —
  </span>
)

const statusStyle = {
  active: 'bg-green-50 text-green-700',
  banned: 'bg-red-50 text-red-500',
  archived: 'bg-gray-200 text-gray-600',
}

// Detected from the site the user signed up on — never asked for, so it can be absent.
export const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  et: 'Eesti',
  lv: 'Latviešu',
  lt: 'Lietuvių',
  ru: 'Русский',
}

export const DL_BADGE: Record<AdminDlState, { label: string; className: string }> = {
  NONE: { label: 'Not started', className: 'bg-gray-100 text-gray-500' },
  PENDING: { label: 'Pending', className: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Verified', className: 'bg-green-50 text-green-700' },
  DECLINED: { label: 'Declined', className: 'bg-red-50 text-red-600' },
  RESUBMISSION_REQUESTED: { label: 'Resubmit', className: 'bg-amber-50 text-amber-700' },
  EXPIRED: { label: 'Expired', className: 'bg-red-50 text-red-600' },
  IDENTITY_MISMATCH: { label: 'ID mismatch', className: 'bg-red-50 text-red-600' },
}

export const VEHICLE_BADGE: Record<AdminVehicleState, { label: string; className: string }> = {
  NONE: { label: 'None', className: 'bg-gray-100 text-gray-500' },
  PENDING: { label: 'Pending', className: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Approved', className: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-600' },
}

export const PAYOUT_BADGE: Record<AdminPayoutState, { label: string; className: string }> = {
  NOT_STARTED: { label: 'Not set up', className: 'bg-gray-100 text-gray-500' },
  INCOMPLETE: { label: 'Incomplete', className: 'bg-amber-50 text-amber-700' },
  READY: { label: 'Ready', className: 'bg-green-50 text-green-700' },
}

export const PENDING_LINKS = {
  DL_REVIEW: { label: 'DL review', href: '/admin/dl-verification' },
  VEHICLE_REVIEW: { label: 'Vehicle review', href: '/admin/vehicles?status=PENDING' },
} as const

/** Profile picture when the user has one; initials when not, or when the image fails to load. */
function UserAvatar({ src, initials }: { src: string | null; initials: string }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote S3 URL, not in next/image remotePatterns
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded-full object-cover shrink-0 bg-gray-100"
      />
    )
  }
  if (!initials) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
        <UserIcon className="w-4 h-4" />
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  )
}

export function fullName(u: AdminUserListItem) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
}

const PENDING_FILTER_OPTIONS: ReadonlyArray<FilterOption<UserColumnFilters['pending']>> = [
  { value: 'any', label: 'All' },
  { value: 'awaiting', label: 'Awaiting review' },
]

const DL_FILTER_OPTIONS: ReadonlyArray<FilterOption<UserColumnFilters['dl']>> = [
  { value: 'any', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'not_verified', label: 'Not verified' },
]

const VEHICLE_FILTER_OPTIONS: ReadonlyArray<FilterOption<UserColumnFilters['vehicle']>> = [
  { value: 'any', label: 'All' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'NONE', label: 'No vehicle' },
]

const PAYOUT_FILTER_OPTIONS: ReadonlyArray<FilterOption<UserColumnFilters['payout']>> = [
  { value: 'any', label: 'All' },
  { value: 'READY', label: 'Ready' },
  { value: 'INCOMPLETE', label: 'Incomplete' },
  { value: 'NOT_STARTED', label: 'Not set up' },
]

const STATUS_FILTER_OPTIONS: ReadonlyArray<FilterOption<UserColumnFilters['status']>> = [
  { value: 'active', label: 'Active' },
  { value: 'banned', label: 'Banned' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

const LANGUAGE_FILTER_OPTIONS: ReadonlyArray<FilterOption<string>> = [
  { value: 'any', label: 'All' },
  ...Object.entries(LOCALE_LABELS).map(([value, label]) => ({ value, label })),
  { value: 'none', label: 'Not detected' },
]

const JOINED_FILTER_OPTIONS: ReadonlyArray<FilterOption<UserColumnFilters['joined']>> = [
  { value: 'any', label: 'Any time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last 12 months' },
]

/** Options come from the countries that actually have users in the current status. */
function CountryHeader() {
  const { countries, filters } = useUsersTable()
  const options: FilterOption<string>[] = [
    { value: 'any', label: 'All countries' },
    // Keep a selected country listed even if it has no users in this status.
    ...(filters.country !== 'any' && !countries.some((c) => c.code === filters.country)
      ? [{ value: filters.country, label: countryName(filters.country) }]
      : []),
    ...countries.map((c) => ({ value: c.code, label: `${countryName(c.code)} · ${c.count}` })),
  ]
  return <HeaderSelectFilter column="country" label="Country" options={options} />
}

function ActionsCell({ user }: { user: AdminUserListItem }) {
  const { actions } = useUsersTable()
  const { open, toggle, close, anchorRef, menuRef } = useFloatingMenu()
  const busy = actions.busyUserId === user.id

  return (
    <div ref={anchorRef} className="inline-block">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-300 transition-colors"
      >
        Actions <ChevronDown className="w-3 h-3" />
      </button>
      <FloatingMenu
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        menuRef={menuRef}
        align="right"
        className="w-40 overflow-hidden text-left"
      >
          <Link href={`/admin/users/${user.id}`} className="block px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50">
            <span className="inline-flex items-center gap-1.5"><Eye className="h-3 w-3" /> View details</span>
          </Link>
          {user.archivedAt ? (
            <button
              type="button"
              className="w-full text-left px-4 py-2.5 text-xs text-green-700 hover:bg-green-50"
              onClick={() => { actions.onRestore(user); close() }}
            >
              <span className="inline-flex items-center gap-1.5"><RotateCcw className="h-3 w-3" /> Restore user</span>
            </button>
          ) : user.role !== 'ADMIN' && (
            <>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-xs text-yellow-600 hover:bg-yellow-50 disabled:opacity-50"
                disabled={busy}
                onClick={() => { actions.onToggleBan(user); close() }}
              >
                {busy ? 'Processing...' : user.isBanned ? 'Unban user' : 'Ban user'}
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50"
                onClick={() => { actions.onArchive(user); close() }}
              >
                <span className="inline-flex items-center gap-1.5"><Archive className="h-3 w-3" /> Archive user</span>
              </button>
            </>
          )}
      </FloatingMenu>
    </div>
  )
}

function SelectCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  label,
  title,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  onChange: (event: unknown) => void
  label: string
  title?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  const on = checked || indeterminate
  const Mark = indeterminate ? Minus : Check
  // Native input kept for keyboard and screen readers; the box and tick are drawn over it.
  return (
    <span className="relative inline-flex h-4 w-4 align-middle" title={title}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className={`peer h-4 w-4 cursor-pointer appearance-none rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 ${
          on ? 'border-[#F97316] bg-[#F97316]' : 'border-gray-300 bg-white hover:border-[#F97316]'
        }`}
      />
      {on && (
        <Mark
          aria-hidden
          strokeWidth={3.5}
          className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white"
        />
      )}
    </span>
  )
}

const LEAF_COLUMNS: ColumnDef<AdminUserListItem>[] = ([
    {
      id: 'select',
      meta: { label: 'Select' },
      enableHiding: false,
      // Selects the rows on this page only; admins and archived users cannot be selected.
      header: ({ table }) => (
        <SelectCheckbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          disabled={!table.getRowModel().rows.some((row) => row.getCanSelect())}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          label="Select all users on this page"
        />
      ),
      cell: ({ row }) => (
        <SelectCheckbox
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          label={`Select ${fullName(row.original) || 'user'}`}
          title={row.getCanSelect() ? undefined : 'Admins and archived users cannot be selected'}
        />
      ),
    },
    {
      id: 'user',
      meta: { label: 'Name' },
      header: () => <HeaderTextFilter column="name" label="Name" placeholder="Search name…" />,
      enableHiding: false,
      cell: ({ row: { original: u } }) => {
        const name = fullName(u)
        const initials = name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase()
        return (
          <Link
            href={`/admin/users/${u.id}`}
            className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/30"
            aria-label={name || 'User without a name'}
          >
            <UserAvatar src={u.avatarUrl} initials={initials} />
            {name ? (
              <span className="whitespace-nowrap font-medium text-gray-900 capitalize transition-colors group-hover:text-[#F97316]">
                {name}
              </span>
            ) : (
              // Same empty marker as every other column; email and phone have their own columns.
              <Dash title="Name not set" />
            )}
          </Link>
        )
      },
    },
    {
      id: 'email',
      meta: { label: 'Email' },
      header: () => <HeaderTextFilter column="email" label="Email" placeholder="Search email…" />,
      cell: ({ row: { original: u } }) => <span className="text-gray-600">{u.email || '—'}</span>,
    },
    {
      id: 'phone',
      meta: { label: 'Phone' },
      header: () => <HeaderTextFilter column="phone" label="Phone" placeholder="Search phone…" />,
      cell: ({ row: { original: u } }) => <span className="text-gray-600 whitespace-nowrap tabular-nums">{u.phone || '—'}</span>,
    },
    {
      id: 'language',
      meta: { label: 'Language' },
      header: () => <HeaderSelectFilter column="language" label="Language" options={LANGUAGE_FILTER_OPTIONS} />,
      cell: ({ row: { original: u } }) => {
        const label = u.preferredLocale ? LOCALE_LABELS[u.preferredLocale] || u.preferredLocale.toUpperCase() : null
        return label ? <span className={`${pill} bg-gray-100 text-gray-600`}>{label}</span> : <Dash title="Not detected at signup" />
      },
    },
    {
      id: 'country',
      meta: { label: 'Country' },
      header: () => <CountryHeader />,
      cell: ({ row: { original: u } }) =>
        u.detectedCountry ? (
          <span className="text-gray-600 whitespace-nowrap">{countryLabel(u.detectedCountry)}</span>
        ) : (
          <Dash title="Not detected" />
        ),
    },
    {
      id: 'status',
      meta: { label: 'Status' },
      header: () => <HeaderSelectFilter column="status" label="Status" options={STATUS_FILTER_OPTIONS} />,
      cell: ({ row: { original: u } }) => {
        const key = u.archivedAt ? 'archived' : u.isBanned ? 'banned' : 'active'
        return <span className={`${pill} ${statusStyle[key]}`}>{key[0].toUpperCase() + key.slice(1)}</span>
      },
    },
    {
      id: 'pending',
      meta: { label: 'Pending' },
      header: () => (
        <HeaderSelectFilter column="pending" label="Pending" options={PENDING_FILTER_OPTIONS} />
      ),
      cell: ({ row: { original: u } }) => {
        const items = u.verification.pending
        if (items.length === 0) return <Dash title="Nothing awaiting review" />
        return (
          <div className="flex flex-wrap gap-1">
            {items.map((item) => {
              const link = PENDING_LINKS[item.kind]
              return (
                <Link key={item.kind} href={link.href} className={`${pill} bg-orange-50 text-[#F97316] hover:bg-orange-100`}>
                  {link.label}
                  {item.count > 1 ? ` (${item.count})` : ''}
                </Link>
              )
            })}
          </div>
        )
      },
    },
    {
      id: 'dl',
      meta: { label: 'DL' },
      header: () => (
        <HeaderSelectFilter column="dl" label="DL" options={DL_FILTER_OPTIONS} />
      ),
      cell: ({ row: { original: u } }) => {
        const badge = DL_BADGE[u.verification.dl]
        return <span className={`${pill} ${badge.className}`}>{badge.label}</span>
      },
    },
    {
      id: 'vehicle',
      meta: { label: 'Vehicle' },
      header: () => (
        <HeaderSelectFilter column="vehicle" label="Vehicle" options={VEHICLE_FILTER_OPTIONS} />
      ),
      cell: ({ row: { original: u } }) => {
        const { state, pending, approved, rejected } = u.verification.vehicle
        const badge = VEHICLE_BADGE[state]
        const total = pending + approved + rejected
        return (
          <span
            className={`${pill} ${badge.className}`}
            title={total > 1 ? `${approved} approved · ${pending} pending · ${rejected} rejected` : undefined}
          >
            {badge.label}
            {total > 1 ? ` · ${total}` : ''}
          </span>
        )
      },
    },
    {
      id: 'payout',
      meta: { label: 'Payout' },
      header: () => (
        <HeaderSelectFilter column="payout" label="Payout" options={PAYOUT_FILTER_OPTIONS} />
      ),
      cell: ({ row: { original: u } }) => {
        const { state, mismatch } = u.verification.payout
        const badge = PAYOUT_BADGE[state]
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className={`${pill} ${badge.className}`}>{badge.label}</span>
            {mismatch && (
              <span
                className="w-2 h-2 rounded-full bg-red-500"
                title="Stripe name or date of birth does not match the profile"
                aria-label="Stripe identity mismatch"
              />
            )}
          </span>
        )
      },
    },
    {
      id: 'joined',
      meta: { label: 'Joined' },
      header: () => <HeaderSelectFilter column="joined" label="Joined" options={JOINED_FILTER_OPTIONS} />,
      cell: ({ row: { original: u } }) => (
        <span className="text-gray-600 whitespace-nowrap tabular-nums">
          {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="block text-right">Actions</span>,
      enableHiding: false,
      cell: ({ row: { original: u } }) => (
        <div className="text-right">
          <ActionsCell user={u} />
        </div>
      ),
    },
] satisfies ColumnDef<AdminUserListItem>[]).map((column) => ({ ...column, enableSorting: column.id in SORTABLE_COLUMNS }))

const leaves = (...ids: string[]) =>
  ids.map((id) => {
    const column = LEAF_COLUMNS.find((c) => c.id === id)
    if (!column) throw new Error(`Unknown users column: ${id}`)
    return column
  })

export const USER_COLUMNS: ColumnDef<AdminUserListItem>[] = leaves(
  'select',
  'user',
  'email',
  'phone',
  'language',
  'country',
  'status',
  'pending',
  'dl',
  'vehicle',
  'payout',
  'joined',
  'actions',
)

/** Option labels per select filter, for describing active filters outside the table. */
export const SELECT_FILTER_OPTIONS = {
  pending: PENDING_FILTER_OPTIONS,
  dl: DL_FILTER_OPTIONS,
  vehicle: VEHICLE_FILTER_OPTIONS,
  payout: PAYOUT_FILTER_OPTIONS,
  status: STATUS_FILTER_OPTIONS,
  language: LANGUAGE_FILTER_OPTIONS,
  joined: JOINED_FILTER_OPTIONS,
} as const

/** Every column starts visible; admins hide what they do not need from the Columns menu. */
export const DEFAULT_HIDDEN_COLUMNS = {}

const FILTER_NAMES: Record<keyof UserColumnFilters, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  language: 'Language',
  country: 'Country',
  status: 'Status',
  pending: 'Pending',
  dl: 'DL',
  vehicle: 'Vehicle',
  payout: 'Payout',
  joined: 'Joined',
}

export interface ActiveFilter {
  key: keyof UserColumnFilters
  label: string
}

/** One readable entry per filter that differs from its default, in column order. */
export function describeActiveFilters(filters: UserColumnFilters, defaults: UserColumnFilters): ActiveFilter[] {
  return (Object.keys(FILTER_NAMES) as Array<keyof UserColumnFilters>)
    .filter((key) => filters[key] !== defaults[key])
    .map((key) => {
      const value = filters[key]
      let valueLabel: string
      if (key === 'name' || key === 'email' || key === 'phone') valueLabel = `“${value}”`
      else if (key === 'country') valueLabel = countryName(value)
      else {
        const options: ReadonlyArray<FilterOption<string>> = SELECT_FILTER_OPTIONS[key]
        valueLabel = options.find((option) => option.value === value)?.label ?? value
      }
      return { key, label: `${FILTER_NAMES[key]}: ${valueLabel}` }
    })
}
