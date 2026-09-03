'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { dlVerificationApi, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n-context';
import type { SupportedLocale } from '@/lib/i18n';
import { pushEvent } from '@/lib/analytics';

/**
 * Driving licence verification, shared by the publish gate and onboarding.
 *
 * The session is created by the backend, never in the browser. Only the backend can
 * sign the request (X-HMAC-SIGNATURE needs the shared secret) and only it can fill in
 * the identity Veriff should expect — phone, date of birth, gender, and a document
 * pinned to DRIVERS_LICENSE. A browser-created session carries none of that, which is
 * why Veriff then stops to ask the driver for their phone number and document type.
 *
 * @veriff/incontext-sdk then runs that session URL in its own InContext modal, layered
 * over the page. The driver never leaves the app and is never redirected. The SDK is
 * imported dynamically because it touches `document` at module scope and would crash the
 * server render.
 *
 * A finished flow is not an approved one. The decision arrives at the backend by
 * webhook, so completion only triggers a re-read via onCompleted.
 */

export type DlFlowStatus =
  | 'idle'
  | 'needs-profile'
  | 'starting'
  | 'in-flight'
  | 'submitted'
  | 'canceled'
  | 'failed';

export interface DlVerificationControl {
  status: DlFlowStatus;
  error: string;
  /** True while the driver is mid-flow and the trigger should be disabled. */
  busy: boolean;
  start: () => void;
  reset: () => void;
}

// Veriff takes plain language codes, which is what the app's locales already are.
function veriffLang(locale: SupportedLocale): string {
  return locale === 'et' || locale === 'ru' ? locale : 'en';
}

