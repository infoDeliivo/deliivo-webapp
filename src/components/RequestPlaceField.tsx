'use client';
import { useEffect, useId, useState } from 'react';
import { mapsApi, type PlacePrediction } from '@/lib/api';

export default function RequestPlaceField({
  label,
  placeholder,
  scope = 'baltic',
  onChange,
}: {
  label: string;
  placeholder: string;
  scope?: 'baltic' | 'europe';
  onChange: (id: string, address: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(false);
  const [options, setOptions] = useState<PlacePrediction[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (selected || query.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      mapsApi
        .autocomplete(query, undefined, undefined, undefined, undefined, scope)
        .then((res) => {
          if (active) {
            setOptions(res.data);
            setFailed(false);
          }
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, selected, scope]);
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        value={query}
        required
        autoComplete="off"
        className="input-field w-full"
        placeholder={placeholder}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(false);
          setOptions([]);
          onChange('', '');
        }}
      />
      <span id={`${id}-hint`} className="text-xs text-gray-500">
        {selected
          ? 'Location selected'
          : failed
            ? 'Locations could not be loaded. Please try again.'
            : 'Select a location from the suggestions.'}
      </span>
      {!!options.length && !selected && (
        <ul
          aria-label={`${label} suggestions`}
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-white p-1 shadow-xl"
        >
          {options.map((option) => (
            <li key={option.placeId}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-orange-50 focus:bg-orange-50"
                onClick={() => {
                  setQuery(option.description);
                  setSelected(true);
                  setOptions([]);
                  onChange(option.placeId, option.description);
                }}
              >
                {option.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
