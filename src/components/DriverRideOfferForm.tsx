'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CarFront, Check, ChevronDown } from 'lucide-react';
import { vehicleApi, getApiErrorMessage, type Vehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { rideRequestsApi, money, requestTime, type RideRequest } from '@/lib/ride-requests';
import RideRequestConsent, { acceptRideRequestConsent } from './RideRequestConsent';

function localInput(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function DriverRideOfferForm({
  request,
  now,
  onComplete,
}: {
  request: RideRequest;
  now: number;
  onComplete: () => void;
}) {
  const { user, refreshUser } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [vehicleError, setVehicleError] = useState('');
  const [retry, setRetry] = useState(0);
  const fixedDeparture =
    new Date(request.departureAfter).getTime() === new Date(request.departureBefore).getTime();
  const [departure, setDeparture] = useState(() =>
    localInput(
      new Date(
        Math.ceil(
          Math.max(new Date(request.departureAfter).getTime(), Date.now() + 3 * 3600000) / 60000,
        ) * 60000,
      ).toISOString(),
    ),
  );
  const [fare, setFare] = useState('');
  const [seats, setSeats] = useState(request.seats);
  const [expiry, setExpiry] = useState(24);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    vehicleApi
      .list(1, 10)
      .then(({ data }) => {
        if (!active) return;
        setVehicles(data.vehicles);
        if (data.vehicles.length === 1) setVehicleId(data.vehicles[0].id);
      })
      .catch((err) => {
        if (active) setVehicleError(getApiErrorMessage(err, 'Could not load your vehicles.'));
      })
      .finally(() => {
        if (active) setVehicleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const offerCloses = new Date(
    Math.min(new Date(request.expiresAt).getTime(), now + expiry * 3600000),
  );
  const partyFare = (Math.round(Number(fare) * 100) * request.seats) / 100;
  const extraSeats = seats - request.seats;

  function reloadVehicles() {
    setVehicleLoading(true);
    setVehicleError('');
    setRetry((value) => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const data = new FormData(event.currentTarget);
    setError('');
    try {
      const departureAt = fixedDeparture
        ? request.departureAfter
        : new Date(departure).toISOString();
      const time = new Date(departureAt).getTime();
      if (new Date(request.expiresAt).getTime() <= Date.now())
        throw new Error('This request has closed. Browse requests to find another journey.');
      if (time < Date.now() + 3 * 3600000)
        throw new Error(
          "Departure must be at least 3 hours from now. Choose a later time within the rider's window.",
        );
      if (
        time < new Date(request.departureAfter).getTime() ||
        time > new Date(request.departureBefore).getTime()
      ) {
        throw new Error("Choose a departure within the rider's requested window.");
      }
      if (!selectedVehicle) throw new Error('Choose a vehicle for this ride.');
      if (data.get('sharedJourney') !== 'on')
        throw new Error('Confirm the shared journey agreement before sending.');
      sending.current = true;
      setBusy(true);
      await acceptRideRequestConsent(user, data);
      await refreshUser();
      await rideRequestsApi.offer(request.id, {
        vehicleId,
        departureAt,
        totalSeats: seats,
        pricePerSeat: Number(fare),
        expiresInHours: expiry,
        acceptsSharedJourney: true,
      });
      setSent(true);
      onComplete();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send your offer. Your details are kept below.'));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div role="status" className="rounded-3xl border border-orange-100 bg-white p-6 sm:p-8">
        <Check className="mb-4 text-green-700" aria-hidden="true" />
        <h2 className="text-2xl font-bold">Offer sent</h2>
        <p className="mt-2 text-gray-600">
          The rider can now review your offer. The ride is confirmed once they pay.
        </p>
        <Link href="/ride-requests?view=offers" className="btn-outline mt-5">
          My offers
        </Link>
      </div>
    );

  return (
    <section
      className="min-w-0 rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-7"
      aria-labelledby="driver-offer-heading"
    >
      <h2 id="driver-offer-heading" className="text-2xl font-bold text-deliivo-dark">
        Make your offer
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose your car and fare. The route is already set.
      </p>
      {vehicleLoading ? (
        <p role="status" className="py-10 text-gray-500">
          Loading your vehicles...
        </p>
      ) : vehicleError ? (
        <div role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
          <p>{vehicleError}</p>
          <button type="button" className="mt-3 underline" onClick={reloadVehicles}>
            Try again
          </button>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-orange-50 p-5">
          <CarFront className="text-deliivo-orange" aria-hidden="true" />
          <h3 className="mt-3 font-semibold">Add a vehicle first</h3>
          <p className="mt-1 text-sm text-gray-600">
            Add your car and documents before making an offer.
          </p>
          <Link href="/profile/vehicle" className="btn-primary mt-4">
            Add a vehicle
          </Link>
          <button type="button" onClick={reloadVehicles} className="mt-4 block text-sm underline">
            Already added? Refresh vehicles
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6">
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            {vehicles.length === 1 ? (
              <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-4">
                <CarFront className="shrink-0 text-deliivo-orange" size={22} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500">Your vehicle</p>
                  <p className="break-words font-semibold">
                    {vehicles[0].brand} {vehicles[0].model_name}
                  </p>
                  <p className="text-xs text-gray-500">{vehicles[0].licenseNumber}</p>
                </div>
                <Link
                  href="/profile/vehicle"
                  className="text-xs font-semibold text-deliivo-orange underline"
                >
                  Manage
                </Link>
              </div>
            ) : (
              <div>
                <label htmlFor="offer-vehicle" className="block text-sm font-semibold">
                  Vehicle
                </label>
                <select
                  id="offer-vehicle"
                  required
                  name="vehicle"
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  className="input-field mt-2"
                >
                  <option value="">Choose your car</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} {vehicle.model_name} / {vehicle.licenseNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedVehicle &&
              ['PENDING', 'REJECTED'].includes(selectedVehicle.verificationStatus) && (
                <p className="text-sm text-amber-800">
                  {selectedVehicle.verificationStatus === 'REJECTED'
                    ? 'This vehicle needs attention.'
                    : 'This vehicle is awaiting approval.'}{' '}
                  <Link href="/profile/vehicle" className="underline">
                    Review vehicle
                  </Link>
                </p>
              )}
            {fixedDeparture ? (
              <div className="text-sm">
                <p className="font-semibold">Departure</p>
                <p className="mt-1">{requestTime(request.departureAfter)}</p>
                <p className="mt-1 text-xs text-gray-500">The rider requested this exact time.</p>
              </div>
            ) : (
              <div>
                <label htmlFor="offer-departure" className="block text-sm font-semibold">
                  Departure time
                </label>
                <input
                  id="offer-departure"
                  aria-describedby="offer-time-help"
                  type="datetime-local"
                  name="departure"
                  value={departure}
                  onChange={(event) => setDeparture(event.target.value)}
                  min={localInput(request.departureAfter)}
                  max={localInput(request.departureBefore)}
                  required
                  className="input-field date-input-field mt-2"
                />
                <p id="offer-time-help" className="mt-2 text-xs text-gray-500">
                  Within the rider&apos;s window. Times shown in{' '}
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                </p>
              </div>
            )}
            <div>
              <label htmlFor="offer-price" className="block text-sm font-semibold">
                Fare per seat (EUR)
              </label>
              <input
                id="offer-price"
                aria-describedby={request.budgetPerSeat ? 'offer-price-help' : undefined}
                type="number"
                name="price"
                min="0.01"
                max="1000"
                step="0.01"
                inputMode="decimal"
                placeholder="e.g. 20.00"
                value={fare}
                onChange={(event) => setFare(event.target.value)}
                required
                className="input-field mt-2"
              />
              {request.budgetPerSeat ? (
                <p id="offer-price-help" className="mt-2 text-xs text-gray-500">
                  Rider&apos;s budget: {money(request.budgetPerSeat)} / seat. Subject to route pricing
                  limits.
                </p>
              ) : null}
            </div>
            <details className="group rounded-2xl border border-gray-200">
              <summary className="accordion-summary">
                <span>
                  Seats &amp; offer settings{' '}
                  <span className="block text-xs font-normal text-gray-500">
                    {seats} seats total / up to {expiry} hours to respond
                  </span>
                </span>
                <ChevronDown className="accordion-icon" aria-hidden="true" />
              </summary>
              <div className="accordion-body">
                <div>
                  <label htmlFor="offer-seats" className="block text-sm font-semibold">
                    Total passenger seats
                  </label>
                  <select
                    id="offer-seats"
                    aria-describedby="offer-seats-help"
                    name="seats"
                    value={seats}
                    onChange={(event) => setSeats(Number(event.target.value))}
                    className="input-field mt-2"
                  >
                    {Array.from(
                      { length: 9 - request.seats },
                      (_, index) => index + request.seats,
                    ).map((count) => (
                      <option key={count} value={count}>
                        {count} seats
                      </option>
                    ))}
                  </select>
                  <p id="offer-seats-help" className="mt-2 text-xs text-gray-500">
                    Excludes you. Add only seats your vehicle can safely carry.
                  </p>
                </div>
                <div>
                  <label htmlFor="offer-expiry" className="block text-sm font-semibold">
                    Offer valid for
                  </label>
                  <select
                    id="offer-expiry"
                    name="expiry"
                    value={expiry}
                    onChange={(event) => setExpiry(Number(event.target.value))}
                    className="input-field mt-2"
                  >
                    {[1, 3, 6, 12, 24, 48].map((hours) => (
                      <option key={hours} value={hours}>
                        {hours} hours
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500">
                  Closes by {requestTime(offerCloses.toISOString())}, or earlier if the request
                  closes.
                </p>
              </div>
            </details>
            <div className="rounded-2xl bg-orange-50 p-4 text-sm" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Fare for {request.seats} {request.seats === 1 ? 'rider' : 'riders'}
                </span>
                <strong className="text-lg text-deliivo-dark">
                  {Number(fare) > 0 && Number.isFinite(partyFare)
                    ? money(partyFare)
                    : 'Set your fare'}
                </strong>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                Before the rider&apos;s service fee. Not a payout estimate.
              </p>
              <p className="mt-2 text-xs text-gray-600">
                {extraSeats > 0
                  ? `${extraSeats} spare ${extraSeats === 1 ? 'seat opens' : 'seats open'} to other riders after confirmation.`
                  : 'Want to share more seats? Adjust offer settings above.'}
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm leading-5 text-gray-700">
              <input
                required
                name="sharedJourney"
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
              />
              <span>
                I can carry {request.seats} {request.seats === 1 ? 'rider' : 'riders'} and{' '}
                {request.luggage} {request.luggage === 1 ? 'bag' : 'bags'}. I&apos;ll drive at this fare
                even if no one else joins, and share any spare seats.
              </span>
            </label>
            <RideRequestConsent disabled={busy} />
          </fieldset>
          {error && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700 outline-none"
            >
              {error}
            </div>
          )}
          <button disabled={busy || !vehicleId} className="btn-primary mt-6 w-full">
            {busy ? 'Sending offer...' : 'Send offer'}
          </button>
          <p className="mt-3 text-center text-xs text-gray-500">
            The ride is confirmed only when the rider accepts and pays.
          </p>
        </form>
      )}
    </section>
  );
}
