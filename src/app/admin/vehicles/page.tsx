'use client';

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { adminApi, getApiErrorMessage, type AdminVehicle, type Pagination } from '@/lib/api';
import { showError, showSuccess } from '@/lib/app-feedback';
import LoadFailureCard from '@/components/LoadFailureCard';
import VehicleDocuments from './_components/VehicleDocuments';

// PENDING first and default: a queue should open on the work, not on everything.
const FILTERS = ['PENDING', 'REJECTED', 'APPROVED', 'ALL'] as const;

const statusStyles: Record<string, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED: 'border-green-200 bg-green-50 text-green-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
};

const MAX_REASON = 500;

function waitingFor(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days <= 0) return 'submitted today';
  return `waiting ${days} day${days === 1 ? '' : 's'}`;
}

function describeVehicle(vehicle: AdminVehicle): string {
  const parts = [vehicle.brand, vehicle.model_name, vehicle.year ? String(vehicle.year) : null, vehicle.color];
  const described = parts.filter(Boolean).join(' · ');
  return described || 'No vehicle details supplied';
}

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('PENDING');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  async function loadVehicles() {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listVehicles({ status, page, limit: 20 });
      setVehicles(res.data.vehicles);
      setPagination(res.data.pagination);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to load the vehicle queue');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function approve(vehicleId: string) {
    setActionLoading(`${vehicleId}:APPROVE`);
    try {
      await adminApi.verifyVehicle(vehicleId);
      await loadVehicles();
      showSuccess('Vehicle approved', 'The driver can now publish rides.');
    } catch (err: unknown) {
      showError('Could not approve vehicle', getApiErrorMessage(err, 'Failed to approve vehicle'));
    } finally {
      setActionLoading(null);
    }
  }

  async function reject(vehicleId: string) {
    const reason = rejectReason.trim();
    if (!reason) return;

    setActionLoading(`${vehicleId}:REJECT`);
    try {
      await adminApi.rejectVehicle(vehicleId, reason);
      setRejectingId(null);
      setRejectReason('');
      await loadVehicles();
      showSuccess('Vehicle rejected', 'The driver has been told what to fix.');
    } catch (err: unknown) {
      showError('Could not reject vehicle', getApiErrorMessage(err, 'Failed to reject vehicle'));
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total ?? 0;

  const headline =
    status === 'PENDING'
      ? `${total} vehicle${total === 1 ? '' : 's'} awaiting review`
      : `${total} ${status === 'ALL' ? '' : status.toLowerCase() + ' '}vehicle${total === 1 ? '' : 's'}`;

  if (error && !loading && vehicles.length === 0) {
    return (
      <div className="mx-auto max-w-7xl">
        <LoadFailureCard title="Vehicle queue unavailable" message={error} onRetry={loadVehicles} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Driver onboarding</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Vehicle verification</h1>
          <p className="mt-1 text-sm text-gray-500">
            {headline}. A driver cannot publish a ride until their vehicle is approved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => { setStatus(filter); setPage(1); setExpandedId(null); }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                status === filter
                  ? 'border-[#F97316] bg-orange-50 text-[#F97316]'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {error && vehicles.length > 0 && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <BadgeCheck className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm font-semibold text-gray-700">
              {status === 'PENDING' ? 'No vehicles pending review' : 'Nothing in this view'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {status === 'PENDING'
                ? 'New vehicles appear here as soon as a driver submits one.'
                : 'Try a different status filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {vehicles.map((vehicle) => {
              const isExpanded = expandedId === vehicle.id;
              const isRejecting = rejectingId === vehicle.id;
              const approving = actionLoading === `${vehicle.id}:APPROVE`;
              const rejecting = actionLoading === `${vehicle.id}:REJECT`;
              const canDecide = vehicle.verificationStatus !== 'APPROVED';

              return (
                <article key={vehicle.id} className="px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            statusStyles[vehicle.verificationStatus] || 'border-gray-200 bg-gray-50 text-gray-600'
                          }`}
                        >
                          {vehicle.verificationStatus}
                        </span>
                        <span className="font-mono text-sm font-bold text-gray-900">
                          {vehicle.licenseCountry} {vehicle.licenseNumber}
                        </span>
                        {vehicle.verificationStatus === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" /> {waitingFor(vehicle.createdAt)}
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-gray-700">
                        <Car className="h-4 w-4 text-gray-400" /> {describeVehicle(vehicle)}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">
                          {vehicle.user.firstName || vehicle.user.email || vehicle.user.phone || vehicle.userId}
                        </span>
                        {vehicle.user.email && <span>· {vehicle.user.email}</span>}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${
                            vehicle.user.dlVerified
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                          title="A driver whose licence is unverified is a separate review"
                        >
                          {vehicle.user.dlVerified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                          Licence {vehicle.user.dlVerified ? 'verified' : 'unverified'}
                        </span>
                      </div>

                      {/* Shown on a resubmission so the reviewer sees what was asked last time. */}
                      {vehicle.rejectionReason && (
                        <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                          <span className="font-semibold">Previously rejected:</span> {vehicle.rejectionReason}
                          {vehicle.reviewedAt && (
                            <span className="text-red-500"> · {new Date(vehicle.reviewedAt).toLocaleDateString()}</span>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : vehicle.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-gray-300"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {isExpanded ? 'Hide documents' : `Review documents (${vehicle.documents.length})`}
                      </button>

                      {canDecide && (
                        <>
                          <button
                            type="button"
                            onClick={() => approve(vehicle.id)}
                            disabled={approving || rejecting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F97316] px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(isRejecting ? null : vehicle.id);
                              setRejectReason('');
                            }}
                            disabled={approving || rejecting}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isRejecting && (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
                      <label htmlFor={`reason-${vehicle.id}`} className="text-xs font-semibold text-gray-800">
                        Why is this being rejected? The driver sees this text.
                      </label>
                      <textarea
                        id={`reason-${vehicle.id}`}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value.slice(0, MAX_REASON))}
                        rows={3}
                        maxLength={MAX_REASON}
                        placeholder="e.g. The registry document is too blurry to read the plate."
                        className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
                      />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-gray-500">
                          {rejectReason.length}/{MAX_REASON}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => reject(vehicle.id)}
                            disabled={!rejectReason.trim() || rejecting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Confirm rejection
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3">
                      <VehicleDocuments documents={vehicle.documents} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
