'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import BrandLogo from "@/components/BrandLogo";
import { buildE164PhoneNumber, PHONE_COUNTRY_OPTIONS, sanitizePhoneLocalNumber } from "@/lib/phone-auth";
import { getSafeReturnTo, withReturnTo } from "@/lib/auth-redirect";
import GoogleSignInButton from "@/components/GoogleSignInButton";

type Step = 'form' | 'otp';
type Method = 'email' | 'phone';

export default function SignUpPage() {
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>('form');
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+372');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const identifier = method === 'email' ? email.trim() : buildE164PhoneNumber(phoneCountryCode, phone);

  useEffect(() => {
    setReturnTo(getSafeReturnTo());
  }, []);

  useEffect(() => {
    if (!authLoading && user && !loading) {
      router.replace(returnTo || getSafeReturnTo() || '/');
    }
  }, [authLoading, loading, returnTo, router, user]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier) {
      setError('Enter a valid phone number with country code.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.signup(method, identifier);
      if (res.data?.code) setDevCode(res.data.code);
      setStep('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier) {
      setError('Enter a valid phone number with country code.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(identifier, otp, 'signup', method);
      await login(res.data.accessToken, res.data.refreshToken);
      router.replace(withReturnTo('/onboarding', returnTo || getSafeReturnTo()));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    if (!identifier) {
      setError('Enter a valid phone number with country code.');
      return;
    }
    try {
      const res = await authApi.resendOtp(identifier, 'signup', method);
      if (res.data?.code) setDevCode(res.data.code);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend';
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#fff1e6_0%,#fffaf5_45%,#f7f7f5_100%)] px-4 py-8 sm:py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-black/5 lg:grid-cols-[1.12fr_0.88fr]">
        <aside className="hidden min-h-[720px] bg-gradient-to-br from-[#fb7a20] via-[#ef6412] to-[#d94b08] p-8 lg:flex lg:flex-col lg:justify-center">
          <div className="aspect-[2.58/1] overflow-hidden rounded-[1.75rem] bg-orange-100 shadow-2xl ring-1 ring-white/30">
            <img src="/signin-baltic-carpooling.png" alt="A shared ride travelling through the Baltics" className="h-auto w-full" />
          </div>
          <div className="mt-9 text-white">
            <p className="text-3xl font-bold tracking-tight">Your next shared journey starts here</p>
            <p className="mt-3 max-w-md text-base leading-7 text-orange-50">Create your profile, find trusted travellers, and share clear pickup points across the Baltics.</p>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center lg:justify-start">
          <BrandLogo size={52} className="h-12 w-auto object-contain" />
        </div>

        <div className="mb-7 aspect-[2.4/1] overflow-hidden rounded-2xl bg-orange-100 shadow-sm lg:hidden">
          <img src="/signin-baltic-carpooling.png" alt="Baltic carpooling" className="h-auto w-full" />
        </div>

        <div>
          {step === 'form' ? (
            <>
              <h1 className="mb-1 text-2xl font-bold tracking-tight text-deliivo-dark">
                Create your account
              </h1>
              <p className="mb-6 text-sm text-deliivo-gray">
                Join Deliivo and start carpooling today.
              </p>

              {/* Method toggle */}
              <div className="mb-6 flex rounded-full bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => { setMethod('email'); setError(''); }}
                  className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
                    method === 'email' ? 'bg-white shadow-sm text-deliivo-dark' : 'text-deliivo-gray'
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setMethod('phone'); setError(''); }}
                  className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
                    method === 'phone' ? 'bg-white shadow-sm text-deliivo-dark' : 'text-deliivo-gray'
                  }`}
                >
                  Phone
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleSignup}>
                {method === 'email' ? (
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
                      Email address
                    </label>
                    <input
                      id="email"
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
                      We store your number as {phoneCountryCode} plus your local number.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base disabled:opacity-50">
                  {loading ? 'Creating account...' : 'Sign up'}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-medium text-deliivo-gray">OR</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <GoogleSignInButton returnTo={returnTo} />

              <p className="mt-6 text-center text-xs text-deliivo-gray">
                By signing up, you agree to our{" "}
                <Link href="/terms" className="underline hover:text-deliivo-orange">Terms</Link> and{" "}
                <Link href="/privacy" className="underline hover:text-deliivo-orange">Privacy Policy</Link>.
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-2xl font-bold tracking-tight text-deliivo-dark">
                Verify your {method}
              </h1>
              <p className="mb-2 text-sm text-deliivo-gray">
                We sent a 4-digit code to <strong>{identifier}</strong>
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
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtp(''); setError(''); setDevCode(null); }}
                  className="text-sm text-deliivo-gray hover:text-deliivo-dark"
                >
                  &larr; Back
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
            Already have an account?{" "}
            <Link href={withReturnTo('/auth/signin', returnTo)} className="font-semibold text-deliivo-orange hover:text-deliivo-orange-dark transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
