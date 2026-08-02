export function getSafeReturnTo(search?: string): string | null {
  if (typeof window === 'undefined' && search === undefined) return null;

  const query = search ?? window.location.search;
  const returnTo = new URLSearchParams(query).get('returnTo');
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return null;
  if (returnTo.startsWith('/auth/')) return null;
  if (returnTo === '/onboarding' || returnTo.startsWith('/onboarding?') || returnTo.startsWith('/onboarding/')) return null;
  return returnTo;
}

export function withReturnTo(path: string, returnTo: string | null): string {
  if (!returnTo) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

type PostLoginUser = {
  role?: 'USER' | 'ADMIN';
  onboardingStatus?: 'PENDING' | 'COMPLETED';
  firstName?: string;
  lastName?: string;
  salutation?: string | null;
  gender?: string | null;
  dob?: string | null;
};

/**
 * Where a user lands after signing in. Every entry point (sign-in, sign-up, Google)
 * routes through here so they cannot drift apart.
 *
 * Admins go straight to the console. Onboarding collects rider details — salutation,
 * gender, date of birth — that an admin account has no use for, and the seeded admin
 * has none of them, so the default path would trap it on a form it should never see.
 * An explicit returnTo still wins: an admin following a deep link means to go there.
 */
export function resolvePostLoginPath(
  user: PostLoginUser | null | undefined,
  destination: string | null,
  onboardingComplete: boolean,
): string {
  if (user?.role === 'ADMIN') return destination || '/admin';
  if (onboardingComplete) return destination || '/';
  // Onboarding carries the destination so it can hand the user on once complete.
  return withReturnTo('/onboarding', destination);
}
