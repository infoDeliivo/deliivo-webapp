'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, Loader2, MapPin, Plus, X } from 'lucide-react';
import GoogleMap from '@/components/GoogleMap';
import {
  mapsApi,
  publishRideApi,
  type LocationInput,
  type RouteOption,
  type StopoverSuggestion,
} from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';
import { distanceKm, distanceFromRouteKm } from '@/lib/meeting-point-distance';
import MeetingPointSearch, { type MeetingPlace } from './MeetingPointSearch';

type PointKind = 'pickups' | 'dropoffs' | 'stopovers';
type Points = Record<PointKind, LocationInput[]>;
type MeetingState = Points & {
  origin: MeetingPlace | null;
  destination: MeetingPlace | null;
  routes: RouteOption[];
  selectedRouteIndex: number | null;
};
const MAX_POINTS = 3;
const CITY_RADIUS = Number(process.env.NEXT_PUBLIC_PUBLISH_CITY_POINT_RADIUS_KM || '15');
const STOP_RADIUS = Number(process.env.NEXT_PUBLIC_PUBLISH_STOPOVER_POINT_RADIUS_KM || '5');
const ROUTE_RADIUS = Number(process.env.NEXT_PUBLIC_PUBLISH_ROUTE_POINT_RADIUS_KM || '10');

