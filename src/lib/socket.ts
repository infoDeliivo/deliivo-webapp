'use client';

import { io, Socket } from 'socket.io-client';
import { getTokens } from './api';

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let lifecycleListenersAttached = false;

function resolveSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

function ensureLifecycleListeners() {
  if (typeof window === 'undefined' || lifecycleListenersAttached) return;
  lifecycleListenersAttached = true;

  const reconnect = () => {
    if (document.visibilityState === 'hidden') return;
    const instance = getSocket();
    if (instance && !instance.connected) {
      instance.connect();
    }
  };

  window.addEventListener('focus', reconnect);
  window.addEventListener('online', reconnect);
  document.addEventListener('visibilitychange', reconnect);
}

function startHeartbeat() {
  if (!socket || heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    if (socket?.connected) {
      socket.emit('presence:ping');
    }
  }, 45000);
}

function stopHeartbeat() {
  if (!heartbeatInterval) return;
  clearInterval(heartbeatInterval);
  heartbeatInterval = null;
}

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (socket) {
    const tokens = getTokens();
    if (tokens?.accessToken) {
      socket.auth = { token: tokens.accessToken };
    }
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  const tokens = getTokens();
  const socketUrl = resolveSocketUrl();
  if (!tokens?.accessToken || !socketUrl) return null;

  ensureLifecycleListeners();

  socket = io(socketUrl, {
    auth: { token: tokens.accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
    socket?.emit('presence:ping');
    startHeartbeat();
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    stopHeartbeat();
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    stopHeartbeat();
    socket.disconnect();
    socket = null;
  }
}

// Event listener helpers
export function onSocketEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const s = getSocket();
  if (!s) return () => {};
  s.on(event, handler);
  return () => { s.off(event, handler); };
}

export function emitSocketEvent(event: string, data?: unknown) {
  const s = getSocket();
  if (!s) return;
  s.emit(event, data);
}

// Typed events for the app
export interface LocationUpdate {
  rideId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface NotificationPayload {
  type: 'notification.new';
  data: {
    id: string;
    title: string;
    body: string;
    notificationType: string;
    data?: Record<string, string>;
    preview: boolean;
    createdAt: string;
  };
}

export interface BookingUpdatedPayload {
  bookingId: string;
  rideId: string;
  passengerId?: string;
  status: string;
  previousStatus?: string;
  actor: 'driver' | 'rider' | string;
  action: string;
  updatedAt: string;
}

export interface RideUpdatedPayload {
  rideId: string;
  status: string;
  previousStatus?: string;
  actor: 'driver' | 'rider' | string;
  action: string;
  updatedAt: string;
}
