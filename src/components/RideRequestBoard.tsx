'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Users } from 'lucide-react';
import { rideRequestsApi, requestTime, money, type RideRequest } from '@/lib/ride-requests';
import { getApiErrorMessage } from '@/lib/api';

export default function RideRequestBoard({
  admin = false,
  initialView = 'browse',
}: {
  admin?: boolean;
  initialView?: string;
}) {
  const [view, setView] = useState(
    admin ? 'admin' : ['browse', 'mine', 'offers'].includes(initialView) ? initialView : 'browse',
  );
  const [items, setItems] = useState<RideRequest[]>([]);
  const [page, setPage] = useState(1),
    [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState('');
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams(filters);
    params.set('view', view);
    params.set('page', String(page));
    rideRequestsApi
      .list(params)
      .then((res) => {
        if (active) {
          setItems(res.data.items);
          setTotalPages(res.data.totalPages);
        }
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, 'Could not load requests.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view, page, filters, refresh]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ['from', 'to', 'date', 'seats']) {
      const value = String(data.get(key) || '').trim();
      if (value) params.set(key, value);
    }
    setFilters(params.toString());
    setPage(1);
  }
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-deliivo-orange">
            A journey starts with a request
          </p>
          <h1 className="mt-2 text-3xl font-bold text-deliivo-dark">
            {admin ? 'Manage ride requests' : 'Ride requests'}
          </h1>
          <p className="mt-3 max-w-xl text-gray-600">
            Riders post their plans. Drivers offer a shared journey. Spare seats stay open for
            others.
          </p>
        </div>
        {!admin && (
          <Link href="/ride-requests/new" className="btn-primary">
            Request a ride
          </Link>
        )}
      </div>
      {!admin && (
        <div className="my-6 flex flex-wrap gap-2" aria-label="Request views">
          {[
            ['browse', 'Browse requests'],
            ['mine', 'My requests'],
            ['offers', 'My offers'],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={view === key}
              className={view === key ? 'btn-primary' : 'btn-outline'}
              onClick={() => {
                setView(key);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={filter}
        className="my-6 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        {[
          ['from', 'From', 'text'],
          ['to', 'To', 'text'],
          ['date', 'Travel date (UTC)', 'date'],
          ['seats', 'Seats available', 'number'],
        ].map(([name, label, type]) => (
          <label key={name} className="text-sm font-medium">
            {label}
            <input
              name={name}
              type={type}
              min={type === 'number' ? 1 : undefined}
              max={type === 'number' ? 8 : undefined}
              className="input-field mt-1 w-full"
            />
          </label>
        ))}
        <button className="btn-primary self-end">Filter requests</button>
      </form>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">
          {error}{' '}
          <button className="underline" onClick={() => setRefresh(refresh + 1)}>
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <p role="status" className="py-10 text-center">
          Loading requests...
        </p>
      ) : !error && !items.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <h2 className="text-xl font-semibold">No requests here yet</h2>
          <p className="mt-2 text-gray-600">Try another route or post the journey you need.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/ride-requests/${item.id}`}
              className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex justify-between gap-3 text-xs font-semibold">
                <span>{item.rider.firstName || 'Rider'}</span>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-800">
                  {item.status.replaceAll('_', ' ')}
                </span>
              </div>
              <h2 className="my-4 flex flex-wrap items-center gap-2 text-xl font-bold">
                {item.originAddress}
                <ArrowRight size={18} className="text-deliivo-orange" />
                {item.destinationAddress}
              </h2>
              <p className="flex gap-2 text-sm text-gray-600">
                <CalendarDays size={17} />
                {requestTime(item.departureAfter)}
              </p>
              <p className="mt-2 flex gap-2 text-sm text-gray-600">
                <Users size={17} />
                {item.seats} seats needed · {item.luggage} bags
              </p>
              <div className="mt-5 flex justify-between gap-2 border-t pt-4 text-sm">
                <span>
                  {item.budgetPerSeat
                    ? `Preferred budget ${money(item.budgetPerSeat)} / seat`
                    : 'Open to driver offers'}
                </span>
                <span className="font-semibold text-deliivo-orange">View request →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="my-8 flex items-center justify-center gap-5">
        <button
          className="btn-outline"
          disabled={loading || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          className="btn-outline"
          disabled={loading || page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
