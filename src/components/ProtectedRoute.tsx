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
  // Admins skip onboarding, matching resolvePostLoginPath: the seeded admin has no
  // rider details and would otherwise be bounced off every protected admin page.
  const needsOnboarding = !!user && user.role !== 'ADMIN' && !isOnboardingComplete(user) && !isOnboardingRoute;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`/auth/signin?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (needsOnboarding) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.replace(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [needsOnboarding, user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-500" />
      </div>
    );
  }

  if (!user) return null;
  if (needsOnboarding) return null;

  return <>{children}</>;
}
