import { apiFetch, type Booking } from './api';

export const rideRequestsEnabled = process.env.NEXT_PUBLIC_RIDE_REQUESTS_ENABLED === 'true';
export type RequestPerson = { id: string; firstName: string | null; avatarUrl: string | null };
export type RideRequest = {
  id: string;
  riderId: string;
  rider: RequestPerson;
  originAddress: string;
  destinationAddress: string;
  departureAfter: string;
  departureBefore: string;
  seats: number;
  luggage: number;
  budgetPerSeat: number | null;
  status: string;
  expiresAt: string;
  checkoutExpiresAt?: string | null;
  notes?: string;
  isOwner?: boolean;
  offers?: RequestOffer[];
  _count?: { offers: number };
};
export type RequestOffer = {
  id: string;
  driverId: string;
  driver: RequestPerson;
  status: string;
  expiresAt: string;
  bookingId: string | null;
  rideId: string;
  ride: {
    departureDate: string;
    departureTime: string;
    totalSeats: number;
    basePricePerSeat: number;
    currency: string;
    vehicle: { brand: string | null; model_name: string | null; color: string | null } | null;
  };
  price: { subtotal: number; serviceFee: number; totalPrice: number; currency: string };
};
export type RequestInput = {
  originPlaceId: string;
  destinationPlaceId: string;
  departureAfter: string;
  departureBefore: string;
  seats: number;
  luggage: number;
  budgetPerSeat?: number;
  notes: string;
};
export const rideRequestsApi = {
  list(query: URLSearchParams) {
    return apiFetch<{
      data: { items: RideRequest[]; total: number; totalPages: number; page: number };
    }>(`/api/v1/ride-requests?${query}`);
  },
  get(id: string) {
    return apiFetch<{ data: RideRequest }>(`/api/v1/ride-requests/${id}`);
  },
  create(input: RequestInput) {
    return apiFetch<{ data: RideRequest }>('/api/v1/ride-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  cancel(id: string) {
    return apiFetch(`/api/v1/ride-requests/${id}/cancel`, { method: 'POST' });
  },
  offer(
    id: string,
    input: {
      vehicleId: string;
      departureAt: string;
      totalSeats: number;
      pricePerSeat: number;
      expiresInHours: number;
      acceptsSharedJourney: true;
    },
  ) {
    return apiFetch(`/api/v1/ride-requests/${id}/offers`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  checkout(id: string) {
    return apiFetch<{ data: Booking }>(`/api/v1/ride-requests/offers/${id}/checkout`, {
      method: 'POST',
    });
  },
  withdraw(id: string) {
    return apiFetch(`/api/v1/ride-requests/offers/${id}/withdraw`, { method: 'POST' });
  },
};
export const requestTime = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const money = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
