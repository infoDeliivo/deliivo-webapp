'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n-context';
import { localeToUrlCode } from '@/lib/i18n';
import {
  applyConsent,
  CONSENT_REOPEN_EVENT,
  readConsent,
  saveConsent,
} from '@/lib/consent';

export default function ConsentBanner() {
  const { t, locale } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    // The inline default in layout.tsx denied everything on this load, so a
    // stored grant has to be replayed or a returning visitor is silently
    // downgraded to denied on every navigation.
    const stored = readConsent();
    if (stored) {
      applyConsent(stored);
      return;
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    const reopen = () => {
      const stored = readConsent();
      setAnalytics(stored?.analytics ?? true);
      setMarketing(stored?.marketing ?? true);
      setShowDetails(true);
      setVisible(true);
    };
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen);
  }, []);

  const decide = useCallback((choice: { analytics: boolean; marketing: boolean }) => {
    saveConsent(choice);
    setVisible(false);
    setShowDetails(false);
  }, []);

  if (!visible) return null;

  const privacyHref = `/${localeToUrlCode(locale)}/privacy`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-deliivo-orange">
            <Cookie size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-deliivo-dark">{t('consent.title')}</h2>
            <p className="mt-1.5 text-sm leading-6 text-deliivo-gray">
              {t('consent.copy')}{' '}
              <Link href={privacyHref} className="font-semibold text-deliivo-orange hover:underline">
                {t('consent.privacyLink')}
              </Link>
            </p>
          </div>
          {readConsent() ? (
            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label={t('consent.close')}
              className="rounded-full p-1 text-deliivo-gray transition-colors hover:bg-gray-100 hover:text-deliivo-dark"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        {showDetails ? (
          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
            <div className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <input type="checkbox" checked disabled className="mt-1 h-4 w-4 accent-deliivo-orange" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-deliivo-dark">{t('consent.necessaryTitle')}</p>
                <p className="mt-0.5 text-xs leading-5 text-deliivo-gray">{t('consent.necessaryCopy')}</p>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="mt-1 h-4 w-4 accent-deliivo-orange"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-deliivo-dark">{t('consent.analyticsTitle')}</p>
                <p className="mt-0.5 text-xs leading-5 text-deliivo-gray">{t('consent.analyticsCopy')}</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="mt-1 h-4 w-4 accent-deliivo-orange"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-deliivo-dark">{t('consent.marketingTitle')}</p>
                <p className="mt-0.5 text-xs leading-5 text-deliivo-gray">{t('consent.marketingCopy')}</p>
              </div>
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {showDetails ? (
            <button
              type="button"
              onClick={() => decide({ analytics, marketing })}
              className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-deliivo-dark transition-colors hover:border-deliivo-orange hover:text-deliivo-orange"
            >
              {t('consent.saveChoices')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-deliivo-dark transition-colors hover:border-deliivo-orange hover:text-deliivo-orange"
            >
              {t('consent.customise')}
            </button>
          )}
          <button
            type="button"
            onClick={() => decide({ analytics: false, marketing: false })}
            className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-deliivo-dark transition-colors hover:border-deliivo-orange hover:text-deliivo-orange"
          >
            {t('consent.rejectAll')}
          </button>
          <button
            type="button"
            onClick={() => decide({ analytics: true, marketing: true })}
            className="rounded-full bg-deliivo-orange px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            {t('consent.acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
