'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n-context";
import {
  MapPin,
  Calendar,
  Users,
  Euro,
  CheckCircle,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Luggage,
  Clock,
  Loader2,
  Search,
  Route,
  AlertCircle,
  Wallet,
  ExternalLink,
  CigaretteOff,
  Bike,
  Car,
} from "lucide-react";
import StepIndicator from "@/components/StepIndicator";
import ProtectedRoute from "@/components/ProtectedRoute";
import GoogleMap from "@/components/GoogleMap";
import { useAuth } from "@/lib/auth-context";
import {
  mapsApi,
  publishRideApi,
  vehicleApi,
  authApi,
  paymentsApi,
  PlacePrediction,
  RouteOption,
  PriceRecommendation,
  LocationInput,
  StopoverSuggestion,
  Vehicle,
  ConnectStatus,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaceSelection {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}

interface WizardState {
  // Step 1 — Route
  origin: PlaceSelection | null;
  destination: PlaceSelection | null;
  // Routes computed
  routes: RouteOption[];
  selectedRouteIndex: number | null;
  pickups: LocationInput[];
  dropoffs: LocationInput[];
  // Stopovers
  stopovers: LocationInput[];
  // Step 2 — Date / Time
  date: string;
  hour: number;
  minute: number;
  // Step 3 — Seats
  seats: number;
  maxLuggage: number;
  backSeatOnly: boolean;
  femaleOnly: boolean;
  noSmoking: boolean;
  alcoholFreeRide: boolean;
  noBicycles: boolean;
  childSeatAvailable: boolean;
  vehicleId: string;
  // Step 4 — Price
  basePricePerSeat: number;
  recommendation: PriceRecommendation | null;
  // Step 5 — Notes
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;
const MAX_ROUTE_PICKUP_POINTS = 3;
const MAX_ORIGIN_PICKUPS = 3;
const MAX_DESTINATION_DROPOFFS = 3;
const MAX_STOPOVERS = 3;
const CITY_POINT_RADIUS_KM = Number(process.env.NEXT_PUBLIC_PUBLISH_CITY_POINT_RADIUS_KM || '15');
const STOPOVER_POINT_RADIUS_KM = Number(process.env.NEXT_PUBLIC_PUBLISH_STOPOVER_POINT_RADIUS_KM || '5');
const ROUTE_POINT_RADIUS_KM = Number(process.env.NEXT_PUBLIC_PUBLISH_ROUTE_POINT_RADIUS_KM || '10');
const ESTONIA_MAP_CENTER = { lat: 58.5953, lng: 25.0136 };
const MINIMUM_PUBLISH_LEAD_MS = 3 * 60 * 60 * 1000;

function isPublishScheduleTooSoon(date: string, hour: number, minute: number) {
  if (!date) return true;
  const [year, month, day] = date.split('-').map(Number);
  const departureAt = Date.UTC(year, month - 1, day, hour, minute);
  return departureAt - Date.now() < MINIMUM_PUBLISH_LEAD_MS;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function decodeRoutePolyline(encoded: string) {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }
  return points;
}

function distanceFromRouteKm(point: { lat: number; lng: number }, encodedPolyline: string) {
  const path = decodeRoutePolyline(encodedPolyline);
  let minimumDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const meanLatitude = ((start.lat + end.lat + point.lat) / 3) * Math.PI / 180;
    const longitudeScale = Math.cos(meanLatitude);
    const segmentX = (end.lng - start.lng) * longitudeScale;
    const segmentY = end.lat - start.lat;
    const pointX = (point.lng - start.lng) * longitudeScale;
    const pointY = point.lat - start.lat;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const ratio = segmentLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, (pointX * segmentX + pointY * segmentY) / segmentLengthSquared));
    const projection = {
      lat: start.lat + ratio * (end.lat - start.lat),
      lng: start.lng + ratio * (end.lng - start.lng),
    };
    minimumDistance = Math.min(minimumDistance, distanceKm(point, projection));
  }
  return minimumDistance;
}

// ─── Helper: calendar grid ────────────────────────────────────────────────────

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

// ─── Place Autocomplete Input ─────────────────────────────────────────────────

