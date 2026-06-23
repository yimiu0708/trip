import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../api/client';

export interface User {
  id: number;
  username: string;
  role?: string;
  created_at?: string;
  forcePasswordChange?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  passwordChanged: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('trip_token');
    if (token) {
      api.auth.me()
        .then((u: User) => setUser(u))
        .catch(() => localStorage.removeItem('trip_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.auth.login(username, password);
    localStorage.setItem('trip_token', res.token);
    setUser(res.user);
    void api.events.track('app_session_start', { method: 'password' }).catch(() => undefined);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await api.auth.register(username, password);
    localStorage.setItem('trip_token', res.token);
    setUser(res.user);
    void api.events.track('app_session_start', { method: 'registration' }).catch(() => undefined);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('trip_token');
    setUser(null);
  }, []);

  const passwordChanged = useCallback(() => {
    setUser((current) => current ? { ...current, forcePasswordChange: false } : current);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, passwordChanged }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
