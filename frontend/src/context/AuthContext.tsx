import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type UserProfile } from '../lib/api';

interface AuthContextValue {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  setSession: (token: string) => Promise<UserProfile>;
  refreshUser: () => Promise<UserProfile | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cc_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(localStorage.getItem('cc_token')));

  const logout = useCallback(() => {
    localStorage.removeItem('cc_token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    const activeToken = localStorage.getItem('cc_token');
    if (!activeToken) {
      setUser(null);
      setIsLoading(false);
      return null;
    }
    try {
      const profile = await api.getMe();
      setUser(profile);
      return profile;
    } catch {
      logout();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  const setSession = useCallback(async (newToken: string): Promise<UserProfile> => {
    localStorage.setItem('cc_token', newToken);
    setToken(newToken);
    const profile = await api.getMe();
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, setSession, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
