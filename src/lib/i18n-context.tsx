'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { dictionaries } from './i18n-dictionaries';
import { getLocaleTranslation } from './locale-overrides';
import { getTokens, userApi } from './api';
import {
  DEFAULT_LOCALE,
  getBrowserLocale,
  getLocaleFromPathname,
  isSupportedLocale,
  LOCALE_CHANGE_EVENT,
  persistLocale,
  type SupportedLocale,
} from './i18n';

type TranslationParams = Record<string, string | number>;

type I18nContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Last language reported to the backend this page load, so repeated navigation inside one
 * language does not repeat the call. The server is idempotent either way.
 */
let reportedLocale: SupportedLocale | null = null;

/**
 * Record the language change on the user's account.
 *
 * Signed-out visitors have nothing to record — the language they picked is sent with signup and
 * with every later request's Accept-Language header. Failures are deliberately swallowed:
 * switching language must never surface an error, and the passive sync in the API's auth
 * middleware picks the change up on the next request regardless.
 */
function reportLocaleToBackend(locale: SupportedLocale) {
  if (typeof window === 'undefined') return;
  if (locale === reportedLocale) return;
  if (!getTokens()) return;

  reportedLocale = locale;
  void userApi.setLocale(locale).catch(() => {
    reportedLocale = null;
  });
}

function interpolate(value: string, params?: TranslationParams) {
  if (!params) return value;
  return Object.entries(params).reduce(
    (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState<SupportedLocale>(() => getLocaleFromPathname(pathname) || DEFAULT_LOCALE);

  useEffect(() => {
    const resolved = getBrowserLocale();
    setLocaleState(resolved);
    document.documentElement.lang = resolved;

    const handleLocaleChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<string>).detail;
      if (isSupportedLocale(nextLocale)) setLocaleState(nextLocale);
    };

    window.addEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
  }, []);

  useEffect(() => {
    const pathLocale = getLocaleFromPathname(pathname);
    if (pathLocale && pathLocale !== locale) {
      persistLocale(pathLocale);
      setLocaleState(pathLocale);
      // Deliberately not reported to the backend. Navigation is not a language choice: an
      // internal link without a locale prefix is redirected to /en by src/proxy.ts, and telling
      // the API about that would overwrite the language the user actually picked. Only the
      // switcher, below, speaks for the user.
    }
  }, [locale, pathname]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale(nextLocale) {
      persistLocale(nextLocale);
      setLocaleState(nextLocale);
      reportLocaleToBackend(nextLocale);
    },
    t(key, params) {
      const translated = getLocaleTranslation(locale, key)
        || dictionaries[locale]?.[key]
        || dictionaries.en[key]
        || key;
      return interpolate(translated, params);
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used inside I18nProvider');
  }
  return context;
}
