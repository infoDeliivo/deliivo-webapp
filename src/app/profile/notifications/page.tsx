'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import NotificationPanel from '@/components/NotificationPanel';
import { useTranslation } from '@/lib/i18n-context';

export default function NotificationsPage() {
  const { t } = useTranslation();

  return (
    <ProtectedRoute>
      <Navbar />
      <main className="min-h-[calc(100vh-72px)] w-full bg-[radial-gradient(circle_at_top_left,#fff5eb_0%,#fffaf5_42%,#f7f7f5_100%)] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-7">
            <h1 className="text-3xl font-bold tracking-tight text-deliivo-dark">{t('nav.notifications')}</h1>
            <p className="mt-2 text-sm leading-6 text-deliivo-gray">
              Ride requests, messages, payments, and trip updates in one place.
            </p>
          </div>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            <NotificationPanel maxItems={50} />
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
