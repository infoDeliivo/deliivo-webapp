'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { mapsApi, type PlacePrediction } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';

export type MeetingPlace = { placeId: string; address: string; lat: number; lng: number };

export default function MeetingPointSearch({
  label,
  scope,
  bias,
  onSelect,
}: {
  label: string;
  scope: 'baltic' | 'europe';
  bias: { lat: number; lng: number; radiusKm: number };
  onSelect: (place: MeetingPlace) => string | null;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      version.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      mapsApi
        .autocomplete(query, bias.lat, bias.lng, bias.radiusKm, undefined, scope)
        .then(({ data }) => {
          if (active) setOptions(data || []);
        })
        .catch(() => {
          if (active) setError(t('publish.pointsSearchError'));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, bias.lat, bias.lng, bias.radiusKm, scope, retry, t]);

  async function select(option: PlacePrediction) {
    const requestVersion = ++version.current;
    setResolving(true);
    setError('');
    setOpen(false);
    try {
      const { data } = await mapsApi.placeDetails(option.placeId);
      if (requestVersion !== version.current) return;
      const { lat, lng } = data.location;
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      )
        throw new Error('INVALID_LOCATION');
      const validationError = onSelect({
        placeId: option.placeId,
        address: option.description,
        lat,
        lng,
      });
      if (validationError) setError(validationError);
      else {
        setQuery('');
        setOptions([]);
        setActiveIndex(-1);
      }
    } catch {
      if (requestVersion === version.current) setError(t('publish.pointsDetailsError'));
    } finally {
      if (requestVersion === version.current) {
        setResolving(false);
        input.current?.focus();
      }
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <MapPin
          size={17}
          className="pointer-events-none absolute left-3 top-3.5 text-deliivo-orange"
          aria-hidden="true"
        />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && options.length > 0}
          aria-controls={`${id}-options`}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
          }
          aria-describedby={`${id}-help`}
          disabled={resolving}
          autoComplete="off"
          value={query}
          placeholder={t('publish.pointsSearchPlaceholder')}
          className="input-field pl-10 pr-10"
          onChange={(event) => {
            version.current += 1;
            setQuery(event.target.value);
            setOptions([]);
            setOpen(true);
            setError('');
            setActiveIndex(-1);
            setLoading(event.target.value.trim().length >= 2);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((previous) =>
                Math.min(
                  options.length - 1,
                  Math.max(0, previous + (event.key === 'ArrowDown' ? 1 : -1)),
                ),
              );
            }
            if (event.key === 'Enter' && open && activeIndex >= 0 && options[activeIndex]) {
              event.preventDefault();
              void select(options[activeIndex]);
            }
          }}
        />
        {(loading || resolving) && (
          <Loader2
            size={16}
            className="absolute right-3 top-4 animate-spin text-deliivo-orange"
            aria-hidden="true"
          />
        )}
        {open && options.length > 0 && !resolving && (
          <ul
            id={`${id}-options`}
            role="listbox"
            className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-orange-100 bg-white p-1 shadow-lg"
          >
            {options.map((option, index) => (
              <li
                key={option.placeId}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void select(option)}
                className={`cursor-pointer rounded-lg px-3 py-3 text-sm leading-5 ${index === activeIndex ? 'bg-orange-50' : 'hover:bg-orange-50'}`}
              >
                {option.description}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={`${id}-help`} className="mt-2 text-xs text-gray-500">
        {resolving
          ? t('publish.pointsChecking')
          : open && query.length >= 2 && !loading && options.length === 0 && !error
            ? t('publish.pointsNoResults')
            : t('publish.pointsChooseToAdd')}
      </p>
      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}{' '}
          {error === t('publish.pointsSearchError') && (
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                setError('');
                setLoading(true);
                setOpen(true);
                setRetry((value) => value + 1);
                input.current?.focus();
              }}
            >
              {t('common.retry')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
