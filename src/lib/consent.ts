/**
 * Consent Mode v2 state.
 *
 * The denied-by-default `gtag('consent', 'default', ...)` call lives inline in
 * `src/app/layout.tsx` so it runs before the GTM container. This module owns
 * everything after that: the stored choice, replaying it on load, and updating
 * it when the visitor decides.
 *
 * Every GA4 tag in GTM-KL8DBG96 requires `analytics_storage`, and the Ads tags
 * require the three ad signals, so nothing is collected until a grant lands here.
 */

export const CONSENT_STORAGE_KEY = 'deliivo.consent';

/**
 * Bump when the categories change meaning. A stored choice from an older
 * version is treated as absent, so the banner asks again rather than assuming
 * consent for something the visitor never saw.
 */
export const CONSENT_VERSION = 1;

export interface ConsentChoice {
  analytics: boolean;
  marketing: boolean;
  version: number;
  decidedAt: string;
}

type GtagConsentValue = 'granted' | 'denied';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function granted(value: boolean): GtagConsentValue {
  return value ? 'granted' : 'denied';
}

export function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentChoice>;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.marketing !== 'boolean') return null;
    return parsed as ConsentChoice;
  } catch {
    // Private mode, disabled storage, or corrupted value: treat as undecided.
    return null;
  }
}

/**
 * Send the choice to Google. Safe to call repeatedly - Consent Mode is
 * last-write-wins, and the inline default has already run by this point.
 */
export function applyConsent(choice: Pick<ConsentChoice, 'analytics' | 'marketing'>): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', {
    analytics_storage: granted(choice.analytics),
    ad_storage: granted(choice.marketing),
    ad_user_data: granted(choice.marketing),
    ad_personalization: granted(choice.marketing),
  });
}

export function saveConsent(choice: Pick<ConsentChoice, 'analytics' | 'marketing'>): ConsentChoice {
  const stored: ConsentChoice = {
    analytics: choice.analytics,
    marketing: choice.marketing,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable: the choice still applies to this page load, the
    // banner simply asks again next time.
  }
  applyConsent(stored);
  return stored;
}

export function clearConsent(): void {
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // Nothing to do - an unreadable store is already an undecided store.
  }
}

/** Event the footer link dispatches to reopen the banner for withdrawal. */
export const CONSENT_REOPEN_EVENT = 'deliivo:consent-reopen';

export function openConsentSettings(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
}
