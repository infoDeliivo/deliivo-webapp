'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { FaGoogle, FaApple, FaPhone } from "react-icons/fa";
import { authApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import BrandLogo from "@/components/BrandLogo";
import { buildE164PhoneNumber, PHONE_COUNTRY_OPTIONS, sanitizePhoneLocalNumber } from "@/lib/phone-auth";
import { getSafeReturnTo, withReturnTo } from "@/lib/auth-redirect";

type Step = 'identifier' | 'otp';
type Method = 'email' | 'phone';

export default function SignInPage() {
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>('identifier');
  const [method, setMethod] = useState<Method>('email');
  const [identifier, setIdentifier] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+372');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const normalizedIdentifier = method === 'email' ? identifier.trim() : buildE164PhoneNumber(phoneCountryCode, phone);

  function redirectAfterLogin(next: 'onboarding' | 'home') {
    const destination = returnTo || getSafeReturnTo();
    router.replace(next === 'onboarding' ? withReturnTo('/onboarding', destination) : (destination || '/'));
  }

  // Google OAuth setup
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    setReturnTo(getSafeReturnTo());
  }, []);

  useEffect(() => {
    if (!authLoading && user && !loading && !googleLoading) {
      router.replace(returnTo || getSafeReturnTo() || '/');
    }
  }, [authLoading, googleLoading, loading, returnTo, router, user]);

  const handleGoogleCallback = useCallback(async (response: { credential: string }) => {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await apiFetch<{
        data: { accessToken: string; refreshToken: string; next: 'onboarding' | 'home' };
      }>('/api/v1/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken: response.credential }),
      });
      await login(res.data.accessToken, res.data.refreshToken);
      redirectAfterLogin(res.data.next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }, [login, router]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window === 'undefined') return;
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as unknown as { google: { accounts: { id: { initialize: (config: unknown) => void } } } }).google?.accounts?.id?.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [GOOGLE_CLIENT_ID, handleGoogleCallback]);

  function triggerGoogleSignIn() {
    const google = (window as unknown as { google?: { accounts?: { id?: { prompt: () => void } } } }).google;
    if (google?.accounts?.id?.prompt) {
      google.accounts.id.prompt();
    } else {
      setError('Google Sign-In not available. Check API key configuration.');
    }
  }

  const handleSubmitIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!normalizedIdentifier) {
      setError('Enter a valid phone number with country code.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(method, normalizedIdentifier);
      if (res.data?.code) setDevCode(res.data.code);
      setStep('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!normalizedIdentifier) {
      setError('Enter a valid phone number with country code.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(normalizedIdentifier, otp, 'login', method);
      await login(res.data.accessToken, res.data.refreshToken);
      redirectAfterLogin(res.data.next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    if (!normalizedIdentifier) {
      setError('Enter a valid phone number with country code.');
      return;
    }
    try {
      const res = await authApi.resendOtp(normalizedIdentifier, 'login', method);
      if (res.data?.code) setDevCode(res.data.code);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend';
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#fff1e6_0%,#fffaf5_45%,#f7f7f5_100%)] px-4 py-8 sm:py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-black/5 lg:grid-cols-[1.12fr_0.88fr]">
        <aside className="relative hidden min-h-[680px] bg-[#f97316] lg:block">
          <img src="/signin-baltic-carpooling.png" alt="A shared ride travelling through the Baltics" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-8 pb-8 pt-24 text-white">
            <p className="text-2xl font-bold">Travel together across the Baltics</p>
            <p className="mt-2 max-w-md text-sm text-white/85">Verified profiles, clear pickup points, and simple city-to-city rides.</p>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center lg:justify-start">
          <BrandLogo size={52} className="h-12 w-auto object-contain" />
        </div>

        <div>
          {/* Illustration */}
          <div className="mb-7 overflow-hidden rounded-2xl lg:hidden">
            <img src="/signin-baltic-carpooling.png" alt="Baltic carpooling" className="h-40 w-full object-cover" />
          </div>

          {step === 'identifier' ? (
            <>
              <h1 className="mb-1 text-2xl font-bold tracking-tight text-deliivo-dark">
                Sign in to your account
              </h1>
              <p className="mb-6 text-sm text-deliivo-gray">
                {method === 'email'
                  ? 'Enter your email to receive a verification code.'
                  : 'Enter your phone number to receive an OTP.'}
              </p>

              <form className="space-y-4" onSubmit={handleSubmitIdentifier}>
                {method === 'email' ? (
                  <div>
                    <label htmlFor="identifier" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                      Email address
                    </label>
                    <input
                      id="identifier"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="input-field"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                      Phone number
                    </label>
                    <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <select
                        value={phoneCountryCode}
                        onChange={(e) => setPhoneCountryCode(e.target.value)}
                        className="input-field"
                        aria-label="Country code"
                      >
                        {PHONE_COUNTRY_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        id="phone"
                        type="tel"
                        autoComplete="tel-national"
                        inputMode="numeric"
                        required
                        placeholder="51234567"
                        value={phone}
                        onChange={(e) => setPhone(sanitizePhoneLocalNumber(e.target.value))}
                        className="input-field"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-deliivo-gray">
                      We send the OTP to {normalizedIdentifier ?? `${phoneCountryCode}...`}.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base disabled:opacity-50">
                  {loading ? 'Sending...' : 'Continue'}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-medium text-deliivo-gray">OR</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="space-y-3">
                {method === 'email' ? (
                  <button
                    type="button"
                    onClick={() => { setMethod('phone'); setIdentifier(''); setPhone(''); setError(''); }}
                    className="btn-outline w-full gap-2.5 py-3 text-sm"
                  >
                    <FaPhone className="h-4 w-4 shrink-0" />
                    Sign in with Phone
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setMethod('email'); setIdentifier(''); setPhone(''); setError(''); }}
                    className="btn-outline w-full gap-2.5 py-3 text-sm"
                  >
                    Sign in with Email
                  </button>
                )}

                <button
                  type="button"
                  onClick={triggerGoogleSignIn}
                  disabled={googleLoading || !GOOGLE_CLIENT_ID}
                  className="flex w-full items-center justify-center gap-2.5 rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-deliivo-dark transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  <FaGoogle className="h-4 w-4 shrink-0 text-[#4285F4]" />
                  {googleLoading ? 'Signing in...' : 'Continue with Google'}
                </button>

                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-2.5 rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-deliivo-dark transition-colors hover:bg-gray-50 disabled:opacity-50"
                  title="Apple Sign-In coming soon"
                >
                  <FaApple className="h-4 w-4 shrink-0" />
                  Continue with Apple
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-2xl font-bold tracking-tight text-deliivo-dark">
                Enter verification code
              </h1>
              <p className="mb-2 text-sm text-deliivo-gray">
                We sent a 4-digit code to <strong>{normalizedIdentifier}</strong>
              </p>

              {devCode && (
                <p className="mb-4 text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-yellow-800">
                  Dev mode — OTP: <strong>{devCode}</strong>
                </p>
              )}

              <form className="space-y-4" onSubmit={handleVerifyOtp}>
                <div>
                  <label htmlFor="otp" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                    Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    placeholder="1234"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="input-field text-center text-2xl tracking-[0.5em] font-bold"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <button type="submit" disabled={loading || otp.length < 4} className="btn-primary w-full py-3 text-base disabled:opacity-50">
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setStep('identifier'); setOtp(''); setError(''); setDevCode(null); }}
                  className="text-sm text-deliivo-gray hover:text-deliivo-dark"
                >
                  &larr; Change {method}
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-sm font-semibold text-deliivo-orange hover:text-deliivo-orange-dark"
                >
                  Resend code
                </button>
              </div>
            </>
          )}

          <p className="mt-6 text-center text-sm text-deliivo-gray">
            Don&apos;t have an account?{" "}
            <Link href={withReturnTo('/auth/signup', returnTo)} className="font-semibold text-deliivo-orange hover:text-deliivo-orange-dark transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
