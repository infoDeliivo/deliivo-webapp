'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { publicConfig } from '@/lib/public-config';

declare global {
  interface Window {
    $crisp?: Array<any>;
    CRISP_WEBSITE_ID?: string;
  }
}

const CRISP_RUNTIME_KEY = '__deliivo_crisp_loaded__';

export default function CrispChat() {
  const pathname = usePathname();
  const { user } = useAuth();
  const websiteId = publicConfig.crispWebsiteId.trim();
  const isAdminRoute = pathname?.startsWith('/admin');

  useEffect(() => {
    if (!websiteId || isAdminRoute || typeof window === 'undefined' || !window.$crisp) {
      return;
    }

    const nickname = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

    if (user?.email) {
      window.$crisp.push(['set', 'user:email', [user.email]]);
    }
    if (user?.phone) {
      window.$crisp.push(['set', 'user:phone', [user.phone]]);
    }
    if (nickname) {
      window.$crisp.push(['set', 'user:nickname', [nickname]]);
    }
    if (user?.avatarUrl) {
      window.$crisp.push(['set', 'user:avatar', [user.avatarUrl]]);
    }

    const sessionData = [
      ['app_route', pathname || '/'],
      ['user_role', user?.role || 'GUEST'],
      ['user_id', user?.id || 'anonymous'],
    ];

    window.$crisp.push(['set', 'session:data', [sessionData]]);
  }, [isAdminRoute, pathname, user, websiteId]);

  useEffect(() => {
    if (!websiteId || typeof window === 'undefined' || !window.$crisp) return;

    if (isAdminRoute) {
      window.$crisp.push(['do', 'chat:hide']);
      return;
    }

    window.$crisp.push(['do', 'chat:show']);
  }, [isAdminRoute, websiteId]);

  if (!websiteId || isAdminRoute) {
    return null;
  }

  return (
    <Script id="crisp-chat" strategy="afterInteractive">
      {`
        window.$crisp = window.$crisp || [];
        window.CRISP_WEBSITE_ID = "${websiteId}";
        if (!window.${CRISP_RUNTIME_KEY}) {
          window.${CRISP_RUNTIME_KEY} = true;
          (function() {
            var d = document;
            var s = d.createElement("script");
            s.src = "https://client.crisp.chat/l.js";
            s.async = 1;
            d.getElementsByTagName("head")[0].appendChild(s);
          })();
        }
      `}
    </Script>
  );
}
