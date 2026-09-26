'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import RideRequestLayout from '@/components/RideRequestLayout';
import { StripeProvider, isStripeConfigured } from '@/lib/stripe';
import { bookingsApi, vehicleApi, getApiErrorMessage, type Booking, type Vehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { rideRequestsApi, money, requestTime, type RideRequest } from '@/lib/ride-requests';

function Checkout({ booking, onComplete }: { booking: Booking; onComplete: () => void }) {
  const stripe = useStripe(),
    elements = useElements();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || !booking.payment?.clientSecret) return;
    const card = elements.getElement(CardElement);
    if (!card) return;
    setBusy(true);
    setError('');
    try {
      const result = await stripe.confirmCardPayment(booking.payment.clientSecret, {
        payment_method: { card },
      });
      if (result.error) throw new Error(result.error.message);
      const confirmed = await bookingsApi.confirmPayment(booking.id);
      if (confirmed.data.status !== 'CONFIRMED')
        throw new Error(
          'Payment is processing. Refresh to check confirmation; do not submit another payment.',
        );
      onComplete();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Payment could not be completed.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border-2 border-orange-200 bg-white p-6">
      <h2 className="text-xl font-bold">Confirm your seats</h2>
      <p className="my-3 text-gray-600">
        {booking.seatsBooked} seats · Total{' '}
        {money(booking.totalPrice, booking.payment?.currency || 'EUR')}
      </p>
      <p className="mb-4 text-sm text-gray-500">
        The driver has already agreed. Payment confirms your booking and opens the spare seats to
        other riders. Cancellation terms apply.
      </p>
      <Link href="/terms" className="mb-4 block text-sm text-deliivo-orange underline">
        Read booking and cancellation terms
      </Link>
      {!isStripeConfigured() ? (
        <p role="alert">Online payments are unavailable. Please try again later.</p>
      ) : (
        <>
          <div className="rounded-xl border p-4">
            <CardElement options={{ hidePostalCode: false }} />
          </div>
          <button disabled={busy || !stripe} className="btn-primary mt-4">
            {busy
              ? 'Confirming payment...'
              : `Pay ${money(booking.totalPrice, booking.payment?.currency || 'EUR')}`}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}

function OfferForm({ request, onComplete }: { request: RideRequest; onComplete: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    vehicleApi
      .list(1, 10)
      .then((res) => {
        if (active) setVehicles(res.data.vehicles);
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, 'Could not load your vehicles.'));
      });
    return () => {
      active = false;
    };
  }, []);
  const date = new Date(request.departureAfter);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await rideRequestsApi.offer(request.id, {
        vehicleId: String(data.get('vehicle')),
        departureAt: new Date(String(data.get('departure'))).toISOString(),
        totalSeats: Number(data.get('seats')),
        pricePerSeat: Number(data.get('price')),
        expiresInHours: Number(data.get('expiry')),
        acceptsSharedJourney: true,
      });
      onComplete();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send your offer.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-bold">Offer this ride</h2>
      <p className="text-sm text-gray-600">
        The request supplies the route and meeting points. You supply the car, exact time and fare.
      </p>
      <label className="block text-sm font-semibold">
        Vehicle
        <select required name="vehicle" className="input-field mt-2 w-full">
          <option value="">Select your vehicle</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.brand} {vehicle.model_name} · {vehicle.licenseNumber}
            </option>
          ))}
        </select>
      </label>
      <Link href="/profile/vehicle" className="block text-sm text-deliivo-orange">
        Manage vehicles and documents
      </Link>
      <label className="block text-sm font-semibold">
        Departure (your device timezone)
        <input
          type="datetime-local"
          name="departure"
          defaultValue={localDate}
          required
          className="input-field mt-2 w-full"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Total passenger seats
          <input
            type="number"
            name="seats"
            min={request.seats}
            max={8}
            defaultValue={request.seats}
            required
            className="input-field mt-2 w-full"
          />
        </label>
        <label className="text-sm font-semibold">
          Fare per seat (EUR)
          <input
            type="number"
            name="price"
            min="0.01"
            max="1000"
            step="0.01"
            required
            className="input-field mt-2 w-full"
          />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        Offer valid for
        <select name="expiry" defaultValue="24" className="input-field mt-2 w-full">
          {[1, 3, 6, 12, 24, 48].map((hours) => (
            <option key={hours} value={hours}>
              {hours} hours
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-gray-500">
        Any service fee is added to the fare and shown to the rider before payment. Your offer
        expires no later than the request deadline.
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input required type="checkbox" className="mt-1" />I have enough passenger seats and luggage
        space. I agree to drive at this fare even if no additional riders join, and to open spare
        seats to others.
      </label>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button disabled={busy || !vehicles.length} className="btn-primary">
        {busy ? 'Sending...' : 'Send driver offer'}
      </button>
    </form>
  );
}

function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<RideRequest | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [booking, setBooking] = useState<Booking | null>(null),
    [confirmCancel, setConfirmCancel] = useState(false);
  function reload() {
    setRefresh((value) => value + 1);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    rideRequestsApi
      .get(id)
      .then((res) => {
        if (active) {
          setRequest(res.data);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, 'Could not load request.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, refresh]);
  useEffect(() => {
    if (request?.status !== 'CHECKOUT_PENDING') return;
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [request?.status]);
  async function checkout(offerId: string) {
    setBusy(true);
    setError('');
    try {
      const result = await rideRequestsApi.checkout(offerId);
      setBooking(result.data);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not reserve this offer.'));
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await rideRequestsApi.cancel(id);
      setConfirmCancel(false);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not cancel request.'));
    } finally {
      setBusy(false);
    }
  }
  async function withdraw(offerId: string) {
    setBusy(true);
    try {
      await rideRequestsApi.withdraw(offerId);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not withdraw offer.'));
    } finally {
      setBusy(false);
    }
  }
  const winner = request?.offers?.find((offer) => offer.status === 'ACCEPTED');
  return (
    <>
      <Link href="/ride-requests" className="text-sm text-deliivo-orange">
        ← Ride requests
      </Link>
      {error && (
        <p role="alert" className="my-4 rounded-xl bg-red-50 p-4 text-red-700">
          {error}{' '}
          <button onClick={reload} className="underline">
            Refresh
          </button>
        </p>
      )}
      {loading && !request && (
        <p role="status" className="py-8">
          Loading request...
        </p>
      )}
      {request && (
        <>
          <div className="my-6 rounded-3xl border border-orange-100 bg-white p-6 sm:p-8">
            <div className="flex justify-between gap-3">
              <span className="text-sm text-gray-500">
                Requested by {request.rider.firstName || 'Rider'}
              </span>
              <strong className="text-sm text-deliivo-orange">
                {request.status.replaceAll('_', ' ')}
              </strong>
            </div>
            <h1 className="my-5 flex flex-wrap items-center gap-3 text-3xl font-bold">
              {request.originAddress}
              <ArrowRight className="text-deliivo-orange" />
              {request.destinationAddress}
            </h1>
            <p>
              {requestTime(request.departureAfter)}
              {request.departureAfter !== request.departureBefore &&
                ` to ${requestTime(request.departureBefore)}`}
            </p>
            <p className="mt-2 text-gray-600">
              {request.seats} passenger seats · {request.luggage} bags ·{' '}
              {request.budgetPerSeat
                ? `${money(request.budgetPerSeat)} preferred budget per seat`
                : 'Open to offers'}
            </p>
            {request.notes && (
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm">
                {request.notes}
              </p>
            )}
            <p className="mt-4 text-xs text-gray-500">
              Request closes: {requestTime(request.expiresAt)}. Times are shown in your device
              timezone.
            </p>
            {winner && (
              <Link
                className="btn-primary mt-5 inline-flex"
                href={`/rides/${winner.rideId}${winner.driverId === user?.id ? '/manage' : ''}`}
              >
                View confirmed ride
              </Link>
            )}
            {(request.isOwner || user?.role === 'ADMIN') && request.status === 'OPEN' && (
              <div className="mt-4">
                {confirmCancel ? (
                  <div role="group" aria-label="Confirm cancellation">
                    <p className="mb-2 text-sm">Cancel this request and close all offers?</p>
                    <button disabled={busy} onClick={cancel} className="btn-outline">
                      Yes, cancel request
                    </button>
                    <button className="ml-4 underline" onClick={() => setConfirmCancel(false)}>
                      Keep request
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmCancel(true)}
                    className="text-sm text-red-600 underline"
                  >
                    Cancel request
                  </button>
                )}
              </div>
            )}
          </div>
          {request.status === 'CHECKOUT_PENDING' && (
            <p role="status" className="mb-5 rounded-xl bg-orange-100 p-4">
              Seats reserved until{' '}
              {request.checkoutExpiresAt
                ? requestTime(request.checkoutExpiresAt)
                : 'checkout completes'}
              . Complete payment below or resume your selected offer. Expired reservations are
              released automatically.
            </p>
          )}
          {booking?.payment?.clientSecret && request.status === 'CHECKOUT_PENDING' && (
            <Checkout
              booking={booking}
              onComplete={() => {
                setBooking(null);
                reload();
              }}
            />
          )}
          <div className="my-6 grid items-start gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-4 text-2xl font-bold">
                {request.isOwner ? 'Driver offers' : 'Your offers'}
              </h2>
              {!request.offers?.length && (
                <p className="rounded-2xl border border-dashed p-6 text-gray-600">
                  {request.isOwner
                    ? 'No offers yet. We will notify you when a driver responds.'
                    : 'Send an offer to help this rider get there.'}
                </p>
              )}
              <div className="space-y-4">
                {request.offers?.map((offer) => (
                  <article key={offer.id} className="rounded-2xl border bg-white p-5">
                    <div className="flex justify-between">
                      <Link
                        href={`/profile/users/${offer.driverId}`}
                        className="font-bold underline"
                      >
                        {offer.driver.firstName || 'Driver'}
                      </Link>
                      <span className="text-xs text-gray-500">{offer.status}</span>
                    </div>
                    <p className="mt-3 flex items-center gap-2 text-sm">
                      <ShieldCheck size={16} className="text-green-700" />
                      {offer.ride.vehicle?.brand} {offer.ride.vehicle?.model_name} ·{' '}
                      {offer.ride.totalSeats} seats
                    </p>
                    <p className="mt-2 text-sm">
                      {requestTime(
                        `${offer.ride.departureDate.slice(0, 10)}T${offer.ride.departureTime}:00Z`,
                      )}
                    </p>
                    <p className="mt-4 text-xl font-bold">
                      {money(offer.price.totalPrice, offer.price.currency)}{' '}
                      <span className="text-sm font-normal text-gray-500">
                        total for your party
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Fare {money(offer.price.subtotal)} + service fee{' '}
                      {money(offer.price.serviceFee)}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Offer expires {requestTime(offer.expiresAt)}
                    </p>
                    {request.isOwner &&
                      ((request.status === 'OPEN' && offer.status === 'OPEN') ||
                        offer.status === 'SELECTED') && (
                        <button
                          disabled={busy}
                          className="btn-primary mt-4"
                          onClick={() => checkout(offer.id)}
                        >
                          {busy
                            ? 'Please wait...'
                            : offer.status === 'SELECTED'
                              ? 'Resume checkout'
                              : 'Accept and pay'}
                        </button>
                      )}
                    {offer.driverId === user?.id && offer.status === 'OPEN' && (
                      <button
                        disabled={busy}
                        className="mt-4 text-sm text-red-600 underline"
                        onClick={() => withdraw(offer.id)}
                      >
                        Withdraw offer
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
            {!request.isOwner &&
              request.status === 'OPEN' &&
              !request.offers?.some(
                (offer) => offer.driverId === user?.id && offer.status === 'OPEN',
              ) && <OfferForm request={request} onComplete={reload} />}
          </div>
        </>
      )}
    </>
  );
}
export default function Page() {
  return (
    <RideRequestLayout>
      <StripeProvider>
        <RequestDetail />
      </StripeProvider>
    </RideRequestLayout>
  );
}
