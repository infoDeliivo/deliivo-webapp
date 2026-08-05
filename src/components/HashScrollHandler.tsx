'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SCROLL_RETRY_DELAYS_MS = [0, 50, 150, 300, 600, 1000, 1600];

function scheduleHashScroll(hash = window.location.hash) {
  if (!hash) return;

  const targetId = decodeURIComponent(hash.slice(1));
  if (!targetId) return;

  const tryScroll = () => {
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.requestAnimationFrame(tryScroll);
  SCROLL_RETRY_DELAYS_MS.forEach((delay) => window.setTimeout(tryScroll, delay));
}

export default function HashScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    scheduleHashScroll();

    const handleHashChange = () => scheduleHashScroll();
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href*="#"]') : null;
      if (!target) return;

      const targetUrl = new URL(target.href, window.location.href);
      if (targetUrl.origin !== window.location.origin || !targetUrl.hash) return;

      scheduleHashScroll(targetUrl.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    document.addEventListener('click', handleClick, true);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
      document.removeEventListener('click', handleClick, true);
    };
  }, [pathname]);

  return null;
}
