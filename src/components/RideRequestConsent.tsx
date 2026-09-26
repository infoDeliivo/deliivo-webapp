'use client';

import Link from 'next/link';
import { authApi, type UserProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export async function acceptRideRequestConsent(user: UserProfile | null, data: FormData) {
  if (!user) throw new Error('Sign in before using ride requests.');
  if (user.tosAcceptedAt && user.privacyAcceptedAt) return;
  if (data.get('rideRequestConsent') !== 'on') {
    throw new Error('Accept the Terms of Service and Privacy Policy before continuing.');
  }
  await authApi.acceptTos('1.0', '1.0');
}

export default function RideRequestConsent({ disabled = false }: { disabled?: boolean }) {
  const { user } = useAuth();
  if (user?.tosAcceptedAt && user?.privacyAcceptedAt) return null;
  return (
    <label className="flex items-start gap-3 rounded-xl bg-orange-50 p-4 text-sm">
      <input name="rideRequestConsent" type="checkbox" required disabled={disabled} className="mt-1" />
      <span>
        I accept the{' '}
        <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-deliivo-orange underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-deliivo-orange underline">
          Privacy Policy
        </Link>.
      </span>
    </label>
  );
}
