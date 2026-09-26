'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RideRequestLayout from '@/components/RideRequestLayout';
import RideRequestConsent, { acceptRideRequestConsent } from '@/components/RideRequestConsent';
import { useAuth } from '@/lib/auth-context';
import RequestPlaceField from '@/components/RequestPlaceField';
import { rideRequestsApi } from '@/lib/ride-requests';
import { getApiErrorMessage } from '@/lib/api';

function CreateRequest() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [origin, setOrigin] = useState({ id: '', address: '' }),
    [destination, setDestination] = useState({ id: '', address: '' });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!origin.id || !destination.id) {
      setError('Select both locations from the suggestions.');
      return;
    }
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await acceptRideRequestConsent(user, data);
      await refreshUser();
      const after = new Date(String(data.get('after'))).toISOString();
      const result = await rideRequestsApi.create({
        originPlaceId: origin.id,
        destinationPlaceId: destination.id,
        departureAfter: after,
        departureBefore: data.get('before')
          ? new Date(String(data.get('before'))).toISOString()
          : after,
        seats: Number(data.get('seats')),
        luggage: Number(data.get('luggage')),
        budgetPerSeat: data.get('budget') ? Number(data.get('budget')) : undefined,
        notes: String(data.get('notes') || ''),
      });
      router.push(`/ride-requests/${result.data.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not post your request.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/ride-requests" className="text-sm text-deliivo-orange">
        ← Ride requests
      </Link>
      <h1 className="my-3 text-3xl font-bold">Where do you need to go?</h1>
      <p className="mb-6 text-gray-600">
        Post your plans for drivers to see. No payment until you choose a driver and accept their
        offer.
      </p>
      <form
        onSubmit={submit}
        className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm sm:p-8"
      >
        <RequestPlaceField label="From" onChange={(id, address) => setOrigin({ id, address })} />
        <RequestPlaceField
          label="To"
          scope="europe"
          onChange={(id, address) => setDestination({ id, address })}
        />
        {origin.id && destination.id && (
          <Link
            href={`/search?${new URLSearchParams({ from: origin.address, to: destination.address })}`}
            className="block rounded-xl bg-orange-50 p-3 text-sm font-semibold text-deliivo-orange"
          >
            Check existing rides on this route first →
          </Link>
        )}
        <p className="text-xs text-gray-500">
          Choose public meeting points, not home addresses. Your route and notes are visible to
          signed-in users. Times use your device timezone (
          {Intl.DateTimeFormat().resolvedOptions().timeZone}). Choose a time at least three hours
          ahead.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Preferred departure
            <input
              name="after"
              type="datetime-local"
              required
              className="input-field mt-2 w-full"
            />
          </label>
          <label className="text-sm font-semibold">
            Latest departure (optional)
            <input name="before" type="datetime-local" className="input-field mt-2 w-full" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold">
            Seats needed
            <input
              name="seats"
              type="number"
              min="1"
              max="4"
              defaultValue="1"
              required
              className="input-field mt-2 w-full"
            />
          </label>
          <label className="text-sm font-semibold">
            Bags (total)
            <input
              name="luggage"
              type="number"
              min="0"
              max="10"
              defaultValue="0"
              required
              className="input-field mt-2 w-full"
            />
          </label>
          <label className="text-sm font-semibold">
            Budget / seat (EUR)
            <input
              name="budget"
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              placeholder="Optional"
              className="input-field mt-2 w-full"
            />
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Additional needs
          <textarea
            name="notes"
            maxLength={500}
            rows={3}
            placeholder="Luggage size, accessibility or meeting-point preferences. Do not include phone numbers or private addresses."
            className="input-field mt-2 w-full"
          />
        </label>
        <p className="text-sm text-gray-600">
          This is a shared ride request, not a private taxi booking. Other riders may join spare
          seats. The request closes 30 minutes before your earliest departure.
        </p>
        <RideRequestConsent disabled={busy} />
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        <button disabled={busy} className="btn-primary w-full">
          {busy ? 'Posting...' : 'Post ride request'}
        </button>
      </form>
    </div>
  );
}
export default function Page() {
  return (
    <RideRequestLayout>
      <CreateRequest />
    </RideRequestLayout>
  );
}