export function useDlVerification({ onCompleted }: { onCompleted?: () => void } = {}): DlVerificationControl {
  const { user } = useAuth();
  const { t, locale } = useTranslation();

  const [status, setStatus] = useState<DlFlowStatus>('idle');
  const [error, setError] = useState('');
  const [sessionUrl, setSessionUrl] = useState('');

  const frameRef = useRef<{ close: () => void } | null>(null);
  const aliveRef = useRef(true);
  // Kept in a ref so the SDK callbacks never close over a stale render's handler.
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  const closeFrame = useCallback(() => {
    frameRef.current?.close();
    frameRef.current = null;
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      frameRef.current?.close();
      frameRef.current = null;
    };
  }, []);

  const fail = useCallback((message: string) => {
    if (!aliveRef.current) return;
    setSessionUrl('');
    setStatus('failed');
    setError(message);
    pushEvent('verification_failed', { error_message: message });
  }, []);

  // RELOAD_REQUEST has to rebuild the frame from inside the frame's own event handler,
  // so openFrame reaches itself through a ref rather than closing over a half-defined
  // binding.
  const openFrameRef = useRef<((url: string, isCancelled?: () => boolean) => Promise<void>) | null>(null);

  const openFrame = useCallback(
    async (url: string, isCancelled: () => boolean = () => false) => {
      const { createVeriffFrame, MESSAGES } = await import('@veriff/incontext-sdk');
      // Checked after the await, not before: Strict Mode tears the effect down while the
      // dynamic import is still in flight, and a second frame would then be created.
      // Both would carry the SDK's fixed `veriffFrame` id, so its handshake — which
      // resolves the frame by getElementById — would answer the wrong one and Veriff
      // would render nothing at all.
      if (!aliveRef.current || isCancelled()) return;
      setStatus('in-flight');
      console.info('[dl-verification] opening Veriff frame', { host: new URL(url).host });
      frameRef.current = createVeriffFrame({
        url,
        lang: veriffLang(locale),
        onEvent: (message) => {
          if (!aliveRef.current) return;
          switch (message) {
            case MESSAGES.STARTED:
              setStatus('in-flight');
              pushEvent('verification_in_flight');
              break;
            case MESSAGES.SUBMITTED:
            case MESSAGES.FINISHED:
              // Reached the end of the flow, not approved: only the webhook decides.
              closeFrame();
              setSessionUrl('');
              setStatus('submitted');
              // Submitted, never approved - approval only arrives by webhook, so no
              // conversion may be derived from this.
              pushEvent('verification_submitted');
              onCompletedRef.current?.();
              break;
            case MESSAGES.CANCELED:
              closeFrame();
              setSessionUrl('');
              setStatus('canceled');
              pushEvent('verification_canceled');
              break;
            case MESSAGES.RELOAD_REQUEST:
              // Sent after a camera-permission recovery, mostly on iOS Safari. Left
              // unhandled the driver is stranded on a blank frame. The frame is torn
              // down and rebuilt in place rather than reopened in a tab of its own,
              // which would take the driver off our site mid-flow.
              closeFrame();
              void openFrameRef.current?.(url);
              break;
          }
        },
      });
    },
    [closeFrame, locale],
  );

  useEffect(() => {
    openFrameRef.current = openFrame;
  }, [openFrame]);

  // Opening is driven by state rather than by the click so that teardown is tied to the
  // component lifecycle — see the cancellation note in openFrame.
  useEffect(() => {
    if (!sessionUrl) return;
    let cancelled = false;

    void (async () => {
      try {
        await openFrame(sessionUrl, () => cancelled);
      } catch (frameError: unknown) {
        if (cancelled) return;
        // Verification always runs inside our own page. There is deliberately no
        // redirect fallback: sending the driver to Veriff's site would drop them out of
        // the publish flow, so a frame that cannot open is surfaced as an error instead.
        console.error('[dl-verification] Veriff frame failed to open', frameError);
        fail(t('publish.dlSessionFailed'));
      }
    })();

    return () => {
      cancelled = true;
      // Only ever one frame at a time. Without this the Strict Mode remount stacks a
      // second one on top of the first.
      closeFrame();
    };
  }, [closeFrame, fail, openFrame, sessionUrl, t]);

  const start = useCallback(() => {
    if (status === 'starting' || status === 'in-flight') return;
    setError('');
    const firstName = (user?.firstName || '').trim();
    const lastName = (user?.lastName || '').trim();
    // Veriff matches the document against the name the backend submits, and the backend
    // rejects a name that disagrees with the profile, so both parts must be present.
    if (!firstName || !lastName) {
      setStatus('needs-profile');
      setError(t('publish.dlNeedsFullName'));
      return;
    }

    setStatus('starting');
    pushEvent('verification_start', { provider: 'veriff' });
    void (async () => {
      try {
        const res = await dlVerificationApi.createSession({
          firstName,
          lastName,
          // A phone-registered driver has no email. Sending the profile's null would fail
          // validation for an account that is entirely valid, so the field is simply omitted.
          email: user?.email || undefined,
          dateOfBirth: user?.dob?.slice(0, 10),
          gender: user?.gender === 'MALE' ? 'M' : user?.gender === 'FEMALE' ? 'F' : undefined,
          callback: `${window.location.origin}${window.location.pathname}`,
        });
        if (!aliveRef.current) return;
        if (!res.data.sessionUrl) {
          console.error('[dl-verification] backend returned no sessionUrl');
          fail(t('publish.dlSessionFailed'));
          return;
        }
        setSessionUrl(res.data.sessionUrl);
      } catch (createError: unknown) {
        console.error('[dl-verification] session creation failed', createError);
        fail(getApiErrorMessage(createError, t('publish.dlSessionFailed')));
      }
    })();
  }, [fail, status, t, user]);

  const reset = useCallback(() => {
    closeFrame();
    // Dropped so a reopen creates a fresh session rather than reviving a consumed one.
    setSessionUrl('');
    setStatus('idle');
    setError('');
  }, [closeFrame]);

  return {
    status,
    error,
    busy: status === 'starting' || status === 'in-flight',
    start,
    reset,
  };
}

/**
 * Progress and outcome for the licence flow. Deliberately renders nothing while the
 * InContext frame is up — that frame is its own full-screen overlay and would otherwise
 * sit on top of a second, pointless backdrop.
 */
export function DlVerificationModal({ control }: { control: DlVerificationControl }) {
  const { t } = useTranslation();
  const { status, error, reset } = control;

  if (status === 'idle' || status === 'in-flight') return null;

  const isSubmitted = status === 'submitted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl sm:p-8">
        <button
          type="button"
          onClick={reset}
          aria-label={t('dlVerify.close')}
          className="absolute right-4 top-4 rounded-full p-1.5 text-deliivo-gray transition hover:bg-gray-100 hover:text-deliivo-dark"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-deliivo-orange-light text-deliivo-orange">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h2 className="mt-4 text-xl font-bold text-deliivo-dark">
          {isSubmitted ? t('dlVerify.submittedTitle') : t('dlVerify.modalTitle')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-deliivo-gray">
          {isSubmitted ? t('dlVerify.submitted') : status === 'canceled' ? t('dlVerify.canceled') : t('dlVerify.modalCopy')}
        </p>

        {status === 'starting' && (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-deliivo-orange" />
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {(isSubmitted || status === 'canceled' || status === 'needs-profile' || status === 'failed') && (
          <button type="button" onClick={reset} className="btn-outline mt-6 w-full px-4 py-2.5 text-sm">
            {t('dlVerify.close')}
          </button>
        )}
      </div>
    </div>
  );
}
