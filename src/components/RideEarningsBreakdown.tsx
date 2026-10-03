'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Wallet } from 'lucide-react';
import { DriverRideBooking, formatBookingReference } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { useTranslation } from '@/lib/i18n-context';

/**
 * Ride-level price breakdown for the driver.
 *
 * Every per-booking figure here is computed by the backend (`driverNetAmount`, `serviceFeeAmount`,
 * `riderTotalAmount` — already net of refunds). This component only adds them up and formats the
 * result. It must never derive the fee from `serviceFeePercent`: the publish screen used to do that
 * and promised drivers a rate the backend was not charging.
 *
 * Totals are carried in integer cents so a ride with many bookings cannot drift a cent off the sum
 * of the rows the driver can expand and check for themselves.
 */

interface Totals {
  /** Cents. */
  driverNet: number;
  /** Cents. */
  serviceFee: number;
  /** Cents. */
  riderTotal: number;
  seats: number;
  /** Bookings that had a usable amount and are inside the totals. */
  counted: number;
  /** Bookings the API sent without amounts, left out of the totals. */
  missing: number;
}

const EMPTY_TOTALS: Totals = { driverNet: 0, serviceFee: 0, riderTotal: 0, seats: 0, counted: 0, missing: 0 };

const toCents = (value: number) => Math.round(value * 100);

const hasAmounts = (booking: DriverRideBooking) => typeof booking.driverNetAmount === 'number';

function sumBookings(bookings: DriverRideBooking[]): Totals {
  return bookings.reduce<Totals>((totals, booking) => {
    if (!hasAmounts(booking)) {
      return { ...totals, missing: totals.missing + 1 };
    }
    return {
      driverNet: totals.driverNet + toCents(booking.driverNetAmount as number),
      serviceFee: totals.serviceFee + toCents(booking.serviceFeeAmount ?? 0),
      riderTotal: totals.riderTotal + toCents(booking.riderTotalAmount ?? booking.totalPrice),
      seats: totals.seats + (booking.seatsBooked ?? 0),
      counted: totals.counted + 1,
      missing: totals.missing,
    };
  }, EMPTY_TOTALS);
}

export default function RideEarningsBreakdown({
  confirmedBookings,
  pendingBookings,
  rideCurrency,
}: {
  confirmedBookings: DriverRideBooking[];
  pendingBookings: DriverRideBooking[];
  rideCurrency: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const confirmed = useMemo(() => sumBookings(confirmedBookings), [confirmedBookings]);
  const pending = useMemo(() => sumBookings(pendingBookings), [pendingBookings]);
  const pricedBookings = useMemo(() => confirmedBookings.filter(hasAmounts), [confirmedBookings]);

  const currency = confirmedBookings.find(b => b.currency)?.currency
    ?? pendingBookings.find(b => b.currency)?.currency
    ?? rideCurrency;

  const money = (amountInCents: number) => formatMoney(amountInCents / 100, currency);

  const title = (
    <h3 className="flex items-center gap-2 text-base font-bold text-deliivo-dark">
      <Wallet size={16} className="text-deliivo-orange" /> {t('manageRide.earningsTitle')}
    </h3>
  );

  if (confirmed.counted === 0 && pending.counted === 0) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        {title}
        <p className="mt-2 text-xs text-deliivo-gray">{t('manageRide.earningsEmpty')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
        {title}
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-deliivo-gray">{t('manageRide.earningsYouEarn')}</p>
          <p className="text-lg font-bold text-deliivo-dark">{money(confirmed.driverNet)}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-deliivo-gray">
            {t('manageRide.earningsSeatFares', { seats: confirmed.seats, bookings: confirmed.counted })}
          </dt>
          <dd className="shrink-0 font-medium text-deliivo-dark">{money(confirmed.driverNet)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-deliivo-gray">{t('manageRide.earningsServiceFee')}</dt>
          <dd className="shrink-0 font-medium text-deliivo-dark">+ {money(confirmed.serviceFee)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3 border-t border-gray-100 pt-2">
          <dt className="text-deliivo-gray">{t('manageRide.earningsRidersPay')}</dt>
          <dd className="shrink-0 font-semibold text-deliivo-dark">{money(confirmed.riderTotal)}</dd>
        </div>
      </dl>

      <p className="mt-2 text-[11px] leading-5 text-deliivo-gray">{t('manageRide.earningsFeeNotice')}</p>

      {pending.counted > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">
            {t('manageRide.earningsPendingTitle', { amount: money(pending.driverNet) })}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-800">
            {t('manageRide.earningsPendingCopy', { count: pending.counted, plural: pending.counted > 1 ? 's' : '' })}
          </p>
        </div>
      )}

      {confirmed.missing > 0 && (
        <p className="mt-2 text-[11px] text-deliivo-gray">
          {t('manageRide.earningsMissingAmounts', { count: confirmed.missing, plural: confirmed.missing > 1 ? 's' : '' })}
        </p>
      )}

      {pricedBookings.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            aria-expanded={expanded}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-deliivo-orange hover:underline"
          >
            {expanded ? t('manageRide.earningsHidePerPassenger') : t('manageRide.earningsShowPerPassenger')}
            <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {expanded && (
            <ul className="mt-3 space-y-2">
              {pricedBookings.map(booking => (
                <li
                  key={booking.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-deliivo-dark">
                      {booking.passenger?.firstName || t('manageRide.passenger')}
                    </p>
                    <p className="text-[11px] text-deliivo-gray">
                      {t('manageRide.seatsRequested', {
                        count: booking.seatsBooked,
                        plural: booking.seatsBooked > 1 ? 's' : '',
                      })}
                      {' • '}
                      {formatBookingReference(booking)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-deliivo-dark">
                      {formatMoney(booking.driverNetAmount, booking.currency ?? currency)}
                    </p>
                    {Boolean(booking.serviceFeeAmount) && (
                      <p className="text-[11px] text-deliivo-gray">
                        {t('manageRide.earningsRowRiderPaid', {
                          amount: formatMoney(booking.riderTotalAmount, booking.currency ?? currency),
                        })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
