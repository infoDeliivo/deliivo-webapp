'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { flushRecoveryOutbox } from '@/lib/recovery-outbox';

export default function RecoveryOutboxSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const flush = () => { void flushRecoveryOutbox().catch(() => {}); };
    flush();
    window.addEventListener('online', flush);
    const interval = window.setInterval(flush, 30000);
    return () => {
      window.removeEventListener('online', flush);
      window.clearInterval(interval);
    };
  }, [user]);

  return null;
}
