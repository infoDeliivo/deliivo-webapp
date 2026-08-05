'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function scrollToCurrentHash() {
  const hash = window.location.hash;
  if (!hash) return;

  const targetId = decodeURIComponent(hash.slice(1));
  if (!targetId) return;

  const scroll = () => {
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.requestAnimationFrame(scroll);
  window.setTimeout(scroll, 150);
}

export default function HashScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    scrollToCurrentHash();

    const handleHashChange = () => scrollToCurrentHash();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [pathname]);

  return null;
}
