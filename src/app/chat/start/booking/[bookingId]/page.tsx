'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, MessageSquare } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { chatApi, getApiErrorMessage } from '@/lib/api';
import { featureFlags } from '@/lib/features';
import { getSafeReturnTo, withReturnTo } from '@/lib/auth-redirect';

function StartBookingChatContent() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const returnTo = getSafeReturnTo(`?${searchParams.toString()}`);
  const backHref = returnTo || '/rides';

  useEffect(() => {
    if (!bookingId || !featureFlags.webChat) return;

    let cancelled = false;
    async function openConversation() {
      try {
        const res = await chatApi.openBookingConversation(bookingId);
        if (!cancelled) router.replace(withReturnTo(`/chat/${res.data.conversationId || res.data.id}`, returnTo));
      } catch (err: unknown) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Chat is available only while the ride is active.'));
      }
    }

    openConversation();
    return () => {
      cancelled = true;
    };
  }, [bookingId, returnTo, router]);

  if (!featureFlags.webChat) {
    return (
      <div className="min-h-screen bg-deliivo-cream">
        <header className="flex items-center gap-3 border-b border-orange-100 bg-white px-4 py-3">
          <Link href={backHref} className="flex items-center gap-1 text-sm text-gray-600 hover:text-deliivo-orange">
            <ArrowLeft className="h-4 w-4" /> Rides
          </Link>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <MessageSquare className="mx-auto h-10 w-10 text-orange-200" />
            <p className="mt-3 text-base font-semibold text-deliivo-dark">Messages unavailable</p>
            <p className="mt-2 text-sm text-deliivo-gray">Web messages are disabled for this deployment.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-deliivo-cream">
      <header className="flex items-center gap-3 border-b border-orange-100 bg-white px-4 py-3">
        <Link href={backHref} className="flex items-center gap-1 text-sm text-gray-600 hover:text-deliivo-orange">
          <ArrowLeft className="h-4 w-4" /> Rides
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          {error ? (
            <>
              <MessageSquare className="mx-auto h-10 w-10 text-orange-200" />
              <p className="mt-3 text-base font-semibold text-deliivo-dark">Could not open chat</p>
              <p className="mt-2 text-sm text-deliivo-gray">{error}</p>
              <Link href={backHref} className="mt-5 inline-flex rounded-xl bg-deliivo-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
                Back to rides
              </Link>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-deliivo-orange" />
              <p className="mt-3 text-sm font-medium text-deliivo-gray">Opening chat...</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function StartBookingChatPage() {
  return (
    <ProtectedRoute>
      <StartBookingChatContent />
    </ProtectedRoute>
  );
}