export default function PublishMeetingPoints({
  state,
  onChange,
}: {
  state: MeetingState;
  onChange: (patch: Partial<Points>) => void;
}) {
  const { t } = useTranslation();
  const [searching, setSearching] = useState<PointKind | null>(() =>
    !state.pickups.length ? 'pickups' : !state.dropoffs.length ? 'dropoffs' : null,
  );
  const [stopsOpen, setStopsOpen] = useState(state.stopovers.length > 0);
  const [city, setCity] = useState<StopoverSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<StopoverSuggestion[]>([]);
  const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [suggestionRetry, setSuggestionRetry] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [preview, setPreview] = useState<{ polyline?: string; failed: boolean; loading: boolean }>({
    failed: false,
    loading: false,
  });
  const [notice, setNotice] = useState('');
  const selectedPolyline = state.routes.find(
    (route) => route.index === state.selectedRouteIndex,
  )?.polyline;
  const labels = {
    pickups: t('publish.pickup'),
    dropoffs: t('publish.dropoff'),
    stopovers: t('publish.stopover'),
  };
  const placeholders = {
    pickups: t('publish.searchPickupPoint'),
    dropoffs: t('publish.searchDropoffPoint'),
    stopovers: t('publish.searchStopoverPoint'),
  };

  useEffect(() => {
    if (!stopsOpen) return;
    let active = true;
    publishRideApi
      .getStopoverSuggestions()
      .then(({ data }) => {
        if (active) {
          setSuggestions(data.suggestions || []);
          setSuggestionStatus('ready');
        }
      })
      .catch(() => {
        if (active) setSuggestionStatus('error');
      });
    return () => {
      active = false;
    };
  }, [stopsOpen, suggestionRetry]);

  useEffect(() => {
    if (!mapOpen || !state.origin || !state.destination) return;
    let active = true;
    const timer = setTimeout(() => {
      setPreview({ polyline: selectedPolyline, loading: true, failed: false });
      mapsApi
        .computeRoute({
          origin: { latitude: state.origin!.lat, longitude: state.origin!.lng },
          destination: { latitude: state.destination!.lat, longitude: state.destination!.lng },
          waypoints: [...state.pickups, ...state.stopovers, ...state.dropoffs].map((point) => ({
            latitude: point.lat,
            longitude: point.lng,
          })),
          travelMode: 'DRIVE',
        })
        .then(({ data }) => {
          if (!active) return;
          const polyline = data?.[0]?.routes?.[0]?.polyline?.encodedPolyline;
          setPreview({ polyline: polyline || selectedPolyline, loading: false, failed: !polyline });
        })
        .catch(() => {
          if (active) setPreview({ polyline: selectedPolyline, loading: false, failed: true });
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    mapOpen,
    selectedPolyline,
    state.origin,
    state.destination,
    state.pickups,
    state.dropoffs,
    state.stopovers,
  ]);

  function add(kind: PointKind, place: MeetingPlace) {
    const parent =
      kind === 'pickups' ? state.origin : kind === 'dropoffs' ? state.destination : city;
    if (!parent) return t('publish.selectParentBeforePoint');
    if (state[kind].some((point) => point.placeId === place.placeId))
      return t('publish.meetingPointAlreadySelected');
    if (state[kind].length >= MAX_POINTS)
      return t('publish.maxPointLimit', { max: MAX_POINTS, type: labels[kind] });
    const radius = kind === 'stopovers' ? STOP_RADIUS : CITY_RADIUS;
    const distance = distanceKm(parent, place);
    if (distance > radius)
      return t('publish.pointTooFarFromParent', {
        distance: distance.toFixed(1),
        limit: radius,
        parent: parent.address.split(',')[0],
      });
    if (selectedPolyline) {
      const routeDistance = distanceFromRouteKm(place, selectedPolyline);
      if (routeDistance > ROUTE_RADIUS)
        return t('publish.pointTooFarFromRoute', {
          distance: routeDistance.toFixed(1),
          limit: ROUTE_RADIUS,
        });
    }
    onChange({
      [kind]: [
        ...state[kind],
        {
          ...place,
          parentPlaceId: parent.placeId,
          parentAddress: parent.address,
          parentLat: parent.lat,
          parentLng: parent.lng,
        },
      ],
    });
    setNotice(t('publish.pointAdded', { type: labels[kind] }));
    setSearching(kind === 'pickups' && !state.dropoffs.length ? 'dropoffs' : null);
    if (kind === 'stopovers') setCity(null);
    return null;
  }

  function remove(kind: PointKind, point: LocationInput) {
    onChange({ [kind]: state[kind].filter((entry) => entry.placeId !== point.placeId) });
    setNotice(t('publish.pointsRemoved', { type: labels[kind] }));
    if (kind !== 'stopovers' && state[kind].length === 1) setSearching(kind);
  }

  function reorder(index: number, delta: -1 | 1) {
    const points = [...state.stopovers];
    [points[index], points[index + delta]] = [points[index + delta], points[index]];
    onChange({ stopovers: points });
    setNotice(t('publish.pointsReordered'));
  }

  function list(kind: PointKind) {
    return (
      <ul className="space-y-2">
        {state[kind].map((point, index) => (
          <li key={point.placeId} className="flex items-start gap-2 rounded-xl bg-orange-50/60 p-3">
            <Check size={16} className="mt-1 shrink-0 text-green-700" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold">{point.address}</p>
              {kind === 'stopovers' && (
                <p className="mt-1 text-xs text-gray-500">
                  {index + 1}. {point.parentAddress}
                </p>
              )}
            </div>
            {kind === 'stopovers' && state.stopovers.length > 1 && (
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={t('publish.pointsMoveUp', { address: point.address })}
                  onClick={() => reorder(index, -1)}
                  className="rounded-lg p-2 hover:bg-orange-100 disabled:opacity-30"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  disabled={index === state.stopovers.length - 1}
                  aria-label={t('publish.pointsMoveDown', { address: point.address })}
                  onClick={() => reorder(index, 1)}
                  className="rounded-lg p-2 hover:bg-orange-100 disabled:opacity-30"
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            )}
            <button
              type="button"
              aria-label={`${t('common.remove')} ${point.address}`}
              onClick={() => remove(kind, point)}
              className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-red-50 hover:text-red-700"
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function picker(kind: PointKind, parent: MeetingPlace) {
    return (
      <MeetingPointSearch
        key={`${kind}-${parent.placeId}-${state[kind].length}`}
        label={placeholders[kind]}
        scope={kind === 'pickups' ? 'baltic' : 'europe'}
        bias={{
          lat: parent.lat,
          lng: parent.lng,
          radiusKm: kind === 'stopovers' ? STOP_RADIUS : CITY_RADIUS,
        }}
        onSelect={(place) => add(kind, place)}
      />
    );
  }

  function endpoint(kind: 'pickups' | 'dropoffs') {
    const parent = kind === 'pickups' ? state.origin : state.destination;
    const showSearch = searching === kind || state[kind].length === 0;
    return (
      <section
        aria-labelledby={`${kind}-title`}
        className="rounded-2xl border border-orange-100 bg-white p-4 sm:p-5"
      >
        <div className="mb-4 flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${state[kind].length ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-deliivo-orange'}`}
          >
            {state[kind].length ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              <MapPin size={17} aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 id={`${kind}-title`} className="font-bold text-deliivo-dark">
              {labels[kind]}
            </h3>
            <p className="break-words text-sm text-gray-500">{parent?.address}</p>
          </div>
          <span className="text-xs text-gray-500">
            {state[kind].length
              ? `${state[kind].length}/${MAX_POINTS}`
              : t('publish.pointsRequired')}
          </span>
        </div>
        {list(kind)}
        {state[kind].length < MAX_POINTS && (
          <div className={state[kind].length ? 'mt-3' : ''}>
            {showSearch && parent ? (
              picker(kind, parent)
            ) : (
              <button
                type="button"
                onClick={() => setSearching(kind)}
                className="inline-flex items-center gap-2 py-2 text-sm font-semibold text-deliivo-orange"
              >
                <Plus size={16} aria-hidden="true" />
                {kind === 'pickups' ? t('publish.addPickup') : t('publish.addDropoff')}
              </button>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-deliivo-dark">{t('publish.meetingPointsTitle')}</h2>
        <p className="mt-2 text-sm text-gray-600">{t('publish.meetingPointsCopy')}</p>
      </header>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {endpoint('pickups')}
        {endpoint('dropoffs')}
      </div>
      <section
        className="mt-4 rounded-2xl border border-orange-100 bg-white p-4 sm:p-5"
        aria-labelledby="optional-stops-title"
      >
        <button
          type="button"
          aria-expanded={stopsOpen}
          aria-controls="optional-stops-content"
          onClick={() => {
            setStopsOpen(!stopsOpen);
            if (!stopsOpen && suggestionStatus === 'idle') setSuggestionStatus('loading');
          }}
          className="flex w-full items-center gap-3 text-left"
        >
          <Plus size={18} className="shrink-0 text-deliivo-orange" aria-hidden="true" />
          <div className="flex-1">
            <h3 id="optional-stops-title" className="font-semibold">
              {t('publish.stopoversOptional')}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              {state.stopovers.length
                ? t('publish.selectedCount', { count: state.stopovers.length, max: MAX_POINTS })
                : t('publish.pointsDirectRide')}
            </p>
          </div>
          <ChevronDown
            size={18}
            className={`transition-transform ${stopsOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {stopsOpen && (
          <div id="optional-stops-content" className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            {list('stopovers')}
            {state.stopovers.length < MAX_POINTS && (
              <>
                {suggestionStatus === 'loading' || suggestionStatus === 'idle' ? (
                  <p role="status" className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 size={15} className="animate-spin" />
                    {t('publish.loadingStopovers')}
                  </p>
                ) : suggestionStatus === 'error' ? (
                  <p role="alert" className="text-sm text-red-700">
                    {t('publish.pointsSuggestionsError')}{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        setSuggestionStatus('loading');
                        setSuggestionRetry((value) => value + 1);
                      }}
                    >
                      {t('common.retry')}
                    </button>
                  </p>
                ) : suggestions.length ? (
                  <>
                    <div>
                      <label htmlFor="stopover-city" className="mb-2 block text-sm font-medium">
                        {t('publish.pointsChooseArea')}
                      </label>
                      <select
                        id="stopover-city"
                        className="input-field"
                        value={city?.placeId || ''}
                        onChange={(event) => {
                          setCity(
                            suggestions.find((item) => item.placeId === event.target.value) || null,
                          );
                          setSearching('stopovers');
                        }}
                      >
                        <option value="">{t('publish.pointsChooseArea')}</option>
                        {suggestions.map((item) => (
                          <option key={item.placeId} value={item.placeId}>
                            {item.name} / {item.address}
                          </option>
                        ))}
                      </select>
                    </div>
                    {city && picker('stopovers', city)}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">{t('publish.noSuggestedStopovers')}</p>
                )}
              </>
            )}
          </div>
        )}
      </section>
      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setMapOpen(!mapOpen)}
          aria-expanded={mapOpen}
          aria-controls="meeting-map"
          className="inline-flex items-center gap-2 py-2 text-sm font-semibold text-deliivo-orange"
        >
          <MapPin size={16} aria-hidden="true" />
          {mapOpen ? t('publish.pointsHideMap') : t('publish.pointsShowMap')}
          <ChevronDown size={15} className={mapOpen ? 'rotate-180' : ''} aria-hidden="true" />
        </button>
        {mapOpen && (
          <div id="meeting-map" className="relative mt-2">
            <GoogleMap
              polyline={preview.polyline || selectedPolyline}
              markers={[
                ...(state.origin ? [{ ...state.origin, color: 'green' as const }] : []),
                ...state.pickups.map((point) => ({ ...point, color: 'green' as const })),
                ...state.stopovers.map((point) => ({ ...point, color: 'blue' as const })),
                ...state.dropoffs.map((point) => ({ ...point, color: 'red' as const })),
                ...(state.destination ? [{ ...state.destination, color: 'red' as const }] : []),
              ]}
              className="h-64 w-full rounded-2xl sm:h-80"
            />
            {preview.loading && (
              <p
                role="status"
                className="absolute right-2 top-2 rounded-full bg-white px-3 py-2 text-xs shadow"
              >
                {t('publish.updatingRoadPath')}
              </p>
            )}
            {preview.failed && (
              <p role="status" className="mt-2 text-xs text-gray-500">
                {t('publish.pointsMapFallback')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
