'use client';

import { useMemo, useState } from 'react';
import { Bell, ChevronRight, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { NotificationRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useNotificationStore } from '@/lib/notification-store';

type Props = {
  title?: string;
  maxItems?: number;
  className?: string;
};

function getString(data: Record<string, unknown> | null, key: string): string | null {
  if (!data) return null;
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getNotificationLink(item: NotificationRecord): string | null {
  const data = item.data;
  const rideId = getString(data, 'rideId');
  const bookingId = getString(data, 'bookingId');
  const deepLink = getString(data, 'deepLink');
  const liveTrackingUrl = getString(data, 'liveTrackingUrl');

  if (deepLink?.startsWith('app://driver/booking-request/')) {
    return rideId ? `/rides/${rideId}/manage${bookingId ? `?bookingId=${bookingId}` : ''}` : null;
  }

  if (liveTrackingUrl) {
    return liveTrackingUrl.startsWith('http') ? liveTrackingUrl : liveTrackingUrl;
  }

  if (deepLink?.startsWith('app://booking/')) {
    return rideId ? `/rides/${rideId}${bookingId ? `?bookingId=${bookingId}` : ''}` : null;
  }

  if (rideId) {
    return `/rides/${rideId}`;
  }

  return null;
}

export default function NotificationPanel({
  title = 'Notifications',
  maxItems = 5,
  className = '',
}: Props) {
  const { user } = useAuth();
  const { items, loading, refresh, remove, clearAll, lastError } = useNotificationStore(user?.id);
  const [confirmClear, setConfirmClear] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [operationError, setOperationError] = useState('');
  const visibleItems = useMemo<NotificationRecord[]>(() => items.slice(0, maxItems), [items, maxItems]);

  const content = (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-0 py-3">
        <p className="text-sm font-semibold text-deliivo-dark">{title}</p>
        <div className="flex items-center gap-2">
          {items.length > 0 && (confirmClear ? (
            <>
              <button type="button" onClick={() => setConfirmClear(false)} className="text-xs font-semibold text-deliivo-gray hover:text-deliivo-dark">Cancel</button>
              <button
                type="button"
                disabled={clearing}
                onClick={async () => {
                  setClearing(true);
                  setOperationError('');
                  try {
                    await clearAll();
                    setConfirmClear(false);
                  } catch {
                    setOperationError('Could not clear notifications. Please try again.');
                  } finally {
                    setClearing(false);
                  }
                }}
                className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {clearing ? 'Clearing...' : 'Confirm clear'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className="text-xs font-semibold text-deliivo-gray hover:text-red-600">Clear all</button>
          ))}
          <button
            type="button"
            onClick={() => { void refresh(); }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-deliivo-dark hover:bg-gray-50"
            aria-label="Refresh notifications"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {operationError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {operationError}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-deliivo-gray">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications...
          </div>
        ) : lastError ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {lastError}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-orange-50/60 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-deliivo-orange shadow-sm">
              <Bell className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm font-semibold text-deliivo-dark">You are all caught up</p>
            <p className="mt-1 text-sm text-deliivo-gray">New ride and booking updates will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => {
              const href = getNotificationLink(item);

              return (
                <article
                  key={item.id}
                  className={`rounded-2xl border px-4 py-4 transition-colors ${item.isRead ? 'border-gray-200 bg-white' : 'border-orange-200 bg-orange-50/50'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.isRead ? 'bg-gray-100 text-deliivo-gray' : 'bg-white text-deliivo-orange shadow-sm'}`}>
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-deliivo-dark">{item.title}</p>
                        <button
                          type="button"
                          disabled={removingId === item.id}
                          onClick={async () => {
                            setRemovingId(item.id);
                            setOperationError('');
                            try {
                              await remove(item.id);
                            } catch {
                              setOperationError('Could not remove the notification. Please try again.');
                            } finally {
                              setRemovingId(null);
                            }
                          }}
                          className="rounded-lg p-1.5 text-deliivo-gray hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label="Remove notification"
                          title="Remove notification"
                        >
                          {removingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-deliivo-gray">{item.body}</p>
                      <p className="mt-2 text-xs text-deliivo-gray">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                      {href && (
                        <div className="mt-3">
                          <a href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-deliivo-orange hover:underline">
                            Open ride <ChevronRight className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return content;
}
