'use client';

import { useEffect, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  BadgeCheck,
  CalendarDays,
  Car,
  Clipboard,
  CreditCard,
  Euro,
  FileText,
  IdCard,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  ShieldAlert,
  User,
} from 'lucide-react';
import {
  adminApi,
  AdminUserBooking,
  AdminUserDetails,
  AdminUserPublishedRide,
  AdminVehicle,
  getApiErrorMessage,
  vehicleApi,
} from '@/lib/api';
import { showError, showSuccess } from '@/lib/app-feedback';

function shortId(id: string) {
  return id.slice(0, 8);
}

function fullName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || 'Unnamed user';
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function formatMoney(amount?: number | null, currency = 'EUR') {
  return `${currency} ${(amount || 0).toFixed(2)}`;
}

function routeName(origin?: string | null, destination?: string | null) {
  return `${(origin || 'Origin').split(',')[0]} to ${(destination || 'Destination').split(',')[0]}`;
}

const salutationLabels: Record<string, string> = {
  MR: 'Mr.',
  MS: 'Ms.',
  MRS: 'Mrs.',
  MX: 'Mx.',
  OTHER: 'Other',
};

const genderLabels: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  NON_BINARY: 'Non-binary',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

function formatProfileEnum(value?: string | null, labels: Record<string, string> = {}) {
  if (!value) return '-';
  return labels[value] || value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard?.writeText(value);
    showSuccess(`${label} copied`, value);
  } catch {
    showError('Copy failed', `Could not copy ${label.toLowerCase()}.`);
  }
}

