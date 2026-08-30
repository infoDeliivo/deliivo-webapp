'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CONSENT_UPDATED_EVENT, readConsent } from '@/lib/consent';
import { publicConfig } from '@/lib/public-config';

type FbqFunction = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
    _deliivoMetaPixelLoaded?: boolean;
  }
}

function loadMetaPixel(pixelId: string): void {
  if (typeof window === 'undefined' || window._deliivoMetaPixelLoaded) return;

  window.fbq =
    window.fbq ||
    function fbqProxy(...args: unknown[]) {
      const fbq = window.fbq as FbqFunction & { callMethod?: FbqFunction; queue?: unknown[][] };
      if (fbq.callMethod) {
        fbq.callMethod(...args);
        return;
      }
      fbq.queue = fbq.queue || [];
      fbq.queue.push(args);
    };
  window._fbq = window.fbq;
  (window.fbq as FbqFunction & { queue?: unknown[][] }).queue = (window.fbq as FbqFunction & { queue?: unknown[][] }).queue || [];
  window._deliivoMetaPixelLoaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

export default function MetaPixel(): null {
  const pathname = usePathname();
  const pixelId = publicConfig.metaPixelId.trim();
  const isAdminRoute = pathname?.startsWith('/admin');

  useEffect(() => {
    if (!pixelId || isAdminRoute || typeof window === 'undefined') return;

    const syncPixel = () => {
      const consent = readConsent();
      if (!consent?.marketing) return;
      const alreadyLoaded = Boolean(window._deliivoMetaPixelLoaded);
      loadMetaPixel(pixelId);
      if (alreadyLoaded) {
        window.fbq?.('track', 'PageView');
      }
    };

    syncPixel();
    window.addEventListener(CONSENT_UPDATED_EVENT, syncPixel as EventListener);
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, syncPixel as EventListener);
  }, [isAdminRoute, pixelId, pathname]);

  return null;
}
