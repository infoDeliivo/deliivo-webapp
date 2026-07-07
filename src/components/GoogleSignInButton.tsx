'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getSafeReturnTo, withReturnTo } from '@/lib/auth-redirect';

type GoogleCredentialResponse = { credential: string };
type GoogleIdentity = {
  initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentity } };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

export default function GoogleSignInButton({ returnTo }: { returnTo?: string | null }) {
  const router = useRouter();
  const { login } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const handleCredential = useCallback(async (response: GoogleCredentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const result = await authApi.google(response.credential);
      await login(result.data.accessToken, result.data.refreshToken);
      const destination = returnTo || getSafeReturnTo();
      router.replace(result.data.next === 'onboarding'
        ? withReturnTo('/onboarding', destination)
        : (destination || '/'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }, [login, returnTo, router]);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;
    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: Math.min(400, containerRef.current.clientWidth),
        });
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Google Sign-In unavailable');
      });
    return () => { cancelled = true; };
  }, [clientId, handleCredential]);

  if (!clientId) {
    return <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">Google Sign-In is not configured.</p>;
  }

  return (
    <div className="space-y-2">
      <div className={`flex min-h-11 w-full items-center justify-center ${loading ? 'pointer-events-none opacity-60' : ''}`} ref={containerRef} />
      {loading && <p className="text-center text-xs text-deliivo-gray">Signing in with Google...</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
