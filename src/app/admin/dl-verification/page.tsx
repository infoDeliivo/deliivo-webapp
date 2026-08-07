'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react'
import {
  adminApi,
  getApiErrorMessage,
  vehicleApi,
  type AdminDlSubmission,
  type Pagination,
} from '@/lib/api'

const PAGE_SIZE = 20

const STATUS_TABS = ['PENDING', 'APPROVED', 'DECLINED', 'SUPERSEDED', 'ALL'] as const
type StatusTab = (typeof STATUS_TABS)[number]

const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-green-50 text-green-700',
  DECLINED: 'bg-red-50 text-red-600',
  IDENTITY_MISMATCH: 'bg-red-50 text-red-600',
  RESUBMISSION_REQUESTED: 'bg-blue-50 text-blue-600',
  EXPIRED: 'bg-gray-100 text-gray-500',
  // Closed out because Veriff approved the driver first — nothing left to decide.
  SUPERSEDED: 'bg-gray-100 text-gray-500',
}

type PreviewState = { url?: string; error?: string; loading: boolean }

const fullName = (user: AdminDlSubmission['user']) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Unnamed'

export default function AdminDlVerificationPage() {
  const [submissions, setSubmissions] = useState<AdminDlSubmission[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [status, setStatus] = useState<StatusTab>('PENDING')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Signed URLs are fetched per submission and never cached: each admin read of a
  // private KYC document is audit-logged server-side, and the signature expires in
  // ~5 minutes anyway.
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({})
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)
  const [declining, setDeclining] = useState<AdminDlSubmission | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.listDlSubmissions({ status, page, limit: PAGE_SIZE })
      setSubmissions(res.data.submissions)
      setPagination(res.data.pagination)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load licence submissions'))
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => {
    void load()
  }, [load])

  const sign = useCallback(async (previewKey: string) => {
    setPreviews((current) => ({ ...current, [previewKey]: { loading: true } }))
    try {
      // Admins are permitted cross-owner reads on this endpoint.
      const res = await vehicleApi.getDocumentReadUrl(previewKey)
      setPreviews((current) => ({
        ...current,
        [previewKey]: { loading: false, url: res.data.url },
      }))
    } catch (err: unknown) {
      setPreviews((current) => ({
        ...current,
        [previewKey]: { loading: false, error: getApiErrorMessage(err, 'Preview unavailable') },
      }))
    }
  }, [])

  useEffect(() => {
    // One failed key must not blank the list, so each is signed independently.
    submissions.forEach((s) => {
      if (s.previewKey && !previews[s.previewKey]) void sign(s.previewKey)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions])

  async function handleApprove(submission: AdminDlSubmission) {
    setActionLoading(submission.userId)
    setError('')
    try {
      await adminApi.approveDlSubmission(submission.userId)
      await load()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to approve the licence'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDecline() {
    if (!declining || !declineReason.trim()) return
    setActionLoading(declining.userId)
    setError('')
    try {
      await adminApi.declineDlSubmission(declining.userId, declineReason.trim())
      setDeclining(null)
      setDeclineReason('')
      await load()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to decline the licence'))
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = pagination?.totalPages || 1

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Driving Licence Verification</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {pagination?.total ?? 0} submission{(pagination?.total ?? 0) === 1 ? '' : 's'} · read the
          licence photo, then approve or decline with a reason
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-4 shadow-sm">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setStatus(tab)
              setPage(1)
            }}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
              status === tab
                ? 'border-[#F97316] bg-orange-50 text-[#F97316]'
                : 'border-gray-200 bg-white text-gray-600 hover:border-[#F97316] hover:text-[#F97316]'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl bg-white py-16 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="rounded-2xl bg-white py-12 text-center text-sm text-gray-400 shadow-sm">
          Nothing to review here.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {submissions.map((submission) => {
            const preview = submission.previewKey ? previews[submission.previewKey] : undefined
            const label = `${fullName(submission.user)} — driving licence`
            const busy = actionLoading === submission.userId

            return (
              <div
                key={submission.id}
                className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm sm:flex-row"
              >
                {/* Licence photo */}
                <div className="flex h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 sm:w-56">
                  {preview?.url ? (
                    <button
                      type="button"
                      onClick={() => setLightbox({ url: preview.url as string, label })}
                      className="h-full w-full"
                      title="Open full size"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview.url} alt={label} className="h-40 w-full object-cover" />
                    </button>
                  ) : preview?.loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => submission.previewKey && sign(submission.previewKey)}
                      className="flex flex-col items-center gap-1 px-2 text-center text-[11px] text-gray-500 hover:text-[#F97316]"
                    >
                      <FileWarning className="h-4 w-4" />
                      <span>{preview?.error || 'Preview unavailable'}</span>
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <RotateCcw className="h-3 w-3" /> Retry
                      </span>
                    </button>
                  )}
                </div>

                {/* Driver + decision */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{fullName(submission.user)}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        statusStyle[submission.status] || 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {submission.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-500 sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-gray-400">Email</dt>
                      <dd className="truncate text-gray-700">{submission.user.email || '—'}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-gray-400">Phone</dt>
                      <dd className="text-gray-700">{submission.user.phone || '—'}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-gray-400">Date of birth</dt>
                      <dd className="text-gray-700">
                        {submission.user.dob
                          ? new Date(submission.user.dob).toLocaleDateString('en-GB')
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-gray-400">Submitted</dt>
                      <dd className="text-gray-700">
                        {new Date(submission.updatedAt).toLocaleString('en-GB')}
                      </dd>
                    </div>
                  </dl>

                  {submission.declineReason && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                      Declined: {submission.declineReason}
                    </p>
                  )}

                  {/* A superseded submission was closed out by a Veriff approval. The
                      backend refuses a decision on it with a 409, so the buttons are
                      hidden rather than offered and then rejected. */}
                  {submission.status === 'SUPERSEDED' ? (
                    <p className="mt-auto pt-2 text-xs text-gray-400">
                      Closed — this driver verified through Veriff.
                    </p>
                  ) : (
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleApprove(submission)}
                        className="rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea6a0c] disabled:opacity-50"
                      >
                        {busy ? 'Processing…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setDeclining(submission)
                          setDeclineReason('')
                        }}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                      >
                        Decline…
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl bg-white px-6 py-3 shadow-sm">
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Decline reason — the text is shown to the driver verbatim, so it is required. */}
      {declining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Decline licence</h2>
                <p className="mt-0.5 text-xs text-gray-500">{fullName(declining.user)}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeclining(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label htmlFor="decline-reason" className="text-xs font-medium text-gray-600">
              Reason — shown to the driver
            </label>
            <textarea
              id="decline-reason"
              rows={4}
              maxLength={500}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. The photo is blurred — please re-upload a clear image of the front of your licence."
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/30 focus:outline-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeclining(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!declineReason.trim() || actionLoading === declining.userId}
                onClick={handleDecline}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === declining.userId ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-h-full max-w-4xl overflow-auto rounded-xl bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-gray-900">{lightbox.label}</p>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={lightbox.label} className="max-h-[75vh] w-auto" />
          </div>
        </div>
      )}
    </div>
  )
}
