'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { getTokens, clearTokens, setTokens, userApi, UserProfile } from './api';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedAtRef = useRef(0);
  const fetchInFlightRef = useRef<Promise<void> | null>(null);
  const fetchRequestIdRef = useRef(0);

  const fetchUser = useCallback((throwOnError = false, force = false) => {
    if (fetchInFlightRef.current && !force) return fetchInFlightRef.current;
    const requestId = ++fetchRequestIdRef.current;

    const request = (async () => {
      const tokens = getTokens();
      if (!tokens) {
        if (requestId === fetchRequestIdRef.current) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      try {
        const res = await userApi.getMe();
        if (requestId === fetchRequestIdRef.current) {
          setUser(res.data);
        }
      } catch (error) {
        if (requestId === fetchRequestIdRef.current) {
          clearTokens();
          setUser(null);
        }
        if (throwOnError) throw error;
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          lastFetchedAtRef.current = Date.now();
          setLoading(false);
        }
      }
    })();

    fetchInFlightRef.current = request;
    const clearInFlight = () => {
      if (fetchInFlightRef.current === request) fetchInFlightRef.current = null;
    };
    void request.then(clearInFlight, clearInFlight);
    return request;
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refreshOnResume = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchedAtRef.current >= 60000) {
        void fetchUser();
      }
    };
    window.addEventListener('focus', refreshOnResume);
    window.addEventListener('online', refreshOnResume);
    document.addEventListener('visibilitychange', refreshOnResume);
    return () => {
      window.removeEventListener('focus', refreshOnResume);
      window.removeEventListener('online', refreshOnResume);
      document.removeEventListener('visibilitychange', refreshOnResume);
    };
  }, [fetchUser]);

  const login = async (accessToken: string, refreshToken: string) => {
    setLoading(true);
    setTokens({ accessToken, refreshToken });
    await fetchUser(true, true);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    window.location.href = '/';
  };

  const refreshUser = fetchUser;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