function PlaceInput({
  value,
  onChange,
  placeholder,
  icon,
  bias,
}: {
  value: PlaceSelection | null;
  onChange: (place: PlaceSelection) => void;
  placeholder: string;
  icon: React.ReactNode;
  bias?: { lat: number; lng: number; radiusKm: number };
}) {
  const [query, setQuery] = useState(value?.address || '');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (value?.address) setQuery(value.address);
  }, [value]);

  const search = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.length < 2) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await mapsApi.autocomplete(input, bias?.lat, bias?.lng, bias?.radiusKm);
        setPredictions(res.data || []);
        setOpen(true);
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [bias?.lat, bias?.lng, bias?.radiusKm]);

  async function selectPlace(prediction: PlacePrediction) {
    setOpen(false);
    setQuery(prediction.description);
    try {
      const res = await mapsApi.placeDetails(prediction.placeId);
      onChange({
        placeId: prediction.placeId,
        address: prediction.description,
        lat: res.data.location.lat,
        lng: res.data.location.lng,
      });
    } catch {
      // Fallback: use description without coords (will fail later)
      onChange({
        placeId: prediction.placeId,
        address: prediction.description,
        lat: 0,
        lng: 0,
      });
    }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
        {icon}
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        className="input-field pl-10"
      />
      {loading && (
        <div className="absolute inset-y-0 right-4 flex items-center">
          <Loader2 className="h-4 w-4 animate-spin text-deliivo-gray" />
        </div>
      )}
      {open && predictions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-100 bg-white shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((p) => (
            <button
              key={p.placeId}
              type="button"
              onMouseDown={() => selectPlace(p)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-primary-50 transition-colors"
            >
              <Search className="h-4 w-4 shrink-0 text-deliivo-gray" />
              <span className="truncate text-deliivo-dark">{p.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 1: Route ────────────────────────────────────────────────────────────

function StepRoute({
  state,
  onChange,
  error,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  error: string;
}) {
  const { t, locale } = useTranslation();
  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6 lg:space-y-0">
      <div className="lg:col-start-1 lg:row-start-1">
        <h2 className="text-xl font-bold text-deliivo-dark">{t('publish.whatsYourRoute')}</h2>
        <p className="mt-1 text-sm text-deliivo-gray">{t('publish.searchDepartureDestination')}</p>
      </div>

      <GoogleMap
        polyline={state.selectedRouteIndex !== null ? state.routes[state.selectedRouteIndex]?.polyline : undefined}
        markers={[
          ...(state.origin ? [{ lat: state.origin.lat, lng: state.origin.lng, color: 'green' as const }] : []),
          ...(state.destination ? [{ lat: state.destination.lat, lng: state.destination.lng, color: 'red' as const }] : []),
          ...state.pickups.map(s => ({ lat: s.lat, lng: s.lng, color: 'green' as const })),
          ...state.dropoffs.map(s => ({ lat: s.lat, lng: s.lng, color: 'red' as const })),
          ...state.stopovers.map(s => ({ lat: s.lat, lng: s.lng, color: 'blue' as const })),
        ]}
        center={ESTONIA_MAP_CENTER}
        zoom={7}
        snapMarkersToRoute
        className="h-56 w-full rounded-2xl lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:h-[420px]"
      />

      {/* Location inputs */}
      <div className="space-y-3 lg:col-start-1 lg:row-start-2">
        <PlaceInput
          value={state.origin}
          onChange={(place) => onChange({ origin: place })}
          placeholder={t('publish.leavingFrom')}
          icon={<div className="h-2.5 w-2.5 rounded-full bg-deliivo-orange" />}
        />

        <div className="flex items-center px-4">
          <div className="ml-[7px] h-4 w-0.5 bg-gray-200" />
        </div>

        <PlaceInput
          value={state.destination}
          onChange={(place) => onChange({ destination: place })}
          placeholder={t('publish.goingTo')}
          icon={<MapPin className="h-4 w-4 text-deliivo-orange-dark" />}
        />
      </div>

      {/* Route options (shown after both places selected) */}
      {state.routes.length > 0 && (
        <div className="space-y-2 lg:col-start-1 lg:row-start-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
            {t('publish.selectRoute')}
          </p>
          {state.routes.map((route) => (
            <button
              key={route.index}
              type="button"
              onClick={() => {
                if (route.isPublishable === false) return;
                onChange({ selectedRouteIndex: route.index });
              }}
              disabled={route.isPublishable === false}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                state.selectedRouteIndex === route.index
                  ? 'border-deliivo-orange bg-deliivo-orange-light'
                  : route.isPublishable === false
                    ? 'cursor-not-allowed border-red-100 bg-red-50 opacity-70'
                    : 'border-gray-100 bg-white hover:border-primary-200'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-deliivo-dark">
                  {t('publish.routeNumber', { index: route.index + 1 })}
                </p>
                <p className="text-xs text-deliivo-gray">
                  {route.distanceText} &middot; {route.durationText}
                </p>
                {route.isPublishable === false && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {t('publish.nonRoadRoute')}
                  </p>
                )}
              </div>
              {state.selectedRouteIndex === route.index && (
                <CheckCircle className="h-5 w-5 text-deliivo-orange" />
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 lg:col-start-1 lg:row-start-4">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Stopovers ───────────────────────────────────────────────────────

function StepStopovers({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const { t } = useTranslation();
  const [pickupDraft, setPickupDraft] = useState<PlaceSelection | null>(null);
  const [dropoffDraft, setDropoffDraft] = useState<PlaceSelection | null>(null);
  const [stopoverDraft, setStopoverDraft] = useState<PlaceSelection | null>(null);
  const [stopoverSuggestions, setStopoverSuggestions] = useState<StopoverSuggestion[]>([]);
  const [selectedStopoverSuggestion, setSelectedStopoverSuggestion] = useState<StopoverSuggestion | null>(null);
  const [loadingStopoverSuggestions, setLoadingStopoverSuggestions] = useState(false);
  const [loadedStopoverSuggestions, setLoadedStopoverSuggestions] = useState(false);
  const [pickupInputKey, setPickupInputKey] = useState(0);
  const [dropoffInputKey, setDropoffInputKey] = useState(0);
  const [stopoverInputKey, setStopoverInputKey] = useState(0);
  const [activePointSection, setActivePointSection] = useState<'pickups' | 'stopovers' | 'dropoffs'>('pickups');
  const [pointError, setPointError] = useState('');
  const [pointNotice, setPointNotice] = useState('');

  const selectedPolyline = state.selectedRouteIndex !== null ? state.routes[state.selectedRouteIndex]?.polyline : undefined;
  const [meetingPointPolyline, setMeetingPointPolyline] = useState(selectedPolyline);
  const [meetingPointRouteLoading, setMeetingPointRouteLoading] = useState(false);

  useEffect(() => {
    setMeetingPointPolyline(selectedPolyline);
    const meetingPoints = [...state.pickups, ...state.stopovers, ...state.dropoffs];
    if (!state.origin || !state.destination || meetingPoints.length === 0) {
      setMeetingPointRouteLoading(false);
      return;
    }

    let cancelled = false;
    setMeetingPointRouteLoading(true);
    const timeoutId = window.setTimeout(() => {
      mapsApi.computeRoute({
        origin: { latitude: state.origin!.lat, longitude: state.origin!.lng },
        destination: { latitude: state.destination!.lat, longitude: state.destination!.lng },
        waypoints: meetingPoints.map((point) => ({ latitude: point.lat, longitude: point.lng })),
        travelMode: 'DRIVE',
      })
        .then((response) => {
          if (cancelled) return;
          const routedPolyline = response.data?.[0]?.routes?.[0]?.polyline?.encodedPolyline;
          setMeetingPointPolyline(routedPolyline || selectedPolyline);
        })
        .catch(() => {
          if (!cancelled) setMeetingPointPolyline(selectedPolyline);
        })
        .finally(() => {
          if (!cancelled) setMeetingPointRouteLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [selectedPolyline, state.origin, state.destination, state.pickups, state.stopovers, state.dropoffs]);

  useEffect(() => {
    if (!loadedStopoverSuggestions) {
      setLoadingStopoverSuggestions(true);
      publishRideApi.getStopoverSuggestions()
        .then((res) => { setStopoverSuggestions(res.data.suggestions || []); })
        .catch(() => { setStopoverSuggestions([]); })
        .finally(() => {
          setLoadingStopoverSuggestions(false);
          setLoadedStopoverSuggestions(true);
        });
    }
  }, [loadedStopoverSuggestions]);

  function toLocationInput(place: PlaceSelection, parent?: PlaceSelection | StopoverSuggestion | null): LocationInput {
    return {
      placeId: place.placeId,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      ...(parent ? {
        parentPlaceId: parent.placeId,
        parentAddress: parent.address,
        parentLat: parent.lat,
        parentLng: parent.lng,
      } : {}),
    };
  }

  function addSelection(
    key: 'pickups' | 'dropoffs' | 'stopovers',
    place: PlaceSelection | null,
    maxSelections: number,
    clearDraft: () => void,
  ) {
    if (!place) return;
    setPointError('');
    setPointNotice('');
    const selected = state[key];
    const exists = selected.some((item) => item.placeId === place.placeId);
    if (exists) {
      setPointError(t('publish.meetingPointAlreadySelected'));
      return;
    }

    if (selected.length >= maxSelections) {
      const pointName = key === 'stopovers'
        ? t('publish.stopover').toLowerCase()
        : key === 'pickups'
          ? t('publish.pickup').toLowerCase()
          : t('publish.dropoff').toLowerCase();
      setPointError(t('publish.maxPointLimit', { max: maxSelections, type: pointName }));
      return;
    }

    const parent = key === 'pickups' ? state.origin : key === 'dropoffs' ? state.destination : selectedStopoverSuggestion;
    if (!parent) {
      setPointError(t('publish.selectParentBeforePoint'));
      return;
    }
    const limitKm = key === 'stopovers' ? STOPOVER_POINT_RADIUS_KM : CITY_POINT_RADIUS_KM;
    const selectedDistanceKm = distanceKm(parent, place);
    if (selectedDistanceKm > limitKm) {
      setPointError(t('publish.pointTooFarFromParent', {
        distance: selectedDistanceKm.toFixed(1),
        limit: limitKm,
        parent: parent.address.split(',')[0],
      }));
      return;
    }
    if (selectedPolyline) {
      const routeDistanceKm = distanceFromRouteKm(place, selectedPolyline);
      if (routeDistanceKm > ROUTE_POINT_RADIUS_KM) {
        setPointError(t('publish.pointTooFarFromRoute', {
          distance: routeDistanceKm.toFixed(1),
          limit: ROUTE_POINT_RADIUS_KM,
        }));
        return;
      }
    }

    onChange({ [key]: [...selected, toLocationInput(place, parent)] } as Partial<WizardState>);
    setPointNotice(t('publish.pointAdded', {
      type: key === 'stopovers' ? t('publish.stopover') : key === 'pickups' ? t('publish.pickup') : t('publish.dropoff'),
    }));
    clearDraft();
  }

  function removeSelection(
    key: 'pickups' | 'dropoffs' | 'stopovers',
    placeId: string,
  ) {
    onChange({ [key]: state[key].filter((item) => item.placeId !== placeId) } as Partial<WizardState>);
  }

  function renderSelectedList(
    items: LocationInput[],
    key: 'pickups' | 'dropoffs' | 'stopovers',
    emptyLabel: string,
  ) {
    if (items.length === 0) {
      return <p className="text-xs text-deliivo-gray">{emptyLabel}</p>;
    }

    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${key}-${item.placeId}`} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-deliivo-orange shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-deliivo-dark">{item.address}</p>
              {item.parentAddress && (
                <p className="truncate text-xs text-deliivo-gray">{t('publish.nearParent', { parent: item.parentAddress.split(',')[0] })}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeSelection(key, item.placeId)}
              className="rounded-full px-3 py-1 text-xs font-medium text-deliivo-gray transition-colors hover:bg-red-50 hover:text-red-600"
            >
              {t('common.remove')}
            </button>
          </div>
        ))}
      </div>
    );
  }

  function renderStepHeader(
    stepNumber: string,
    title: string,
    helper: string,
    countLabel: string,
  ) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-deliivo-orange">
            {stepNumber}
          </div>
          <div>
            <p className="text-sm font-semibold text-deliivo-dark">{title}</p>
            <p className="text-xs text-deliivo-gray">{helper}</p>
          </div>
        </div>
        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-deliivo-orange">
          {countLabel}
        </span>
      </div>
    );
  }

  const pointSections = [
    { key: 'pickups' as const, label: t('publish.pickup'), count: state.pickups.length, max: MAX_ORIGIN_PICKUPS },
    { key: 'stopovers' as const, label: t('publish.stopover'), count: state.stopovers.length, max: MAX_STOPOVERS },
    { key: 'dropoffs' as const, label: t('publish.dropoff'), count: state.dropoffs.length, max: MAX_DESTINATION_DROPOFFS },
  ];
  const activeSectionIndex = pointSections.findIndex((section) => section.key === activePointSection);

  function movePointSection(direction: -1 | 1) {
    const nextIndex = Math.min(pointSections.length - 1, Math.max(0, activeSectionIndex + direction));
    setActivePointSection(pointSections[nextIndex].key);
  }

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="lg:hidden">
        <h2 className="text-xl font-bold text-deliivo-dark">{t('publish.meetingPointsTitle')}</h2>
        <p className="mt-1 text-sm text-deliivo-gray">{t('publish.meetingPointsCopy')}</p>
      </div>

      <div className="relative h-56 w-full lg:col-start-2 lg:row-start-1 lg:h-[520px] lg:self-start">
        <GoogleMap
          polyline={meetingPointPolyline}
          markers={[
            ...(state.origin ? [{ lat: state.origin.lat, lng: state.origin.lng, color: 'green' as const }] : []),
            ...(state.destination ? [{ lat: state.destination.lat, lng: state.destination.lng, color: 'red' as const }] : []),
            ...state.pickups.map(s => ({ lat: s.lat, lng: s.lng, color: 'green' as const })),
            ...state.dropoffs.map(s => ({ lat: s.lat, lng: s.lng, color: 'red' as const })),
            ...state.stopovers.map(s => ({ lat: s.lat, lng: s.lng, color: 'blue' as const })),
          ]}
          center={ESTONIA_MAP_CENTER}
          zoom={7}
          className="h-full w-full rounded-2xl"
        />
        {meetingPointRouteLoading && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-deliivo-gray shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-deliivo-orange" /> {t('publish.updatingRoadPath')}
          </span>
        )}
      </div>

      <div className="space-y-5 lg:col-start-1 lg:row-start-1">
      <div className="hidden lg:block">
        <h2 className="text-xl font-bold text-deliivo-dark">{t('publish.meetingPointsTitle')}</h2>
        <p className="mt-1 text-sm text-deliivo-gray">{t('publish.meetingPointsCopy')}</p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-900">{t('publish.meetingPointsRequirement')}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${state.pickups.length > 0 ? 'bg-green-100 text-green-700' : 'bg-white text-amber-800'}`}>
            {state.pickups.length > 0 ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {t('publish.pickupRequired')}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${state.dropoffs.length > 0 ? 'bg-green-100 text-green-700' : 'bg-white text-amber-800'}`}>
            {state.dropoffs.length > 0 ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {t('publish.dropoffRequired')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
            {t('publish.stopoversOptional')}
          </span>
        </div>
      </div>

      <div className="hidden">
        <p className="text-sm font-semibold text-deliivo-dark">{t('publish.routePointFlowTitle')}</p>
        <p className="mt-1 text-xs leading-5 text-deliivo-gray">{t('publish.routePointFlowCopy')}</p>
      </div>

      <div className="hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            Start area pickups
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            In-route stopovers
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            Destination drop-offs
          </span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="rounded-2xl bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-gray">Route order</p>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">1</div>
                <div>
                  <p className="text-sm font-semibold text-deliivo-dark">{t('publish.originPickupPoints')}</p>
                  <p className="text-xs text-deliivo-gray">Choose where riders can join near the starting area.</p>
                </div>
              </div>
              <div className="ml-3 h-6 w-0.5 bg-gray-200" />
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</div>
                <div>
                  <p className="text-sm font-semibold text-deliivo-dark">{t('publish.stopoverPoints')}</p>
                  <p className="text-xs text-deliivo-gray">Add only route stops that sit between origin and destination.</p>
                </div>
              </div>
              <div className="ml-3 h-6 w-0.5 bg-gray-200" />
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">3</div>
                <div>
                  <p className="text-sm font-semibold text-deliivo-dark">{t('publish.destinationDropoffPoints')}</p>
                  <p className="text-xs text-deliivo-gray">Finish with exact points where riders can leave near the destination.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-gray">Current route structure</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-deliivo-dark">
              <span className="rounded-full bg-green-50 px-3 py-1 font-medium">{state.origin?.address?.split(',')[0] || 'Origin'}</span>
              <span className="text-deliivo-gray">→</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 font-medium">{state.stopovers.length > 0 ? `${state.stopovers.length} stopover point${state.stopovers.length === 1 ? '' : 's'}` : 'No stopover selected'}</span>
              <span className="text-deliivo-gray">→</span>
              <span className="rounded-full bg-red-50 px-3 py-1 font-medium">{state.destination?.address?.split(',')[0] || 'Destination'}</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-deliivo-gray">
              Riders will see these points as structured boarding and drop-off choices, so keep them tied to the real route instead of adding unrelated places.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-100 p-1.5">
        {pointSections.map((section, index) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActivePointSection(section.key)}
            className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors ${activePointSection === section.key ? 'bg-white text-deliivo-dark shadow-sm' : 'text-deliivo-gray hover:text-deliivo-dark'}`}
          >
            <span className="block">{index + 1}. {section.label}</span>
            <span className="mt-0.5 block text-[11px] font-medium text-deliivo-orange">{section.count}/{section.max}</span>
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        {pointError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {pointError}
          </div>
        )}
        {pointNotice && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-700">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> {pointNotice}
          </div>
        )}
        <section className={`${activePointSection === 'pickups' ? '' : 'hidden'} space-y-3`}>
          {renderStepHeader(
            '1',
            t('publish.originPickupPoints'),
            t('publish.originPickupSearchCopy', { count: MAX_ORIGIN_PICKUPS }),
            t('publish.selectedCount', { count: state.pickups.length, max: MAX_ORIGIN_PICKUPS }),
          )}
          <div className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-800">
            <span className="font-semibold">{t('publish.originContext')}:</span> {state.origin?.address || t('publish.notSelected')} | {t('publish.withinRadiusKm', { radius: CITY_POINT_RADIUS_KM })}
          </div>
          {renderSelectedList(state.pickups, 'pickups', t('publish.noPickupPointsSelected'))}
          {state.pickups.length < MAX_ORIGIN_PICKUPS && (
            <div className="space-y-3">
              <PlaceInput
                key={`pickup-${pickupInputKey}`}
                value={pickupDraft}
                onChange={setPickupDraft}
                placeholder={t('publish.searchPickupPoint')}
                icon={<MapPin className="h-4 w-4 text-deliivo-orange" />}
                bias={state.origin ? { lat: state.origin.lat, lng: state.origin.lng, radiusKm: CITY_POINT_RADIUS_KM } : undefined}
              />
              <button
                type="button"
                onClick={() => addSelection('pickups', pickupDraft, MAX_ORIGIN_PICKUPS, () => {
                  setPickupDraft(null);
                  setPickupInputKey((value) => value + 1);
                })}
                disabled={!pickupDraft}
                className="btn-secondary w-full justify-center py-3 disabled:opacity-50"
              >
                {t('publish.addPickup')}
              </button>
            </div>
          )}
        </section>

        <section className={`${activePointSection === 'stopovers' ? '' : 'hidden'} space-y-3`}>
          {renderStepHeader(
            '2',
            t('publish.stopoverPoints'),
            t('publish.stopoverSearchCopy', { count: MAX_STOPOVERS }),
            t('publish.selectedCount', { count: state.stopovers.length, max: MAX_STOPOVERS }),
          )}
          <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <span className="font-semibold">{t('publish.selectedStopoverContext')}:</span> {selectedStopoverSuggestion?.address || t('publish.chooseSuggestedStopover')} | {t('publish.withinRadiusKm', { radius: STOPOVER_POINT_RADIUS_KM })}
          </div>
          {loadingStopoverSuggestions ? (
            <div className="flex items-center gap-2 py-2 text-sm text-deliivo-gray">
              <Loader2 className="h-4 w-4 animate-spin text-deliivo-orange" />
              <span>{t('publish.loadingStopovers')}</span>
            </div>
          ) : stopoverSuggestions.length > 0 ? (
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('publish.suggestedStopovers')}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
              {stopoverSuggestions.map((suggestion) => {
                const selected = selectedStopoverSuggestion?.placeId === suggestion.placeId;
                return (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    onClick={() => setSelectedStopoverSuggestion(suggestion)}
                    className={`flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      selected
                        ? 'border-deliivo-orange bg-deliivo-orange-light'
                        : 'border-gray-100 bg-white hover:border-primary-200'
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${selected ? 'bg-deliivo-orange text-white' : 'bg-gray-100 text-deliivo-gray'}`}>
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-deliivo-dark">{suggestion.name}</p>
                      <p className="mt-0.5 break-words text-xs leading-4 text-deliivo-gray">{suggestion.address}</p>
                    </div>
                    {selected && <CheckCircle className="h-5 w-5 text-deliivo-orange shrink-0" />}
                  </button>
                );
              })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-deliivo-gray">{t('publish.noSuggestedStopovers')}</p>
          )}
          {renderSelectedList(state.stopovers, 'stopovers', t('publish.noStopoverSelected'))}
          {state.stopovers.length < MAX_STOPOVERS && (
            <div className="space-y-3">
              {selectedStopoverSuggestion && (
                <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-deliivo-dark">
                  <span className="font-semibold">{t('publish.selectedStopoverCity')}:</span> {selectedStopoverSuggestion.address}
                </div>
              )}
              <PlaceInput
                key={`stopover-${stopoverInputKey}`}
                value={stopoverDraft}
                onChange={setStopoverDraft}
                placeholder={t('publish.searchStopoverPoint')}
                icon={<MapPin className="h-4 w-4 text-deliivo-orange" />}
                bias={selectedStopoverSuggestion ? { lat: selectedStopoverSuggestion.lat, lng: selectedStopoverSuggestion.lng, radiusKm: STOPOVER_POINT_RADIUS_KM } : undefined}
              />
              <button
                type="button"
                onClick={() => addSelection('stopovers', stopoverDraft, MAX_STOPOVERS, () => {
                  setStopoverDraft(null);
                  setStopoverInputKey((value) => value + 1);
                  setSelectedStopoverSuggestion(null);
                })}
                disabled={!stopoverDraft || !selectedStopoverSuggestion}
                className="btn-secondary w-full justify-center py-3 disabled:opacity-50"
              >
                {t('publish.addStopover')}
              </button>
            </div>
          )}
        </section>

        <section className={`${activePointSection === 'dropoffs' ? '' : 'hidden'} space-y-3`}>
          {renderStepHeader(
            '3',
            t('publish.destinationDropoffPoints'),
            t('publish.destinationDropoffSearchCopy', { count: MAX_DESTINATION_DROPOFFS }),
            t('publish.selectedCount', { count: state.dropoffs.length, max: MAX_DESTINATION_DROPOFFS }),
          )}
          <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
            <span className="font-semibold">{t('publish.destinationContext')}:</span> {state.destination?.address || t('publish.notSelected')} | {t('publish.withinRadiusKm', { radius: CITY_POINT_RADIUS_KM })}
          </div>
          {renderSelectedList(state.dropoffs, 'dropoffs', t('publish.noDropoffPointsSelected'))}
          {state.dropoffs.length < MAX_DESTINATION_DROPOFFS && (
            <div className="space-y-3">
              <PlaceInput
                key={`dropoff-${dropoffInputKey}`}
                value={dropoffDraft}
                onChange={setDropoffDraft}
                placeholder={t('publish.searchDropoffPoint')}
                icon={<MapPin className="h-4 w-4 text-deliivo-orange" />}
                bias={state.destination ? { lat: state.destination.lat, lng: state.destination.lng, radiusKm: CITY_POINT_RADIUS_KM } : undefined}
              />
              <button
                type="button"
                onClick={() => addSelection('dropoffs', dropoffDraft, MAX_DESTINATION_DROPOFFS, () => {
                  setDropoffDraft(null);
                  setDropoffInputKey((value) => value + 1);
                })}
                disabled={!dropoffDraft}
                className="btn-secondary w-full justify-center py-3 disabled:opacity-50"
              >
                {t('publish.addDropoff')}
              </button>
            </div>
          )}
        </section>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
          <button type="button" onClick={() => movePointSection(-1)} disabled={activeSectionIndex === 0} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-deliivo-gray hover:bg-gray-50 disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-xs text-deliivo-gray">{activeSectionIndex + 1} of {pointSections.length}</span>
          <button type="button" onClick={() => movePointSection(1)} disabled={activeSectionIndex === pointSections.length - 1} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-deliivo-orange hover:bg-orange-50 disabled:opacity-30">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {(state.pickups.length > 0 || state.stopovers.length > 0 || state.dropoffs.length > 0) && (
        <div className="hidden">
          <p className="text-sm font-semibold text-deliivo-dark mb-3">{t('publish.selectedRoutePoints')}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">{t('publish.originPickupPoints')}</p>
              <div className="mt-2 space-y-2">
                {state.pickups.length > 0 ? state.pickups.map((item, index) => (
                  <div key={`pickup-${item.placeId}`} className="flex items-start gap-2 text-sm text-deliivo-dark">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-700">{index + 1}</span>
                    <span className="min-w-0 flex-1 break-words">{item.address}</span>
                  </div>
                )) : <p className="text-xs text-deliivo-gray">{t('publish.noPickupPointsSelected')}</p>}
              </div>
            </div>
            <div className="rounded-xl bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{t('publish.stopoverPoints')}</p>
              <div className="mt-2 space-y-2">
                {state.stopovers.length > 0 ? state.stopovers.map((item, index) => (
                  <div key={`stopover-${item.placeId}`} className="flex items-start gap-2 text-sm text-deliivo-dark">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">{index + 1}</span>
                    <span className="min-w-0 flex-1 break-words">{item.address}</span>
                  </div>
                )) : <p className="text-xs text-deliivo-gray">{t('publish.noStopoverSelected')}</p>}
              </div>
            </div>
            <div className="rounded-xl bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">{t('publish.destinationDropoffPoints')}</p>
              <div className="mt-2 space-y-2">
                {state.dropoffs.length > 0 ? state.dropoffs.map((item, index) => (
                  <div key={`dropoff-${item.placeId}`} className="flex items-start gap-2 text-sm text-deliivo-dark">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-[11px] font-bold text-red-700">{index + 1}</span>
                    <span className="min-w-0 flex-1 break-words">{item.address}</span>
                  </div>
                )) : <p className="text-xs text-deliivo-gray">{t('publish.noDropoffPointsSelected')}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ─── Step 3: Date & Time ──────────────────────────────────────────────────────

function StepDateTime({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const { t, locale } = useTranslation();
  const today = new Date();
  const [viewYear, setViewYear] = useState(
    state.date ? parseInt(state.date.split("-")[0]) : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    state.date ? parseInt(state.date.split("-")[1]) - 1 : today.getMonth()
  );

  const calDays = buildCalendarDays(viewYear, viewMonth);

  const selectedDate = state.date ? new Date(state.date + "T00:00:00") : null;

  function selectDay(day: number | null) {
    if (!day) return;
    const d = new Date(viewYear, viewMonth, day);
    if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return;
    onChange({
      date: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const todayNum = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, index) => index);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(viewYear, viewMonth, 1));
  const dayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const dayLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2024, 0, 7 + index);
    return dayFormatter.format(date);
  });
  const departureTooSoon = isPublishScheduleTooSoon(state.date, state.hour, state.minute);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-deliivo-dark">{t('publish.selectTravelDate')}</h2>
        <p className="mt-1 text-sm text-deliivo-gray">{t('publish.pickDateTime')}</p>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-deliivo-gray hover:bg-primary-50 hover:text-deliivo-orange transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-deliivo-dark">{monthLabel} {viewYear}</span>
          <button type="button" onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-deliivo-gray hover:bg-primary-50 hover:text-deliivo-orange transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center">
          {dayLabels.map((d) => (
            <div key={d} className="py-1 text-[11px] font-semibold uppercase tracking-wide text-deliivo-gray">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {calDays.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const cellDate = new Date(viewYear, viewMonth, day);
            const isPast = cellDate < new Date(todayYear, todayMonth, todayNum);
            const isToday = day === todayNum && viewMonth === todayMonth && viewYear === todayYear;
            const isSelected = selectedDate && day === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear();

            return (
              <button
                key={day}
                type="button"
                disabled={isPast}
                onClick={() => selectDay(day)}
                className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-150 ${
                  isSelected ? "bg-deliivo-orange text-white shadow-sm shadow-deliivo-orange/30"
                    : isToday ? "border border-deliivo-orange text-deliivo-orange"
                    : isPast ? "cursor-not-allowed text-gray-300"
                    : "text-deliivo-dark hover:bg-primary-50 hover:text-deliivo-orange"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time picker */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-deliivo-dark">
          <Clock className="h-4 w-4 text-deliivo-orange" />
          {t('publish.departureTime')}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('publish.hour')}</label>
            <select value={state.hour} onChange={(e) => onChange({ hour: parseInt(e.target.value) })} className="input-field pr-8">
              {hours.map((h) => (<option key={h} value={h}>{String(h).padStart(2, "0")}</option>))}
            </select>
          </div>
          <span className="mt-5 text-xl font-bold text-deliivo-dark">:</span>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('publish.minute')}</label>
            <select value={state.minute} onChange={(e) => onChange({ minute: parseInt(e.target.value) })} className="input-field pr-8">
              {minutes.map((m) => (<option key={m} value={m}>{String(m).padStart(2, "0")}</option>))}
            </select>
          </div>
        </div>
        {state.date && departureTooSoon && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Select a departure time at least 3 hours from now. You can publish a ride for today when this lead time is available.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Seats & Preferences ──────────────────────────────────────────────

function StepSeats({
  state,
  onChange,
  userGender,
  onLeaveForVehicle,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  userGender?: string | null;
  onLeaveForVehicle: () => void;
}) {
  const { t, locale } = useTranslation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  useEffect(() => {
    vehicleApi.list()
      .then(res => { setVehicles(res.data?.vehicles || []); })
      .catch(() => {})
      .finally(() => setVehiclesLoading(false));
  }, []);
  function counter(label: string, value: number, min: number, max: number, onInc: () => void, onDec: () => void, sublabel?: string) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-deliivo-dark">{label}</p>
          {sublabel && <p className="text-xs text-deliivo-gray">{sublabel}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" disabled={value <= min} onClick={onDec} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-deliivo-gray transition-colors hover:border-deliivo-orange hover:text-deliivo-orange disabled:opacity-30 disabled:cursor-not-allowed">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-5 text-center text-base font-bold text-deliivo-dark">{value}</span>
          <button type="button" disabled={value >= max} onClick={onInc} className="flex h-8 w-8 items-center justify-center rounded-full border border-deliivo-orange bg-deliivo-orange-light text-deliivo-orange transition-colors hover:bg-deliivo-orange hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  function toggle(label: string, checked: boolean, onToggle: () => void, sublabel?: string) {
    return (
      <button type="button" onClick={onToggle} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 shadow-sm text-left transition-all duration-150 ${checked ? "border-deliivo-orange bg-deliivo-orange-light" : "border-gray-100 bg-white"}`}>
        <div>
          <p className="text-sm font-semibold text-deliivo-dark">{label}</p>
          {sublabel && <p className="text-xs text-deliivo-gray">{sublabel}</p>}
        </div>
        <div className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? "bg-deliivo-orange" : "bg-gray-200"}`}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
        </div>
      </button>
    );
  }

  const luggageLabels = [
    t('publish.luggageNone'),
    t('publish.luggageSmall'),
    t('publish.luggageMedium'),
    t('publish.luggageLarge'),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="order-1">
        <h2 className="text-xl font-bold text-deliivo-dark">{t('publish.offerSeats')}</h2>
        <p className="mt-1 text-sm text-deliivo-gray">{t('publish.configureSeats')}</p>
      </div>

      <div className="order-3 space-y-3">
        {counter(t('publish.passengers'), state.seats, 1, 10, () => onChange({ seats: state.seats + 1 }), () => onChange({ seats: state.seats - 1 }), t('publish.seatsAvailableForRiders'))}
        {counter(t('publish.maxLuggage'), state.maxLuggage, 0, 3, () => onChange({ maxLuggage: state.maxLuggage + 1 }), () => onChange({ maxLuggage: state.maxLuggage - 1 }), luggageLabels[state.maxLuggage])}
      </div>

      {/* Vehicle display */}
      <div className="order-2">
      {vehiclesLoading ? (
        <div className="flex items-center gap-2 text-sm text-deliivo-gray"><Loader2 className="h-4 w-4 animate-spin" /> {t('publish.loadingVehicles')}</div>
      ) : vehicles.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-deliivo-dark">{t('publish.yourVehicle')}</p>
            <Link href="/profile/vehicle?returnTo=%2Fpublish" onClick={onLeaveForVehicle} className="text-xs font-semibold text-deliivo-orange underline underline-offset-2 hover:text-deliivo-orange-dark">
              {t('publish.manageVehicles')}
            </Link>
          </div>
          <div className="rounded-2xl border border-deliivo-orange bg-deliivo-orange-light px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                {vehicles[0].imageUrl ? <img src={vehicles[0].imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover" /> : <Luggage className="w-5 h-5 text-gray-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-deliivo-dark">{[vehicles[0].brand, vehicles[0].model_name].filter(Boolean).join(' ') || t('publish.vehicleFallback')}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${vehicles[0].isVerified ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {vehicles[0].isVerified ? t('publish.verifiedVehicle') : t('publish.notVerifiedYet')}
                  </span>
                </div>
                <p className="text-xs text-deliivo-gray">{[vehicles[0].color, vehicles[0].year].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-deliivo-gray">
              <span className="rounded-full bg-white/80 px-3 py-1">{t('publish.savedVehicleCount', { count: vehicles.length })}</span>
              <span className="rounded-full bg-white/80 px-3 py-1">{t('publish.savedVehicleFlow')}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-semibold text-amber-950">{t('publish.noVehicleFound')}</p>
          <p className="mt-1 text-xs text-amber-800">{t('publish.addVehicleBeforeSeats')}</p>
          <Link href="/profile/vehicle?returnTo=%2Fpublish&add=1" onClick={onLeaveForVehicle} className="mt-3 inline-flex rounded-full bg-deliivo-orange px-4 py-2 text-sm font-semibold text-white hover:bg-deliivo-orange-dark">
            {t('profile.addVehicle')}
          </Link>
        </div>
      )}
      </div>

      <div className="order-4 space-y-3">
        {userGender === 'FEMALE' && toggle(
          t('publish.womenOnly'),
          state.femaleOnly,
          () => {
            onChange({ femaleOnly: !state.femaleOnly });
          },
          t('publish.womenOnlyCopy')
        )}
        {toggle(t('publish.noSmoking'), state.noSmoking, () => onChange({ noSmoking: !state.noSmoking }), t('publish.noSmokingCopy'))}
        {toggle(t('publish.alcoholFreeRide'), state.alcoholFreeRide, () => onChange({ alcoholFreeRide: !state.alcoholFreeRide }), t('publish.alcoholFreeRideCopy'))}
        {toggle(t('publish.childSeatAvailable'), state.childSeatAvailable, () => onChange({ childSeatAvailable: !state.childSeatAvailable }), t('publish.childSeatAvailableCopy'))}
        {toggle(t('publish.noBicycles'), state.noBicycles, () => onChange({ noBicycles: !state.noBicycles }), t('publish.noBicyclesCopy'))}
      </div>
    </div>
  );
}

// ─── Step 4: Price ────────────────────────────────────────────────────────────

function StepPrice({
  state,
  onChange,
  loading,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const rec = state.recommendation;
  const currency = rec?.currency || 'EUR';
  const grossFullRideFare = state.basePricePerSeat * state.seats;
  const recommendationAdjusted = Boolean(
    rec && Math.abs(rec.breakdown.estimatedRouteCost - rec.recommendedPrice) >= 0.01
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-deliivo-dark">{t('publish.setPricePerSeat')}</h2>
        <p className="mt-1 text-sm text-deliivo-gray">{t('publish.fairPrice')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-deliivo-orange" />
          <span className="ml-2 text-sm text-deliivo-gray">{t('publish.calculatingRecommendedPrice')}</span>
        </div>
      ) : rec ? (
        <div className="overflow-hidden rounded-2xl border border-primary-100 bg-primary-50">
          <div className="flex items-start justify-between gap-4 border-b border-primary-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Euro className="h-5 w-5 shrink-0 text-deliivo-orange" />
              <div>
                <p className="text-sm font-semibold text-deliivo-dark">{t('publish.distanceBasedRecommendation')}</p>
                <p className="text-xs text-deliivo-gray">{t('publish.driverPricingGuidance')}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold text-deliivo-orange">{rec.currency} {rec.recommendedPrice.toFixed(2)}</p>
              <p className="text-xs text-deliivo-gray">{t('publish.perSeat')}</p>
            </div>
          </div>
          <div className="space-y-2 px-4 py-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-deliivo-gray">{t('publish.routeDistance')}</span>
              <span className="font-medium text-deliivo-dark">{rec.breakdown.distanceKm.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-deliivo-gray">{t('publish.distanceRate')}</span>
              <span className="font-medium text-deliivo-dark">{rec.currency} {rec.breakdown.pricePerKm.toFixed(2)}/km</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-deliivo-gray">{t('publish.distanceEstimate')}</span>
              <span className="font-medium text-deliivo-dark">{rec.currency} {rec.breakdown.estimatedRouteCost.toFixed(2)}</span>
            </div>
            {recommendationAdjusted && (
              <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-deliivo-gray">
                {t('publish.pricingAdjustmentApplied')}
              </p>
            )}
            <div className="flex justify-between gap-4 border-t border-primary-100 pt-2">
              <span className="text-deliivo-gray">{t('publish.guidanceRange')}</span>
              <span className="font-semibold text-deliivo-dark">{rec.currency} {rec.minPrice.toFixed(2)} - {rec.maxPrice.toFixed(2)}</span>
            </div>
            {rec.breakdown.pricingConfigFallback && (
              <p className="text-xs text-amber-700">{t('publish.fallbackPricing')}</p>
            )}
          </div>
        </div>
      ) : null}

      {/* Price input */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-semibold text-deliivo-dark">{t('publish.pricePerSeat', { currency })}</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange({ basePricePerSeat: Math.max(1, state.basePricePerSeat - 1) })}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-deliivo-gray hover:border-deliivo-orange hover:text-deliivo-orange"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            min={0}
            step={0.5}
            value={state.basePricePerSeat}
            onChange={(e) => onChange({ basePricePerSeat: parseFloat(e.target.value) || 0 })}
            className="w-28 rounded-xl border border-gray-200 bg-deliivo-orange-light px-4 py-2.5 text-center text-lg font-bold text-deliivo-orange focus:border-deliivo-orange focus:outline-none focus:ring-2 focus:ring-deliivo-orange/20"
          />
          <button
            type="button"
            onClick={() => onChange({ basePricePerSeat: state.basePricePerSeat + 1 })}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-deliivo-orange bg-deliivo-orange-light text-deliivo-orange hover:bg-deliivo-orange hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-2 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-deliivo-gray">{t('publish.yourFarePerRider')}</p>
            <p className="font-semibold text-deliivo-dark">{currency} {state.basePricePerSeat.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-deliivo-gray">{t('publish.allSeatsGrossFare', { seats: state.seats })}</p>
            <p className="font-semibold text-deliivo-dark">{currency} {grossFullRideFare.toFixed(2)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-deliivo-gray">{t('publish.grossFareNotice')}</p>
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-semibold text-deliivo-dark">{t('publish.notesOptional')}</label>
        <textarea
          value={state.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={t('publish.anySpecialInstructions')}
          maxLength={150}
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-deliivo-dark placeholder:text-deliivo-gray focus:border-deliivo-orange focus:outline-none focus:ring-2 focus:ring-deliivo-orange/20 resize-none"
        />
        <p className="mt-1 text-xs text-deliivo-gray text-right">{state.notes.length}/150</p>
      </div>
    </div>
  );
}

// ─── Step 5: Confirm ──────────────────────────────────────────────────────────

function StepConfirm({
  state,
  onPublish,
  publishing,
  error,
  payoutStatus,
  payoutLoading,
  onStartPayoutSetup,
  payoutSetupLoading,
}: {
  state: WizardState;
  onPublish: (tosAccepted: boolean) => void;
  publishing: boolean;
  error: string;
  payoutStatus: ConnectStatus | null;
  payoutLoading: boolean;
  onStartPayoutSetup: () => void;
  payoutSetupLoading: boolean;
}) {
  const { t, locale } = useTranslation();
  const [tosChecked, setTosChecked] = useState(false);
  const payoutsReady = Boolean(payoutStatus?.onboardingComplete && payoutStatus?.payoutsEnabled);
  const dateLabel = state.date
    ? new Date(state.date + "T00:00:00").toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : t('publish.notSet');
  const timeLabel = `${String(state.hour).padStart(2, "0")}:${String(state.minute).padStart(2, "0")}`;
  const routeInfo = state.selectedRouteIndex !== null && state.routes[state.selectedRouteIndex]
    ? `${state.routes[state.selectedRouteIndex].distanceText} · ${state.routes[state.selectedRouteIndex].durationText}`
    : '';

  const rows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <MapPin className="h-4 w-4 text-deliivo-orange" />, label: t('publish.from'), value: state.origin?.address || "—" },
    { icon: <MapPin className="h-4 w-4 text-deliivo-orange-dark" />, label: t('publish.to'), value: state.destination?.address || "—" },
    { icon: <Route className="h-4 w-4 text-deliivo-orange" />, label: t('publish.route'), value: routeInfo || "—" },
    { icon: <Calendar className="h-4 w-4 text-deliivo-orange" />, label: t('publish.date'), value: dateLabel },
    { icon: <Clock className="h-4 w-4 text-deliivo-orange" />, label: t('publish.time'), value: timeLabel },
    { icon: <Users className="h-4 w-4 text-deliivo-orange" />, label: t('publish.seats'), value: `${state.seats} ${t('publish.passengerWord', { count: state.seats })}` },
    { icon: <Luggage className="h-4 w-4 text-deliivo-orange" />, label: t('publish.luggage'), value: t('publish.maxLuggageValue', { max: state.maxLuggage }) },
    { icon: <Euro className="h-4 w-4 text-deliivo-orange" />, label: t('publish.pricePerSeatLabel'), value: state.basePricePerSeat > 0 ? `${state.recommendation?.currency || 'EUR'} ${state.basePricePerSeat.toFixed(2)}` : t('publish.free') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-deliivo-dark">{t('publish.reviewYourRide')}</h2>
        <p className="mt-1 text-sm text-deliivo-gray">{t('publish.allGoodPublish')}</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-deliivo-orange to-primary-600 px-5 py-4">
          <p className="text-sm font-semibold text-white/80">{t('publish.yourRideSummary')}</p>
          <p className="text-lg font-bold text-white mt-0.5">
            {state.origin?.address?.split(',')[0] || t('publish.origin')} → {state.destination?.address?.split(',')[0] || t('publish.destination')}
          </p>
        </div>

        <ul className="divide-y divide-gray-50">
          {rows.map(({ icon, label, value }) => (
            <li key={label} className="flex items-center gap-3 px-5 py-3">
              <span className="shrink-0">{icon}</span>
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{label}</span>
              <span className="text-sm font-medium text-deliivo-dark truncate">{value}</span>
            </li>
          ))}
        </ul>

        {(state.femaleOnly || state.noSmoking || state.alcoholFreeRide || state.childSeatAvailable || state.noBicycles) && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-gray-50">
            {state.femaleOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
                <CheckCircle className="h-3 w-3" /> {t('publish.womenOnly')}
              </span>
            )}
            {state.noSmoking && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-deliivo-orange">
                <CigaretteOff className="h-3 w-3" /> {t('publish.noSmoking')}
              </span>
            )}
            {state.alcoholFreeRide && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-deliivo-orange">
                <CheckCircle className="h-3 w-3" /> {t('publish.alcoholFreeRide')}
              </span>
            )}
            {state.childSeatAvailable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <CheckCircle className="h-3 w-3" /> {t('publish.childSeatAvailable')}
              </span>
            )}
            {state.noBicycles && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-deliivo-orange">
                <Bike className="h-3 w-3" /> {t('publish.noBicycles')}
              </span>
            )}
          </div>
        )}

        {state.notes && (
          <div className="px-5 py-3 border-t border-gray-50">
            <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-gray mb-1">{t('publish.notes')}</p>
            <p className="text-sm text-deliivo-dark">{state.notes}</p>
          </div>
        )}
      </div>

      {/* Terms & Conditions checkbox */}
      <label className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm cursor-pointer">
        <input
          type="checkbox"
          checked={tosChecked}
          onChange={(e) => setTosChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-deliivo-orange focus:ring-deliivo-orange"
        />
        <span className="text-sm text-deliivo-dark">
          {t('publish.agreeTermsPrefix')}{' '}
          <a href="/terms" target="_blank" className="font-semibold text-deliivo-orange underline hover:text-deliivo-orange-dark">
            {t('publish.termsOfService')}
          </a>{' '}
          {t('publish.and')}{' '}
          <a href="/privacy" target="_blank" className="font-semibold text-deliivo-orange underline hover:text-deliivo-orange-dark">
            {t('publish.privacyPolicy')}
          </a>
        </span>
      </label>

      <div className={`rounded-2xl border px-4 py-4 shadow-sm ${
        payoutsReady ? 'border-green-100 bg-green-50' : 'border-amber-200 bg-amber-50'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            payoutsReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${payoutsReady ? 'text-green-900' : 'text-amber-900'}`}>
              {payoutsReady ? t('publish.payoutDetailsReady') : t('publish.payoutDetailsRequired')}
            </p>
            <p className={`mt-1 text-xs ${payoutsReady ? 'text-green-800' : 'text-amber-800'}`}>
              {payoutsReady ? t('publish.stripePayoutReadyCopy') : t('publish.payoutRequiredCopy')}
            </p>
            {!payoutsReady && (
              <button
                type="button"
                onClick={onStartPayoutSetup}
                disabled={payoutLoading || payoutSetupLoading}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-deliivo-orange px-4 py-2 text-sm font-semibold text-white hover:bg-deliivo-orange-dark disabled:opacity-50"
              >
                {payoutSetupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                {payoutSetupLoading ? t('publish.redirecting') : t('publish.setUpPayouts')}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onPublish(tosChecked)}
        disabled={publishing || !tosChecked || !payoutsReady}
        className="btn-primary w-full gap-2 py-4 text-base disabled:opacity-60"
      >
        {publishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
        {publishing ? t('publish.publishing') : t('publish.publishRide')}
      </button>

      <p className="text-center text-xs text-deliivo-gray leading-relaxed">
        {t('publish.oncePublished')}
      </p>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

const INITIAL_STATE: WizardState = {
  origin: null,
  destination: null,
  routes: [],
  selectedRouteIndex: null,
  pickups: [],
  dropoffs: [],
  stopovers: [],
  date: "",
  hour: 8,
  minute: 0,
  seats: 2,
  maxLuggage: 2,
  backSeatOnly: false,
  femaleOnly: false,
  noSmoking: true,
  alcoholFreeRide: false,
  noBicycles: false,
  childSeatAvailable: false,
  vehicleId: '',
  basePricePerSeat: 0,
  recommendation: null,
  notes: "",
};

let vehicleDetourState: { step: number; state: WizardState } | null = null;

function PublishRideWizard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [resumeState] = useState(() => {
    const saved = vehicleDetourState;
    vehicleDetourState = null;
    return saved;
  });
  const [step, setStep] = useState(resumeState?.step ?? 1);
  const [state, setState] = useState<WizardState>(resumeState?.state ?? INITIAL_STATE);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payoutStatus, setPayoutStatus] = useState<ConnectStatus | null>(null);
  const [payoutStatusLoading, setPayoutStatusLoading] = useState(false);
  const [payoutSetupLoading, setPayoutSetupLoading] = useState(false);
  const [vehicleStatus, setVehicleStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  function patch(update: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...update }));
    setError('');
  }

  useEffect(() => {
    loadPayoutStatus();
  }, []);

  const checkVehicleAvailability = useCallback(async () => {
    setVehicleStatus('loading');
    try {
      const res = await vehicleApi.list();
      setVehicleStatus((res.data?.vehicles || []).length > 0 ? 'ready' : 'missing');
    } catch {
      setVehicleStatus('error');
    }
  }, []);

  useEffect(() => {
    void checkVehicleAvailability();
  }, [checkVehicleAvailability]);

  useEffect(() => {
    if (!published) return;

    const timeoutId = window.setTimeout(() => {
      router.push('/rides?published=1');
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [published, router]);

  async function loadPayoutStatus() {
    setPayoutStatusLoading(true);
    try {
      const res = await paymentsApi.connectStatus();
      setPayoutStatus(res.data);
    } catch {
      setPayoutStatus(null);
    } finally {
      setPayoutStatusLoading(false);
    }
  }

  async function handleStartPayoutSetup() {
    setPayoutSetupLoading(true);
    setError('');
    try {
      const res = await paymentsApi.connectOnboard();
      window.location.href = res.data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('publish.failedStartPayoutSetup'));
      setPayoutSetupLoading(false);
    }
  }

  function canContinue(): boolean {
    if (step === 1) return state.origin !== null && state.destination !== null && state.selectedRouteIndex !== null;
    if (step === 2) return state.pickups.length > 0 && state.dropoffs.length > 0;
    if (step === 3) return state.date.length > 0 && !isPublishScheduleTooSoon(state.date, state.hour, state.minute);
    if (step === 4) return state.seats >= 1;
    if (step === 5) return state.basePricePerSeat > 0;
    return true;
  }

  // Step 1: After selecting both origin and destination, auto-compute routes
  // Also re-compute if origin or destination changes
  useEffect(() => {
    if (state.origin && state.destination) {
      handleComputeRoutes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.origin?.placeId, state.destination?.placeId]);

  async function handleComputeRoutes() {
    if (!state.origin || !state.destination) return;
    setLoading(true);
    setError('');
    // Clear previous routes so map updates
    setState(prev => ({
      ...prev,
      routes: [],
      selectedRouteIndex: null,
      pickups: [],
      dropoffs: [],
      stopovers: [],
    }));
    try {
      // Step 1: Create draft with origin
      await publishRideApi.createWithOrigin({
        originPlaceId: state.origin.placeId,
        originAddress: state.origin.address,
        originLat: state.origin.lat,
        originLng: state.origin.lng,
      });

      // Step 2: Set destination
      await publishRideApi.updateDestination({
        destinationPlaceId: state.destination.placeId,
        destinationAddress: state.destination.address,
        destinationLat: state.destination.lat,
        destinationLng: state.destination.lng,
      });

      // Step 3: Compute routes
      const res = await publishRideApi.computeRoutes();
      const routes = res.data.routes || [];
      const firstPublishableRoute = routes.find((route) => route.isPublishable !== false);
      if (firstPublishableRoute) {
        await publishRideApi.selectRoute(firstPublishableRoute.index);
      }
      setState(prev => ({
        ...prev,
        routes,
        selectedRouteIndex: firstPublishableRoute?.index ?? null,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('publish.failedComputeRoutes');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    if (step >= TOTAL_STEPS) return;
    setLoading(true);
    setError('');

    try {
      if (step === 1) {
        // Select route on backend
        if (state.selectedRouteIndex !== null) {
          await publishRideApi.selectRoute(state.selectedRouteIndex);
        }
      } else if (step === 2) {
        // Save stopovers to backend (even if empty — clears previous)
        await publishRideApi.updatePickups(state.pickups);
        await publishRideApi.updateDropoffs(state.dropoffs);
        await publishRideApi.updateStopovers(state.stopovers);
      } else if (step === 3) {
        // Save schedule to backend
        const departureTime = `${String(state.hour).padStart(2, "0")}:${String(state.minute).padStart(2, "0")}`;
        await publishRideApi.updateSchedule(state.date, departureTime);
      } else if (step === 4) {
        // Save capacity to backend
        await publishRideApi.updateCapacity(state.seats, state.maxLuggage, false, {
          noSmoking: state.noSmoking,
          alcoholFreeRide: state.alcoholFreeRide,
          noBicycles: state.noBicycles,
          childSeatAvailable: state.childSeatAvailable,
        });
        // Fetch recommended price
        try {
          const priceRes = await publishRideApi.getRecommendedPrice();
          const rec = priceRes.data;
          setState(prev => ({
            ...prev,
            recommendation: rec,
            basePricePerSeat: prev.basePricePerSeat || rec.recommendedPrice,
          }));
        } catch {
          // Price recommendation is optional; user can still set manually
        }
      }

      setStep((s) => s + 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('publish.genericError');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1);
    setError('');
  }

  async function selectRouteForPublish() {
    if (state.selectedRouteIndex === null) return;

    try {
      await publishRideApi.selectRoute(state.selectedRouteIndex);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.toLowerCase().includes('routes expired')) throw error;

      const refreshed = await publishRideApi.computeRoutes();
      const routes = refreshed.data.routes || [];
      const selected = routes.find((route) => route.index === state.selectedRouteIndex && route.isPublishable !== false)
        || routes.find((route) => route.isPublishable !== false);
      if (!selected) throw new Error(t('publish.noPublishableRoadRoute'));

      await publishRideApi.selectRoute(selected.index);
      setState((previous) => ({ ...previous, routes, selectedRouteIndex: selected.index }));
    }
  }

  async function handlePublish(tosAccepted: boolean) {
    setLoading(true);
    setError('');
    try {
      const latestPayoutStatus = payoutStatus ?? (await paymentsApi.connectStatus()).data;
      setPayoutStatus(latestPayoutStatus);
      if (!latestPayoutStatus.onboardingComplete || !latestPayoutStatus.payoutsEnabled) {
        throw new Error('Payout details are required before publishing a ride.');
      }

      // Accept Terms of Service
      if (tosAccepted) {
        await authApi.acceptTos('1.0', '1.0');
      }

      await selectRouteForPublish();

      await publishRideApi.updatePickups(state.pickups);
      await publishRideApi.updateDropoffs(state.dropoffs);
      await publishRideApi.updateStopovers(state.stopovers);

      if (state.date) {
        const departureTime = `${String(state.hour).padStart(2, "0")}:${String(state.minute).padStart(2, "0")}`;
        await publishRideApi.updateSchedule(state.date, departureTime);
      }

      await publishRideApi.updateCapacity(state.seats, state.maxLuggage, false, {
        noSmoking: state.noSmoking,
        alcoholFreeRide: state.alcoholFreeRide,
        noBicycles: state.noBicycles,
        childSeatAvailable: state.childSeatAvailable,
      });

      // Save pricing
      await publishRideApi.updatePricing(state.basePricePerSeat);

      // Save notes if any
      if (state.notes || state.femaleOnly) {
        await publishRideApi.updateNotes(state.notes || ' ', state.femaleOnly || undefined);
      }

      // Publish
      await publishRideApi.publish();
      vehicleDetourState = null;
      setPublished(true);
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : t('publish.failedPublishRide');
      if (message.includes('TOS_NOT_ACCEPTED')) message = t('publish.acceptTermsError');
      if (message.includes('DRIVER_NOT_VERIFIED')) message = t('publish.driverVerificationRequired');
      if (message.includes('NO_STRIPE_ACCOUNT') || message.includes('PAYOUT')) message = t('publish.payoutRequiredBeforePublish');
      if (message.includes('FEMALE_ONLY_NOT_ALLOWED')) message = t('publish.femaleOnlyNotAllowed');
      if (message.includes('NON_ROAD_ROUTE_NOT_ALLOWED')) message = t('publish.nonRoadRoute');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Published success screen ──
  if (published) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-deliivo-cream px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-deliivo-orange shadow-xl shadow-deliivo-orange/30">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-deliivo-dark">{t('publish.publishedTitle')}</h1>
          <p className="mb-8 text-deliivo-gray">{t('publish.publishedCopy')}</p>
          <div className="flex flex-col gap-3">
            <Link href="/rides" className="btn-primary w-full py-3 text-base">{t('publish.viewMyRides')}</Link>
          <button
              type="button"
              onClick={() => { vehicleDetourState = null; setState(INITIAL_STATE); setStep(1); setPublished(false); setError(''); }}
              className="btn-outline w-full py-3 text-base"
            >
              {t('publish.publishAnotherRide')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (vehicleStatus !== 'ready') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-deliivo-cream px-4 py-10">
        {vehicleStatus === 'loading' ? (
          <div className="flex items-center gap-3 text-sm font-medium text-deliivo-gray">
            <Loader2 className="h-5 w-5 animate-spin text-deliivo-orange" />
            {t('publish.checkingVehicle')}
          </div>
        ) : (
          <div className="w-full max-w-lg rounded-3xl border border-orange-100 bg-white p-7 text-center shadow-sm sm:p-9">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-deliivo-orange-light text-deliivo-orange">
              {vehicleStatus === 'missing' ? <Car className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
            </div>
            <h1 className="mt-5 text-2xl font-bold text-deliivo-dark">
              {vehicleStatus === 'missing' ? t('publish.vehicleGateMissingTitle') : t('publish.vehicleGateErrorTitle')}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-deliivo-gray">
              {vehicleStatus === 'missing'
                ? t('publish.vehicleGateMissingCopy')
                : t('publish.vehicleGateErrorCopy')}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/" className="btn-outline px-6 py-3 text-sm">{t('common.backHome')}</Link>
              {vehicleStatus === 'missing' ? (
                <Link
                  href="/profile/vehicle?returnTo=%2Fpublish&add=1"
                  onClick={() => { vehicleDetourState = { step, state }; }}
                  className="btn-primary px-6 py-3 text-sm"
                >
                  {t('profile.addVehicle')}
                </Link>
              ) : (
                <button type="button" onClick={() => void checkVehicleAvailability()} className="btn-primary px-6 py-3 text-sm">
                  {t('common.retry')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-deliivo-cream">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="relative mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          {step === 1 ? (
            <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-deliivo-gray hover:text-deliivo-dark transition-colors">
              <ArrowLeft className="h-4 w-4" /> {t('publish.back')}
            </Link>
          ) : (
            <button type="button" onClick={handleBack} className="flex items-center gap-1.5 text-sm font-medium text-deliivo-gray hover:text-deliivo-dark transition-colors">
              <ArrowLeft className="h-4 w-4" /> {t('publish.back')}
            </button>
          )}
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-deliivo-dark">{t('publish.title')}</span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="mx-auto max-w-lg">
          <StepIndicator steps={TOTAL_STEPS} current={step} labels={[t('publish.route'), t('publish.stops'), t('publish.date'), t('publish.seats'), t('publish.price'), t('publish.confirm')]} />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-4 py-6">
        <div className={`mx-auto ${step <= 2 ? 'max-w-5xl' : 'max-w-lg'}`}>
          {step === 1 && <StepRoute state={state} onChange={patch} error={error} />}
          {step === 2 && <StepStopovers state={state} onChange={patch} />}
          {step === 3 && <StepDateTime state={state} onChange={patch} />}
          {step === 4 && (
            <StepSeats
              state={state}
              onChange={patch}
              userGender={user?.gender}
              onLeaveForVehicle={() => { vehicleDetourState = { step, state }; }}
            />
          )}
          {step === 5 && <StepPrice state={state} onChange={patch} loading={loading} />}
          {step === 6 && (
            <StepConfirm
              state={state}
              onPublish={handlePublish}
              publishing={loading}
              error={error}
              payoutStatus={payoutStatus}
              payoutLoading={payoutStatusLoading}
              onStartPayoutSetup={handleStartPayoutSetup}
              payoutSetupLoading={payoutSetupLoading}
            />
          )}
        </div>
      </main>

      {/* Bottom navigation (not shown on step 5) */}
      {step < 6 && (
        <div className="sticky bottom-0 border-t border-gray-100 bg-white/90 backdrop-blur-sm px-4 py-4">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue() || loading}
              className="btn-primary w-full py-3.5 text-base gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t('publish.processing')}</>
              ) : (
                <>{step === 5 ? t('publish.reviewRide') : t('publish.continue')}<ChevronRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublishRidePage() {
  return (
    <ProtectedRoute>
      <PublishRideWizard />
    </ProtectedRoute>
  );
}
