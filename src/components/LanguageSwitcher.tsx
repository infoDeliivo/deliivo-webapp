'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { localeToUrlCode, stripLocalePrefix, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n-context';

type LanguageSwitcherProps = {
  compact?: boolean;
};

function LanguageFlag({ locale, className = 'h-4 w-6' }: { locale: SupportedLocale; className?: string }) {
  const frameClass = `inline-flex shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10 ${className}`;

  if (locale === 'et') {
    return (
      <span className={frameClass} aria-hidden="true">
        <svg viewBox="0 0 60 40" className="h-full w-full" role="img">
          <rect width="60" height="13.34" y="0" fill="#0072CE" />
          <rect width="60" height="13.33" y="13.34" fill="#000000" />
          <rect width="60" height="13.33" y="26.67" fill="#FFFFFF" />
        </svg>
      </span>
    );
  }

  if (locale === 'lv') {
    return (
      <span className={frameClass} aria-hidden="true">
        <svg viewBox="0 0 60 40" className="h-full w-full" role="img">
          <rect width="60" height="40" fill="#7E1E28" />
          <rect width="60" height="9" y="15.5" fill="#FFFFFF" />
        </svg>
      </span>
    );
  }

  if (locale === 'lt') {
    return (
      <span className={frameClass} aria-hidden="true">
        <svg viewBox="0 0 60 40" className="h-full w-full" role="img">
          <rect width="60" height="13.34" y="0" fill="#FDB913" />
          <rect width="60" height="13.33" y="13.34" fill="#006A44" />
          <rect width="60" height="13.33" y="26.67" fill="#C1272D" />
        </svg>
      </span>
    );
  }

  if (locale === 'ru') {
    return (
      <span className={frameClass} aria-hidden="true">
        <svg viewBox="0 0 60 40" className="h-full w-full" role="img">
          <rect width="60" height="13.34" y="0" fill="#FFFFFF" />
          <rect width="60" height="13.33" y="13.34" fill="#0039A6" />
          <rect width="60" height="13.33" y="26.67" fill="#D52B1E" />
        </svg>
      </span>
    );
  }

  return (
    <span className={frameClass} aria-hidden="true">
      <svg viewBox="0 0 60 40" className="h-full w-full" role="img">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0 0L60 40M60 0L0 40" stroke="#FFFFFF" strokeWidth="8" />
        <path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth="4" />
        <path d="M25 0H35V40H25ZM0 15H60V25H0Z" fill="#FFFFFF" />
        <path d="M27 0H33V40H27ZM0 17H60V23H0Z" fill="#C8102E" />
      </svg>
    </span>
  );
}

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
          <LanguageFlag locale={selectedLanguage.code} />
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 shadow-inner" aria-hidden="true">
                  <LanguageFlag locale={option.code} className="h-5 w-7" />
                </span>
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