export default function AdminUserDetailsPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [documentLoading, setDocumentLoading] = useState<string | null>(null);

  useEffect(() => {
    loadDetails();
  }, [userId]);

  async function loadDetails() {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getUserDetails(userId);
      setDetails(res.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load user details'));
    } finally {
      setLoading(false);
    }
  }

  async function toggleBan() {
    if (!details || details.user.role === 'ADMIN') return;
    const nextBanned = !details.user.isBanned;
    setActionLoading(true);
    try {
      if (nextBanned) await adminApi.banUser(details.user.id);
      else await adminApi.unbanUser(details.user.id);
      setDetails((prev) => prev ? { ...prev, user: { ...prev.user, isBanned: nextBanned } } : prev);
      showSuccess(nextBanned ? 'User banned' : 'User unbanned', fullName(details.user));
    } catch (err: unknown) {
      showError('Action failed', getApiErrorMessage(err, 'Could not update ban status'));
    } finally {
      setActionLoading(false);
    }
  }

  async function openPrivateDocument(key: string, label: string) {
    setDocumentLoading(key);
    try {
      const res = await vehicleApi.getDocumentReadUrl(key);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      showError('Document unavailable', getApiErrorMessage(err, `Could not open ${label.toLowerCase()}`));
    } finally {
      setDocumentLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#F97316]">
          <ArrowLeft className="h-4 w-4" /> Users
        </Link>
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <p className="text-sm text-red-600">{error || 'User not found'}</p>
        </div>
      </div>
    );
  }

  const { user, summary } = details;
  const initials = fullName(user).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/admin/users" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#F97316]">
            <ArrowLeft className="h-4 w-4" /> Back to users
          </Link>
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#F97316]">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-black text-white">{initials}</div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{fullName(user)}</h1>
                <StatusBadge tone={user.isBanned ? 'danger' : 'good'}>{user.isBanned ? 'Banned' : 'Active'}</StatusBadge>
                <StatusBadge tone={user.role === 'ADMIN' ? 'info' : 'neutral'}>{user.role}</StatusBadge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" />{user.email || '-'}</span>
                <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" />{user.phone || '-'}</span>
                <button type="button" onClick={() => copyText(user.id, 'User ID')} className="inline-flex items-center gap-1.5 font-mono text-xs hover:text-[#F97316]">
                  {shortId(user.id)} <Clipboard className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Joined {formatDate(user.createdAt, true)} · Updated {formatDate(user.updatedAt, true)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadDetails} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:text-[#F97316]">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          {user.role !== 'ADMIN' && (
            <button
              onClick={toggleBan}
              disabled={actionLoading}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50 ${user.isBanned ? 'border border-gray-200 bg-white text-gray-600 hover:text-[#F97316]' : 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100'}`}
            >
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              {user.isBanned ? 'Unban user' : 'Ban user'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Euro} label="Total rider payments" value={formatMoney(summary.payments.totalPaid)} hint={`${summary.payments.paymentCount} payments · ${formatMoney(summary.payments.totalRefunded)} refunded`} />
        <Metric icon={Euro} label="Driver earnings" value={formatMoney(summary.earnings.totalEarned)} hint={`${summary.earnings.earningPaymentCount} earning payments`} />
        <Metric icon={CreditCard} label="Payout eligible" value={formatMoney(summary.earnings.payoutEligible)} hint={`${summary.earnings.payoutEligibleCount} pending payments · ${formatMoney(summary.earnings.paidOut)} paid out`} />
        <Metric icon={ShieldAlert} label="Open disputes" value={String(summary.openDisputes)} hint={`${summary.reportsReceived} reports received · ${summary.blocksReceived} blocks received`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.35fr]">
        <div className="flex flex-col gap-5">
          <Section title="Profile Data" icon={User}>
            <InfoGrid
              items={[
                ['First name', user.firstName || '-'],
                ['Last name', user.lastName || '-'],
                ['Salutation', formatProfileEnum(user.salutation, salutationLabels)],
                ['Gender', formatProfileEnum(user.gender, genderLabels)],
                ['DOB', formatDate(user.dob)],
                ['Onboarding', user.onboardingStatus],
                ['Email verified', user.emailVerified ? 'Yes' : 'No'],
                ['Phone verified', user.phoneVerified ? 'Yes' : 'No'],
                ['Account verified', user.isVerified ? 'Yes' : 'No'],
                ['DL verified', user.dlVerified ? 'Yes' : 'No'],
                ['TOS accepted', user.tosAcceptedAt ? `${formatDate(user.tosAcceptedAt)} (${user.tosVersion || 'version -'})` : '-'],
                ['Privacy accepted', user.privacyAcceptedAt ? `${formatDate(user.privacyAcceptedAt)} (${user.privacyVersion || 'version -'})` : '-'],
              ]}
            />
          </Section>

          <Section title="Payment & Stripe" icon={CreditCard}>
            <InfoGrid
              items={[
                ['Stripe account', user.stripeAccountId || '-'],
                ['Onboarding complete', user.stripeOnboardingComplete ? 'Yes' : 'No'],
                ['Stripe name', user.stripeAccountName || '-'],
                ['Name match', user.stripeNameMatch === null ? '-' : user.stripeNameMatch ? 'Yes' : 'No'],
                ['DOB match', user.stripeDobMatch === null ? '-' : user.stripeDobMatch ? 'Yes' : 'No'],
                ['Cards on file', String(details.paymentMethods.length)],
              ]}
            />
            {details.paymentMethods.length > 0 && (
              <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
                {details.paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-medium text-gray-800">{method.brand || 'Card'} {method.last4 ? `•••• ${method.last4}` : ''}</span>
                    <span className="text-xs text-gray-400">{method.isDefault ? 'Default' : method.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Verification" icon={IdCard}>
            {details.dlVerifications.length === 0 ? (
              <EmptyLine>No driving licence submissions.</EmptyLine>
            ) : (
              <div className="divide-y divide-gray-100">
                {details.dlVerifications.map((record) => (
                  <div key={record.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{record.status.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-400">{formatDate(record.createdAt, true)}</p>
                      </div>
                      {record.previewKey && (
                        <button
                          onClick={() => openPrivateDocument(record.previewKey!, 'licence document')}
                          disabled={documentLoading === record.previewKey}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-50"
                        >
                          {documentLoading === record.previewKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          Licence
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Name {record.nameMatch === null ? '-' : record.nameMatch ? 'match' : 'mismatch'} · DOB {record.dobMatch === null ? '-' : record.dobMatch ? 'match' : 'mismatch'} · Gender {record.genderMatch === null ? '-' : record.genderMatch ? 'match' : 'mismatch'}
                    </p>
                    {record.declineReason && <p className="mt-1 text-xs text-red-500">{record.declineReason}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Vehicles" icon={Car}>
            {details.vehicles.length === 0 ? (
              <EmptyLine>No active vehicles.</EmptyLine>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {details.vehicles.map((vehicle) => (
                  <VehiclePanel key={vehicle.id} vehicle={vehicle} onOpenDocument={openPrivateDocument} documentLoading={documentLoading} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Activity Summary" icon={CalendarDays}>
            <div className="grid gap-3 sm:grid-cols-4">
              <MiniStat label="Rides published" value={String(summary.publishedRideCount)} hint={`${summary.completedPublishedRideCount} completed`} />
              <MiniStat label="Rides booked" value={String(summary.bookingCount)} hint={`${summary.completedBookingCount} completed`} />
              <MiniStat label="Reports" value={`${summary.reportsMade}/${summary.reportsReceived}`} hint="made / received" />
              <MiniStat label="Blocks" value={`${summary.blocksMade}/${summary.blocksReceived}`} hint="made / received" />
            </div>
          </Section>

          <Section title="Published Rides" icon={Car}>
            <RideList rides={details.publishedRides} />
          </Section>

          <Section title="Bookings" icon={BadgeCheck}>
            <BookingList bookings={details.bookedRides} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: 'good' | 'danger' | 'info' | 'neutral' }) {
  const classes = {
    good: 'bg-green-50 text-green-700',
    danger: 'bg-red-50 text-red-600',
    info: 'bg-blue-50 text-blue-700',
    neutral: 'bg-gray-100 text-gray-600',
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}

function Metric({ icon: Icon, label, value, hint }: { icon: ElementType; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        </div>
        <span className="rounded-xl bg-orange-50 p-2 text-[#F97316]"><Icon className="h-4 w-4" /></span>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: ElementType; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#F97316]" />
        <h2 className="text-sm font-bold uppercase text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-gray-400">{label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-gray-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[11px] text-gray-400">{hint}</p>
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-400">{children}</p>;
}

function VehiclePanel({ vehicle, onOpenDocument, documentLoading }: { vehicle: AdminVehicle; onOpenDocument: (key: string, label: string) => void; documentLoading: string | null }) {
  const title = [vehicle.brand, vehicle.model_name || vehicle.model_num].filter(Boolean).join(' ') || 'Vehicle';
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="flex gap-3">
        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Car className="h-5 w-5 text-gray-300" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
            <StatusBadge tone={vehicle.verificationStatus === 'APPROVED' ? 'good' : vehicle.verificationStatus === 'REJECTED' ? 'danger' : 'neutral'}>
              {vehicle.verificationStatus}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-gray-500">{vehicle.color || '-'} · {vehicle.year || '-'} · {vehicle.type || '-'}</p>
          <p className="mt-1 text-xs text-gray-400">{vehicle.licenseCountry} · {vehicle.licenseNumber}</p>
        </div>
      </div>
      {vehicle.rejectionReason && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{vehicle.rejectionReason}</p>}
      {vehicle.documents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {vehicle.documents.map((doc) => {
            const key = doc.previewKey || doc.image;
            return (
              <button
                key={doc.id}
                type="button"
                disabled={!key || documentLoading === key}
                onClick={() => {
                  if (doc.previewKey) onOpenDocument(doc.previewKey, doc.documentType);
                  else if (doc.image) window.open(doc.image, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-40"
              >
                {documentLoading === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                {doc.documentType.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RideList({ rides }: { rides: AdminUserPublishedRide[] }) {
  if (rides.length === 0) return <EmptyLine>No rides published yet.</EmptyLine>;
  return (
    <div className="divide-y divide-gray-100">
      {rides.map((ride) => {
        const paid = ride.bookings.reduce((sum, booking) => sum + (booking.payment?.fareAmount || booking.paymentAmount || 0), 0);
        return (
          <div key={ride.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/rides?search=${encodeURIComponent(ride.id)}&searchBy=rideId`} className="font-semibold text-gray-900 hover:text-[#F97316]">
                    {routeName(ride.originAddress, ride.destinationAddress)}
                  </Link>
                  <StatusBadge tone={ride.status === 'COMPLETED' ? 'good' : ride.status === 'CANCELLED' ? 'danger' : 'neutral'}>{ride.status.replace(/_/g, ' ')}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-gray-500">{formatDate(ride.departureDate)} at {ride.departureTime} · {ride.bookings.length} bookings · {ride.availableSeats}/{ride.totalSeats} seats left</p>
                {ride.vehicle && <p className="mt-1 text-xs text-gray-400">{[ride.vehicle.brand, ride.vehicle.model_name || ride.vehicle.model_num].filter(Boolean).join(' ')}</p>}
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-bold text-gray-900">{formatMoney(paid, ride.currency)}</p>
                <p className="text-xs text-gray-400">driver fare</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookingList({ bookings }: { bookings: AdminUserBooking[] }) {
  if (bookings.length === 0) return <EmptyLine>No bookings made yet.</EmptyLine>;
  return (
    <div className="divide-y divide-gray-100">
      {bookings.map((booking) => {
        const currency = booking.payment?.currency || booking.paymentCurrency || booking.ride?.currency || 'EUR';
        const amount = booking.payment?.amountTotal || booking.paymentAmount || booking.totalPrice;
        return (
          <div key={booking.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/rides?search=${encodeURIComponent(booking.rideId)}&searchBy=rideId`} className="font-semibold text-gray-900 hover:text-[#F97316]">
                    {routeName(booking.ride?.originAddress, booking.ride?.destinationAddress)}
                  </Link>
                  <StatusBadge tone={booking.status === 'COMPLETED' ? 'good' : booking.status === 'CANCELLED' ? 'danger' : 'neutral'}>{booking.status.replace(/_/g, ' ')}</StatusBadge>
                  {booking.disputes.length > 0 && <StatusBadge tone="danger">{booking.disputes.length} disputes</StatusBadge>}
                </div>
                <p className="mt-1 text-xs text-gray-500">{formatDate(booking.ride?.departureDate)} at {booking.ride?.departureTime || '-'} · {booking.seatsBooked} seats</p>
                <p className="mt-1 text-xs text-gray-400">Driver {booking.ride?.driver ? fullName(booking.ride.driver) : '-'}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-bold text-gray-900">{formatMoney(amount, currency)}</p>
                <p className="text-xs text-gray-400">{booking.payment?.status || 'payment -'}{booking.refundAmount ? ` · ${formatMoney(booking.refundAmount, currency)} refunded` : ''}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
