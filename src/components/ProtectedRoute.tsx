'use client';

import { useAuth } from '@/lib/auth-context';
import { isOnboardingComplete } from '@/lib/onboarding';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isOnboardingRoute = pathname === '/onboarding' || pathname.startsWith('/onboarding/');

  useEffect(() => {
    if (loading) return;

    if (!user) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`/auth/signin?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (!isOnboardingComplete(user) && !isOnboardingRoute) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [isOnboardingRoute, user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-500" />
      </div>
    );
  }

  if (!user) return null;
  if (!isOnboardingComplete(user) && !isOnboardingRoute) return null;

  return <>{children}</>;
}
