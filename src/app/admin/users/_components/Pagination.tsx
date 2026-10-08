'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

type PageItem = number | 'gap-start' | 'gap-end'

/** First, last, and a window of one page around the current one, with gaps collapsed. */
export function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const start = Math.max(2, Math.min(current - 1, total - 4))
  const end = Math.min(total - 1, Math.max(current + 1, 5))
  const items: PageItem[] = [1]
  if (start > 2) items.push('gap-start')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < total - 1) items.push('gap-end')
  items.push(total)
  return items
}

const navButton =
  'h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40'

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: PageSize
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Users pagination"
      className="px-6 py-3 border-t border-gray-100 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <p>
          Showing{' '}
          <span className="font-medium text-gray-800">
            {first}–{last}
          </span>{' '}
          of <span className="font-medium text-gray-800">{total}</span>
        </p>
        <label className="inline-flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="py-1 pl-2 pr-6 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316]"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className={`${navButton} text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </li>
          {pageItems(page, totalPages).map((item) =>
            typeof item === 'number' ? (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={`${navButton} ${
                    item === page ? 'bg-[#F97316] text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item}
                </button>
              </li>
            ) : (
              <li
                key={item}
                aria-hidden
                className="h-8 min-w-6 inline-flex items-center justify-center text-xs text-gray-400"
              >
                …
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
              className={`${navButton} text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </li>
        </ul>
      )}
    </nav>
  )
}
