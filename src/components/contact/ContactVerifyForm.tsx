'use client';

import { useEffect, useState } from 'react';
import { getApiErrorMessage, userApi } from '@/lib/api';
import type { ContactMethod, UserProfile } from '@/lib/api';
import { PHONE_COUNTRY_OPTIONS, buildE164PhoneNumber, sanitizePhoneLocalNumber } from '@/lib/phone-auth';
import { useTranslation } from '@/lib/i18n-context';

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactVerifyFormProps {
  method: ContactMethod;
  /** Called with the updated user once the new value is verified and saved. */
  onVerified: (user: UserProfile) => void | Promise<void>;
  /** Secondary action on the entry step, e.g. "Skip for now" in onboarding or "Cancel" in profile. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

/**
 * Two-step add/change flow for an email or phone: enter the value, then the 4-digit code sent to it.
 * Nothing is saved on the account until the code is verified.
 */
export default function ContactVerifyForm({ method, onVerified, onDismiss, dismissLabel }: ContactVerifyFormProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'entry' | 'otp'>('entry');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState(PHONE_COUNTRY_OPTIONS[0].code);
  const [localPhone, setLocalPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [stagingCode, setStagingCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resolveIdentifier = (): string | null => {
    if (method === 'email') {
      const value = email.trim().toLowerCase();
      return EMAIL_PATTERN.test(value) ? value : null;
    }
    return buildE164PhoneNumber(countryCode, localPhone);
  };

  const sendCode = async (target: string) => {
    const res = await userApi.requestContactChange({ method, identifier: target });
    setIdentifier(res.data.identifier);
    setStagingCode(res.data.code ?? '');
    setOtp(res.data.code ?? '');
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const target = resolveIdentifier();
    if (!target) {
      setError(t(method === 'email' ? 'contact.invalidEmail' : 'contact.invalidPhone'));
      return;
    }
    setLoading(true);
    try {
      await sendCode(target);
      setStep('otp');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('contact.sendFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      await sendCode(identifier);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('contact.sendFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await userApi.verifyContactChange({ method, identifier, code: otp });
      await onVerified(res.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('contact.verifyFailed')));
    } finally {
      setLoading(false);
    }
  };

  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray';

  if (step === 'otp') {
    return (
      <form className="space-y-4" onSubmit={handleVerify}>
        <p className="text-sm text-deliivo-gray">
          {t('contact.codeSentTo')} <strong className="text-deliivo-dark">{identifier}</strong>
        </p>
        {stagingCode && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-deliivo-dark">
            <p className="font-semibold text-deliivo-orange">Staging OTP</p>
            <p className="mt-1 font-mono text-lg tracking-[0.35em]">{stagingCode}</p>
          </div>
        )}
        <div>
          <label htmlFor={`contact-otp-${method}`} className={labelClass}>
            {t('contact.code')}
          </label>
          <input
            id={`contact-otp-${method}`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            required
            placeholder="1234"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="input-field text-center text-2xl font-bold tracking-[0.5em]"
          />
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading || otp.length < 4} className="btn-primary w-full py-3 text-base disabled:opacity-50">
          {loading ? t('contact.verifying') : t('contact.verify')}
        </button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setStep('entry'); setOtp(''); setStagingCode(''); setError(''); }}
            className="text-sm text-deliivo-gray hover:text-deliivo-dark"
          >
            &larr; {t('contact.changeValue')}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={loading || cooldown > 0}
            className="text-sm font-semibold text-deliivo-orange hover:text-deliivo-orange-dark disabled:opacity-50"
          >
            {cooldown > 0 ? t('contact.resendIn', { seconds: cooldown }) : t('contact.resend')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleRequest}>
      {method === 'email' ? (
        <div>
          <label htmlFor="contact-email" className={labelClass}>
            {t('contact.email')}
          </label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="contact-phone" className={labelClass}>
            {t('contact.phone')}
          </label>
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="input-field"
              aria-label={t('contact.countryCode')}
            >
              {PHONE_COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              id="contact-phone"
              type="tel"
              autoComplete="tel-national"
              inputMode="numeric"
              required
              placeholder="51234567"
              maxLength={PHONE_COUNTRY_OPTIONS.find((o) => o.code === countryCode)?.maxLength || 15}
              value={localPhone}
              onChange={(e) => setLocalPhone(sanitizePhoneLocalNumber(e.target.value))}
              className="input-field"
            />
          </div>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base disabled:opacity-50">
        {loading ? t('contact.sending') : t('contact.sendCode')}
      </button>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="w-full text-sm font-semibold text-deliivo-gray hover:text-deliivo-dark"
        >
          {dismissLabel ?? t('common.cancel')}
        </button>
      )}
    </form>
  );
}
