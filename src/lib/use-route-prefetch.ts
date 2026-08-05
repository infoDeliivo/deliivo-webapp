'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function getPrefetchPath(href: string) {
  if (!href.startsWith('/')) return null;
  const [withoutHash] = href.split('#');
  const [pathname] = withoutHash.split('?');
  return pathname || '/';
}

type BrowserWindowWithIdleCallback = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useRoutePrefetch(hrefs: string[]) {
  const router = useRouter();
  const hrefKey = hrefs.join('|');

  useEffect(() => {
    const paths = Array.from(new Set(hrefs.map(getPrefetchPath).filter(Boolean))) as string[];
    if (paths.length === 0) return;

    const prefetch = () => {
      paths.forEach((path) => router.prefetch(path));
    };

    const browserWindow = window as BrowserWindowWithIdleCallback;

    if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(prefetch, { timeout: 1000 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = browserWindow.setTimeout(prefetch, 250);
    return () => browserWindow.clearTimeout(timeoutId);
  }, [hrefKey, router]);
}

export function prefetchHref(router: ReturnType<typeof useRouter>, href: string) {
  const path = getPrefetchPath(href);
  if (path) router.prefetch(path);
}
