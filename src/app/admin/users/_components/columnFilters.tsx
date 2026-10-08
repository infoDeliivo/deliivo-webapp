'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import type {
  AdminPayoutState,
  AdminUserCountry,
  AdminUserListItem,
  AdminUserStatusFilter,
  AdminVehicleState,
} from '@/lib/api'
import { FloatingMenu, useFloatingMenu } from './FloatingMenu'

/** Filters set from the column headers. `any` / empty string means the column is not filtered. */
export interface UserColumnFilters {
  name: string
  email: string
  phone: string
  /** A locale code, `none` (never detected) or `any`. */
  language: string
  /** ISO 3166-1 alpha-2 code or `any`. */
  country: string
  status: AdminUserStatusFilter
  pending: 'any' | 'awaiting'
  dl: 'any' | 'verified' | 'not_verified'
  vehicle: 'any' | AdminVehicleState
  payout: 'any' | AdminPayoutState
  joined: 'any' | JoinedPreset
}

export type JoinedPreset = '7d' | '30d' | '90d' | '365d'

export const DEFAULT_COLUMN_FILTERS: UserColumnFilters = {
  name: '',
  email: '',
  phone: '',
  language: 'any',
  country: 'any',
  status: 'active',
  pending: 'any',
  dl: 'any',
  vehicle: 'any',
  payout: 'any',
  joined: 'any',
}

type TextFilterKey = 'name' | 'email' | 'phone'
type SelectFilterKey = Exclude<keyof UserColumnFilters, TextFilterKey>

export type FilterChange = <K extends keyof UserColumnFilters>(key: K, value: UserColumnFilters[K]) => void

export interface UserRowActions {
  onToggleBan: (user: AdminUserListItem) => void
  onArchive: (user: AdminUserListItem) => void
  onRestore: (user: AdminUserListItem) => void
  /** Id of the user whose ban/unban request is in flight. */
  busyUserId: string | null
}

interface UsersTableContextValue {
  filters: UserColumnFilters
  setFilter: FilterChange
  countries: AdminUserCountry[]
  actions: UserRowActions
}

// Headers and cells read live state from context so the column definitions stay static:
// rebuilding them on every filter change would remount the headers and close an open
// search box while the admin is typing.
const UsersTableContext = createContext<UsersTableContextValue | null>(null)

export const UsersTableProvider = UsersTableContext.Provider

export function useUsersTable(): UsersTableContextValue {
  const value = useContext(UsersTableContext)
  if (!value) throw new Error('useUsersTable must be used inside UsersTableProvider')
  return value
}

const DAY_MS = 24 * 60 * 60 * 1000
const PRESET_DAYS: Record<JoinedPreset, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }

/** Start of the UTC day `preset` ago — stable for the whole day, so the query key does not churn. */
export function joinedFromForPreset(preset: JoinedPreset): string {
  const start = new Date(Date.now() - PRESET_DAYS[preset] * DAY_MS)
  start.setUTCHours(0, 0, 0, 0)
  return start.toISOString()
}

export type FilterOption<V extends string> = { value: V; label: string }

function HeaderTrigger({
  label,
  active,
  open,
  onClick,
  icon: Icon,
}: {
  label: string
  active: boolean
  open: boolean
  onClick: () => void
  icon: typeof Search
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={`inline-flex items-center gap-2 rounded-md -mx-1.5 px-1.5 py-1 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 ${
        active ? 'text-[#F97316]' : 'hover:text-gray-900'
      }`}
    >
      {label}
      <Icon strokeWidth={2.5} className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#F97316]' : 'text-gray-600'}`} />
      {active && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />}
    </button>
  )
}

/** Single-choice filter menu in a column header. */
export function HeaderSelectFilter<K extends SelectFilterKey>({
  column,
  label,
  options,
}: {
  column: K
  label: string
  options: ReadonlyArray<FilterOption<UserColumnFilters[K] & string>>
}) {
  const { filters, setFilter } = useUsersTable()
  const { open, toggle, close, anchorRef, menuRef } = useFloatingMenu()
  const value = filters[column]
  const active = value !== DEFAULT_COLUMN_FILTERS[column]

  return (
    <div ref={anchorRef} className="inline-block">
      <HeaderTrigger label={label} active={active} open={open} onClick={toggle} icon={ChevronDown} />
      <FloatingMenu open={open} onClose={close} anchorRef={anchorRef} menuRef={menuRef} className="w-48 py-1 max-h-72 overflow-y-auto">
        <div role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => { setFilter(column, option.value); close() }}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 text-left"
            >
              {option.label}
              {option.value === value && <Check className="w-3 h-3 shrink-0 text-[#F97316]" />}
            </button>
          ))}
        </div>
      </FloatingMenu>
    </div>
  )
}

const TEXT_DEBOUNCE_MS = 400

/**
 * Mounted only while the menu is open, so the draft always starts from the applied value.
 * Typing applies after a pause; Enter applies at once; closing applies whatever is pending.
 */
function TextFilterBody({
  initial,
  placeholder,
  onApply,
  onDone,
}: {
  initial: string
  placeholder: string
  onApply: (value: string) => void
  onDone: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const applied = useRef(initial)
  const latest = useRef({ draft, onApply })

  useEffect(() => {
    latest.current = { draft, onApply }
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = draft.trim()
      if (next !== applied.current) {
        applied.current = next
        onApply(next)
      }
    }, TEXT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, onApply])

  useEffect(
    () => () => {
      const next = latest.current.draft.trim()
      if (next !== applied.current) latest.current.onApply(next)
    },
    [],
  )

  return (
    <div className="p-2 flex items-center gap-1.5">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
        <input
          type="search"
          autoFocus
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onDone() }}
          className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316]"
        />
      </div>
      {draft && (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => setDraft('')}
          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

/** Free-text search in a column header. */
export function HeaderTextFilter({ column, label, placeholder }: { column: TextFilterKey; label: string; placeholder: string }) {
  const { filters, setFilter } = useUsersTable()
  const { open, toggle, close, anchorRef, menuRef } = useFloatingMenu()
  const value = filters[column]
  const [apply] = useState(() => (next: string) => setFilter(column, next))

  return (
    <div ref={anchorRef} className="inline-block">
      <HeaderTrigger label={label} active={value !== ''} open={open} onClick={toggle} icon={Search} />
      <FloatingMenu open={open} onClose={close} anchorRef={anchorRef} menuRef={menuRef} className="w-60">
        <TextFilterBody initial={value} placeholder={placeholder} onApply={apply} onDone={close} />
      </FloatingMenu>
    </div>
  )
}
