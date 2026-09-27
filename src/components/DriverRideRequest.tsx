'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Users, Luggage, Check, Clock3, ChevronDown } from 'lucide-react';
import { money, requestTime, type RideRequest, type RequestOffer } from '@/lib/ride-requests';
import DriverRideOfferForm from './DriverRideOfferForm';

function DriverOffer({
  offer,
  now,
  busy,
  onWithdraw,
}: {
  offer: RequestOffer;
  now: number;
  busy: boolean;
  onWithdraw: (id: string) => Promise<void>;
}) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const expired =
    offer.status === 'EXPIRED' ||
    (offer.status === 'OPEN' && new Date(offer.expiresAt).getTime() <= now);
  const accepted = offer.status === 'ACCEPTED';
  const waiting = offer.status === 'OPEN' && !expired;
  const selected = offer.status === 'SELECTED';
  const title = accepted
    ? 'Ride confirmed'
    : selected
      ? 'Rider is checking out'
      : waiting
        ? 'Waiting for rider'
        : expired
          ? 'Offer expired'
          : offer.status === 'WITHDRAWN'
            ? 'Offer withdrawn'
            : 'Offer closed';
  return (
    <article className="rounded-3xl border border-orange-100 bg-white p-5 sm:p-7">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-deliivo-orange">
        {accepted ? (
          <Check size={20} aria-hidden="true" />
        ) : (
          <Clock3 size={20} aria-hidden="true" />
        )}
      </div>
      <h2 className="text-2xl font-bold text-deliivo-dark">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        {accepted
          ? 'The rider accepted and paid. Open the ride for its current status and passenger details.'
          : selected
            ? 'Your seats are reserved while the rider completes payment. No action needed from you.'
            : waiting
              ? 'Your offer is sent. The rider can accept and pay to confirm the journey.'
              : 'This offer is no longer awaiting a response.'}
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-5 border-y border-gray-100 py-5 text-sm">
        <div>
          <dt className="text-gray-500">Your fare</dt>
          <dd className="mt-1 text-lg font-bold">
            {money(offer.ride.basePricePerSeat, offer.ride.currency)}{' '}
            <span className="text-xs font-normal text-gray-500">/ seat</span>
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Seats offered</dt>
          <dd className="mt-1 font-semibold">{offer.ride.totalSeats}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-gray-500">Departure</dt>
          <dd className="mt-1 font-semibold">
            {requestTime(
              `${offer.ride.departureDate.slice(0, 10)}T${offer.ride.departureTime}:00Z`,
            )}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-gray-500">Vehicle</dt>
          <dd className="mt-1 font-semibold">
            {offer.ride.vehicle?.brand} {offer.ride.vehicle?.model_name}
          </dd>
        </div>
      </dl>
      {waiting && (
        <p className="mt-4 text-xs text-gray-500">
          Rider can respond until {requestTime(offer.expiresAt)}.
        </p>
      )}
      {accepted ? (
        <Link href={`/rides/${offer.rideId}/manage`} className="btn-primary mt-5 w-full">
          View confirmed ride
        </Link>
      ) : (
        <Link href="/ride-requests?view=offers" className="btn-outline mt-5 w-full">
          My offers
        </Link>
      )}
      {waiting &&
        (confirmWithdraw ? (
          <div
            className="mt-5 rounded-xl bg-gray-50 p-4 text-sm"
            role="group"
            aria-label="Confirm withdrawal"
          >
            <p>Withdraw this offer? The rider will no longer be able to accept it.</p>
            <div className="mt-3 flex flex-wrap gap-4">
              <button
                disabled={busy}
                type="button"
                onClick={() => onWithdraw(offer.id)}
                className="font-semibold text-red-700 underline"
              >
                {busy ? 'Withdrawing...' : 'Yes, withdraw offer'}
              </button>
              <button
                disabled={busy}
                type="button"
                onClick={() => setConfirmWithdraw(false)}
                className="underline"
              >
                Keep offer
              </button>
            </div>
          </div>
        ) : (
          <button
            disabled={busy}
            type="button"
            onClick={() => setConfirmWithdraw(true)}
            className="mt-5 w-full text-sm text-gray-500 underline"
          >
            Withdraw offer
          </button>
        ))}
    </article>
  );
}

