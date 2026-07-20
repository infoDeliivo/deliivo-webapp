'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, ArrowLeftRight, Users, Loader2 } from 'lucide-react';
import { mapsApi, PlacePrediction } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n-context';

export default function SearchForm({ variant = 'default' }: { variant?: 'default' | 'hero' }) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const canUseWomenOnly = user?.gender === 'FEMALE';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fromLocation, setFromLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [toLocation, setToLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [date, setDate] = useState('');
  const [seats, setSeats] = useState(1);
  const [femaleOnly, setFemaleOnly] = useState(false);
  const [fromLoading, setFromLoading] = useState(false);
  const [toLoading, setToLoading] = useState(false);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [fromPredictions, setFromPredictions] = useState<PlacePrediction[]>([]);
  const [toPredictions, setToPredictions] = useState<PlacePrediction[]>([]);
  const fromDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => {
    if (fromDebounceRef.current) clearTimeout(fromDebounceRef.current);
    if (toDebounceRef.current) clearTimeout(toDebounceRef.current);
  }, []);

  function swap() {
    setFrom(to);
    setTo(from);
    setFromLocation(toLocation);
    setToLocation(fromLocation);
    setFromPredictions([]);
    setToPredictions([]);
    setFromOpen(false);
    setToOpen(false);
  }

  function searchPlaces(
    input: string,
    kind: 'from' | 'to',
  ) {
    const setLoading = kind === 'from' ? setFromLoading : setToLoading;
    const setPredictions = kind === 'from' ? setFromPredictions : setToPredictions;
    const setOpen = kind === 'from' ? setFromOpen : setToOpen;
    const debounceRef = kind === 'from' ? fromDebounceRef : toDebounceRef;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.trim().length < 2) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const originBias = kind === 'to' ? fromLocation : null;
        const res = await mapsApi.autocomplete(
          input,
          originBias?.lat,
          originBias?.lng,
          originBias ? 50 : undefined,
          false,
          kind === 'to' ? 'europe' : 'baltic',
        );
        setPredictions(res.data || []);
        setOpen((res.data || []).length > 0);
      } catch {
        setPredictions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  async function handleSelectPlace(prediction: PlacePrediction, kind: 'from' | 'to') {
    const description = prediction.description;
    if (kind === 'from') {
      setFrom(description);
      setFromOpen(false);
      setFromPredictions([]);
    } else {
      setTo(description);
      setToOpen(false);
      setToPredictions([]);
    }

    try {
      const details = await mapsApi.placeDetails(prediction.placeId);
      const location = details.data.location;
      if (kind === 'from') setFromLocation(location);
      else setToLocation(location);
    } catch {
      if (kind === 'from') setFromLocation(null);
      else setToLocation(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (date) params.set('date', date);
    params.set('seats', String(seats));
    if (femaleOnly) params.set('femaleOnly', '1');
    router.push('/search?' + params.toString());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full min-w-0 max-w-full rounded-3xl border border-primary-100 bg-white shadow-xl ${variant === 'hero' ? 'p-4 sm:p-5' : 'p-7 sm:p-8'}`}
    >
      <div className={variant === 'hero' ? 'sr-only' : 'mb-5'}>
        <p className="text-sm font-semibold text-deliivo-dark">{t('search.formTitle')}</p>
        <p className="mt-1 text-xs text-deliivo-gray">{t('search.formCopy')}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Leaving from */}
        <div className="relative min-w-0 w-full flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
            {t('search.fromLabel')}
          </label>
          <MapPin
            className="absolute left-3 top-[calc(50%+10px)] -translate-y-1/2 text-primary-500"
            size={18}
          />
          <input
            type="text"
            placeholder={t('search.fromPlaceholder')}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setFromLocation(null);
              searchPlaces(e.target.value, 'from');
            }}
            onFocus={() => fromPredictions.length > 0 && setFromOpen(true)}
            onBlur={() => setTimeout(() => setFromOpen(false), 150)}
            className="input-field h-14 min-w-0 pl-10 text-base"
          />
          {fromLoading && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <Loader2 className="h-4 w-4 animate-spin text-deliivo-gray" />
            </div>
          )}
          {fromOpen && fromPredictions.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg">
              {fromPredictions.map((prediction) => (
                <button
                  key={prediction.placeId}
                  type="button"
                  onMouseDown={() => handleSelectPlace(prediction, 'from')}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-primary-50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-deliivo-gray" />
                  <span className="truncate text-deliivo-dark">{prediction.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Swap button */}
        <button
          type="button"
          onClick={swap}
          aria-label={t('search.swap')}
        className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-primary-500 transition-colors hover:bg-primary-50 sm:mx-0"
        >
          <ArrowLeftRight size={16} />
        </button>

        {/* Going to */}
        <div className="relative min-w-0 w-full flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
            {t('search.toLabel')}
          </label>
          <MapPin
            className="absolute left-3 top-[calc(50%+10px)] -translate-y-1/2 text-deliivo-gray"
            size={18}
          />
          <input
            type="text"
            placeholder={t('search.toPlaceholder')}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setToLocation(null);
              searchPlaces(e.target.value, 'to');
            }}
            onFocus={() => toPredictions.length > 0 && setToOpen(true)}
            onBlur={() => setTimeout(() => setToOpen(false), 150)}
            className="input-field h-14 min-w-0 pl-10 text-base"
          />
          {toLoading && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <Loader2 className="h-4 w-4 animate-spin text-deliivo-gray" />
            </div>
          )}
          {toOpen && toPredictions.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg">
              {toPredictions.map((prediction) => (
                <button
                  key={prediction.placeId}
                  type="button"
                  onMouseDown={() => handleSelectPlace(prediction, 'to')}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-primary-50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-deliivo-gray" />
                  <span className="truncate text-deliivo-dark">{prediction.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date */}
        <div className="relative min-w-0 w-full flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
            {t('search.dateLabel')}
          </label>
          <Calendar
            className="pointer-events-none absolute left-3 top-[calc(50%+10px)] -translate-y-1/2 text-deliivo-gray"
            size={18}
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={today}
            className="input-field h-14 min-w-0 pl-10 text-base"
          />
        </div>

        <div className="relative min-w-0 w-full sm:w-32">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
            {t('search.seatsLabel')}
          </label>
          <Users
            className="pointer-events-none absolute left-3 top-[calc(50%+10px)] -translate-y-1/2 text-deliivo-gray"
            size={18}
          />
          <select
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="input-field h-14 min-w-0 pl-10 text-base"
            aria-label={t('search.seats')}
          >
            {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count} {count > 1 ? t('search.seatsPlural') : t('search.seat')}
              </option>
            ))}
          </select>
        </div>
        {variant === 'hero' && (
          <button type="submit" className="btn-primary mt-auto h-14 w-full shrink-0 px-7 text-base sm:w-auto">
            {t('search.submit')}
          </button>
        )}
      </div>

      {/* Second row: women-only toggle + search button */}
      {(variant === 'default' || canUseWomenOnly) && <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        {canUseWomenOnly ? (
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <button
              type="button"
              role="switch"
              aria-checked={femaleOnly}
              onClick={() => setFemaleOnly((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                femaleOnly ? 'bg-primary-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  femaleOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-deliivo-dark">
              {t('search.womenOnly')}
            </span>
          </label>
        ) : (
          <div />
        )}

        {/* Search button */}
        {variant === 'default' && (
          <button type="submit" className="btn-primary w-full px-10 py-3.5 text-base sm:w-auto">
            {t('search.submit')}
          </button>
        )}
      </div>}
    </form>
  );
}
