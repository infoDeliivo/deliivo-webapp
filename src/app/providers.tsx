'use client';

import { AuthProvider } from '@/lib/auth-context';
import NotificationToast from '@/components/NotificationToast';
import OngoingRidePanel from '@/components/OngoingRidePanel';
import AppFeedbackToast from '@/components/AppFeedbackToast';
import { I18nProvider } from '@/lib/i18n-context';
import ConnectivityBanner from '@/components/ConnectivityBanner';
import RecoveryOutboxSync from '@/components/RecoveryOutboxSync';
import HashScrollHandler from '@/components/HashScrollHandler';
import CrispChat from '@/components/CrispChat';
import ConsentBanner from '@/components/ConsentBanner';
import MetaPixel from '@/components/MetaPixel';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        {children}
        <HashScrollHandler />
        <ConnectivityBanner />
        <RecoveryOutboxSync />
        <OngoingRidePanel />
        <AppFeedbackToast />
        <NotificationToast />
        <ConsentBanner />
        <CrispChat />
        <MetaPixel />
      </AuthProvider>
    </I18nProvider>
  );
}
