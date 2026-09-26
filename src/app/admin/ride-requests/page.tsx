'use client';
import RideRequestBoard from '@/components/RideRequestBoard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth-context';
import { rideRequestsEnabled } from '@/lib/ride-requests';
export default function Page() {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {user?.role === 'ADMIN' && rideRequestsEnabled ? (
        <RideRequestBoard admin />
      ) : (
        <p>Ride request administration is unavailable.</p>
      )}
    </ProtectedRoute>
  );
}
