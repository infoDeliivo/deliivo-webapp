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
