'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { localeToUrlCode, stripLocalePrefix, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n-context';

type LanguageSwitcherProps = {
  compact?: boolean;
};

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedLanguage = SUPPORTED_LOCALES.find((option) => option.code === locale) || SUPPORTED_LOCALES[0];

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  function handleChange(value: SupportedLocale) {
    setLocale(value);
    setOpen(false);
    const routePath = stripLocalePrefix(pathname);
    const suffix = `${window.location.search}${window.location.hash}`;
    router.replace(`/${localeToUrlCode(value)}${routePath === '/' ? '' : routePath}${suffix}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language.label')}
        className={`inline-flex items-center justify-between gap-2 rounded-full border border-gray-200 bg-white text-sm font-semibold text-deliivo-dark shadow-sm transition hover:border-orange-200 hover:bg-orange-50/50 focus:outline-none focus:ring-2 focus:ring-deliivo-orange/25 ${compact ? 'min-w-[116px] px-3 py-2' : 'w-full px-4 py-3'}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Languages size={16} className="shrink-0 text-deliivo-orange" aria-hidden="true" />
          <span className="truncate">{selectedLanguage.label}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-deliivo-gray transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div role="listbox" aria-label={t('language.label')} className="absolute right-0 z-[70] mt-2 w-52 overflow-hidden rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl shadow-gray-900/10">
          {SUPPORTED_LOCALES.map((option) => {
            const selected = option.code === locale;
            return (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => handleChange(option.code)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${selected ? 'bg-orange-50 text-deliivo-orange' : 'text-deliivo-dark hover:bg-gray-50'}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${selected ? 'bg-deliivo-orange text-white' : 'bg-gray-100 text-deliivo-gray'}`}>{option.shortLabel}</span>
                <span className="flex-1 text-sm font-semibold">{option.label}</span>
                {selected && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
