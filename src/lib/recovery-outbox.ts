import { ApiError, rideOpsApi } from './api';

const STORAGE_KEY = 'deliivo_manual_recovery_outbox_v1';

export type RecoveryAction = {
  actionId: string;
  eventType: string;
  rideId: string;
  bookingId?: string;
  lat?: number;
  lng?: number;
  clientTimestamp: string;
  overrideReason: string;
};

function readActions(): RecoveryAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeActions(actions: RecoveryAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  window.dispatchEvent(new CustomEvent('deliivo:recovery-outbox', { detail: actions.length }));
}

export function isRecoverableServerFailure(error: unknown) {
  return (typeof navigator !== 'undefined' && !navigator.onLine)
    || (error instanceof ApiError && (error.status === 0 || error.status >= 500));
}

export function enqueueRecoveryAction(input: Omit<RecoveryAction, 'actionId' | 'clientTimestamp'>) {
  const action: RecoveryAction = {
    ...input,
    actionId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clientTimestamp: new Date().toISOString(),
  };
  writeActions([...readActions(), action]);
  return action;
}

export async function flushRecoveryOutbox() {
  const actions = readActions();
  if (actions.length === 0 || !navigator.onLine) return { remaining: actions.length };

  const response = await rideOpsApi.syncOfflineActions(actions);
  const completed = new Set(response.data.results
    .filter((result) => result.status === 'processed' || result.status === 'duplicate')
    .map((result) => result.actionId));
  const remaining = actions.filter((action) => !completed.has(action.actionId));
  writeActions(remaining);
  return { remaining: remaining.length };
}