export default function DriverRideRequest({
  request,
  userId,
  busy,
  onComplete,
  onWithdraw,
  showRequestSummary = true,
}: {
  request: RideRequest;
  userId: string;
  busy: boolean;
  onComplete: () => void;
  onWithdraw: (id: string) => Promise<void>;
  showRequestSummary?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const offers = request.offers?.filter((offer) => offer.driverId === userId) || [];
  const activeOffer = offers.find(
    (offer) =>
      ['SELECTED', 'ACCEPTED'].includes(offer.status) ||
      (offer.status === 'OPEN' && new Date(offer.expiresAt).getTime() > now),
  );
  const history = offers.filter((offer) => offer.id !== activeOffer?.id);
  const canOffer =
    request.status === 'OPEN' && new Date(request.expiresAt).getTime() > now && !activeOffer;
  const departureTooSoon = new Date(request.departureBefore).getTime() < now + 3 * 3600000;
  return (
    <div className="mx-auto max-w-5xl">
      {showRequestSummary && (
        <header className="mb-5 mt-5">
          <h1 className="text-3xl font-bold tracking-tight text-deliivo-dark">
            {activeOffer ? 'Your ride offer' : 'Offer a ride'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {activeOffer
              ? "Your offer and the rider's journey, in one place."
              : `Help ${request.rider.firstName || 'this rider'} get there. Keep spare seats open for others.`}
          </p>
        </header>
      )}
      <div
        className={
          showRequestSummary
            ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]'
            : ''
        }
      >
        {showRequestSummary && (
          <aside
            className="min-w-0 rounded-3xl border border-orange-100 bg-white/70 p-5 sm:p-7 lg:sticky lg:top-24"
            aria-label="Rider request summary"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-gray-500">
                {request.rider.firstName || 'Rider'}&apos;s request
              </span>
              <span className="rounded-full bg-orange-100 px-3 py-1 font-medium text-orange-800">
                {request.status === 'OPEN'
                  ? 'Open request'
                  : request.status === 'CHECKOUT_PENDING'
                    ? 'Checkout in progress'
                    : request.status === 'MATCHED'
                      ? 'Matched'
                      : request.status === 'CANCELLED'
                        ? 'Cancelled'
                        : 'Expired'}
              </span>
            </div>
            <div className="my-4 space-y-3 border-l-2 border-orange-200 pl-4 sm:my-6 sm:space-y-4">
              {[
                [request.originAddress, 'Pickup'],
                [request.destinationAddress, 'Destination'],
              ].map(([address, label]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <h2 className="mt-1 break-words text-lg font-bold text-deliivo-dark">
                    {address.split(',')[0]}
                  </h2>
                  {address.includes(',') && (
                    <p className="mt-1 break-words text-xs leading-5 text-gray-500">
                      {address.slice(address.indexOf(',') + 1).trim()}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-orange-100 pt-4 text-sm">
              <div className="flex items-start gap-3">
                <CalendarDays
                  size={17}
                  className="mt-0.5 shrink-0 text-deliivo-orange"
                  aria-hidden="true"
                />
                <div>
                  {requestTime(request.departureAfter)}
                  {request.departureAfter !== request.departureBefore && (
                    <span className="block text-gray-500">
                      to {requestTime(request.departureBefore)}
                    </span>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Your local time</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <p className="flex items-center gap-3">
                  <Users size={17} className="shrink-0 text-deliivo-orange" aria-hidden="true" />
                  {request.seats} {request.seats === 1 ? 'rider' : 'riders'}
                </p>
                <p className="flex items-center gap-3">
                  <Luggage size={17} className="shrink-0 text-deliivo-orange" aria-hidden="true" />
                  {request.luggage} {request.luggage === 1 ? 'bag' : 'bags'}
                </p>
              </div>
            </div>
            {request.notes && (
              <details className="group mt-4 rounded-xl bg-white text-sm">
                <summary className="accordion-summary">
                  Note from the rider
                  <ChevronDown className="accordion-icon" aria-hidden="true" />
                </summary>
                <p className="whitespace-pre-wrap break-words px-4 pb-4 leading-6">
                  {request.notes}
                </p>
              </details>
            )}
          </aside>
        )}
        <div className="min-w-0 space-y-4">
          {activeOffer ? (
            <DriverOffer offer={activeOffer} now={now} busy={busy} onWithdraw={onWithdraw} />
          ) : canOffer && !departureTooSoon ? (
            <DriverRideOfferForm
              key={request.id}
              request={request}
              now={now}
              onComplete={onComplete}
            />
          ) : (
            <div className="rounded-3xl border border-orange-100 bg-white p-6">
              <h2 className="text-xl font-bold">
                {canOffer ? 'Too close to departure' : 'This request is no longer open'}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {canOffer
                  ? 'New offers need a departure at least 3 hours from now.'
                  : 'Browse requests to find another journey.'}
              </p>
              <Link href="/ride-requests" className="btn-primary mt-5">
                Browse requests
              </Link>
            </div>
          )}
          {history.length > 0 && (
            <details className="group rounded-2xl border border-gray-200 bg-white/70">
              <summary className="accordion-summary">
                Previous offers ({history.length})
                <ChevronDown className="accordion-icon" aria-hidden="true" />
              </summary>
              <div className="space-y-3 p-3">
                {history.map((offer) => (
                  <DriverOffer
                    key={offer.id}
                    offer={offer}
                    now={now}
                    busy={busy}
                    onWithdraw={onWithdraw}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
