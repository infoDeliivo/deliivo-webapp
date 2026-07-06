export const SUPPORTED_LOCALES = [
  { code: 'en', urlCode: 'en', label: 'English', shortLabel: 'EN' },
  { code: 'et', urlCode: 'ee', label: 'Eesti', shortLabel: 'EE' },
  { code: 'ru', urlCode: 'ru', label: 'Русский', shortLabel: 'RU' },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['code'];
export type UrlLocaleCode = (typeof SUPPORTED_LOCALES)[number]['urlCode'];

const configuredDefaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE;

export const DEFAULT_LOCALE: SupportedLocale = urlCodeToLocale(configuredDefaultLocale)
  || (isSupportedLocale(configuredDefaultLocale) ? configuredDefaultLocale : 'en');
export const LOCALE_STORAGE_KEY = 'deliivo.locale';
export const LOCALE_COOKIE_NAME = 'deliivo_locale';
export const LOCALE_CHANGE_EVENT = 'deliivo:locale-change';

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale.code === value);
}

export function urlCodeToLocale(value: string | null | undefined): SupportedLocale | null {
  return SUPPORTED_LOCALES.find((locale) => locale.urlCode === value)?.code || null;
}

export function localeToUrlCode(locale: SupportedLocale): UrlLocaleCode {
  return SUPPORTED_LOCALES.find((option) => option.code === locale)?.urlCode || 'en';
}

export function getLocaleFromPathname(pathname: string): SupportedLocale | null {
  const prefix = pathname.split('/').filter(Boolean)[0];
  return urlCodeToLocale(prefix);
}

export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (urlCodeToLocale(segments[0])) segments.shift();
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function getBrowserLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const pathLocale = getLocaleFromPathname(window.location.pathname);
  if (pathLocale) return pathLocale;

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isSupportedLocale(stored)) return stored;

  const browserLocale = window.navigator.language?.split('-')[0];
  if (isSupportedLocale(browserLocale)) return browserLocale;

  return DEFAULT_LOCALE;
}

export function persistLocale(locale: SupportedLocale) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
  window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: locale }));
}
