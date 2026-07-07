'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { FaPhone } from "react-icons/fa";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import BrandLogo from "@/components/BrandLogo";
import { buildE164PhoneNumber, PHONE_COUNTRY_OPTIONS, sanitizePhoneLocalNumber } from "@/lib/phone-auth";
import { getSafeReturnTo, withReturnTo } from "@/lib/auth-redirect";
import GoogleSignInButton from "@/components/GoogleSignInButton";

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
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const normalizedIdentifier = method === 'email' ? identifier.trim() : buildE164PhoneNumber(phoneCountryCode, phone);

  function redirectAfterLogin(next: 'onboarding' | 'home') {
    const destination = returnTo || getSafeReturnTo();
    router.replace(next === 'onboarding' ? withReturnTo('/onboarding', destination) : (destination || '/'));
  }

  useEffect(() => {
    setReturnTo(getSafeReturnTo());
  }, []);

  useEffect(() => {
    if (!authLoading && user && !loading) {
      router.replace(returnTo || getSafeReturnTo() || '/');
    }
  }, [authLoading, loading, returnTo, router, user]);

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
        <aside className="hidden min-h-[680px] bg-gradient-to-br from-[#fb7a20] via-[#ef6412] to-[#d94b08] p-8 lg:flex lg:flex-col lg:justify-center">
          <div className="overflow-hidden rounded-[1.75rem] bg-orange-100 shadow-2xl ring-1 ring-white/30 aspect-[2.58/1]">
            <img src="/signin-baltic-carpooling.png" alt="A shared ride travelling through the Baltics" className="h-auto w-full" />
          </div>
          <div className="mt-9 text-white">
            <p className="text-3xl font-bold tracking-tight">Travel together across the Baltics</p>
            <p className="mt-3 max-w-md text-base leading-7 text-orange-50">Verified profiles, clear pickup points, and simple city-to-city rides.</p>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center lg:justify-start">
          <BrandLogo size={52} className="h-12 w-auto object-contain" />
        </div>

        <div>
          {/* Illustration */}
          <div className="mb-7 aspect-[2.4/1] overflow-hidden rounded-2xl bg-orange-100 shadow-sm lg:hidden">
            <img src="/signin-baltic-carpooling.png" alt="Baltic carpooling" className="h-auto w-full" />
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

                <GoogleSignInButton returnTo={returnTo} />
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
