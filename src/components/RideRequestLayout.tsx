'use client';
import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import ProtectedRoute from './ProtectedRoute';
import { rideRequestsEnabled } from '@/lib/ride-requests';
import Link from 'next/link';

export default function RideRequestLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {rideRequestsEnabled ? (
            children
          ) : (
            <div className="rounded-2xl bg-white p-8">
              <h1 className="text-2xl font-bold">Ride requests are coming soon</h1>
              <Link href="/search" className="mt-4 inline-block text-deliivo-orange">
                Find an existing ride
              </Link>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
