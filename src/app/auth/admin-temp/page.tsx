'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { authApi, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function TemporaryAdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.temporaryAdminLogin(email.trim(), password);
      await login(res.data.accessToken, res.data.refreshToken);
      router.replace('/admin');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Invalid admin credentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#fff1e6_0%,#fffaf5_45%,#f7f7f5_100%)] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-deliivo-gray hover:text-deliivo-orange">
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <BrandLogo size={44} className="h-10 w-auto object-contain" />
          <div>
            <h1 className="text-xl font-bold text-deliivo-dark">Temporary admin login</h1>
            <p className="text-sm text-deliivo-gray">Restricted fallback access</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="adminEmail" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
              Admin email
            </label>
            <input
              id="adminEmail"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="adminPassword" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-deliivo-gray">
              Temporary password
            </label>
            <input
              id="adminPassword"
              type="password"
              autoComplete="current-password"
              required
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full gap-2 py-3 text-base disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Continue to admin
          </button>
        </form>

        <p className="mt-5 text-xs leading-5 text-deliivo-gray">
          This page only works when temporary admin login is enabled on the backend.
        </p>
      </section>
    </main>
  );
}
