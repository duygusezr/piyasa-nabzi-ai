import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
}

interface AuthContextValue extends AuthState {
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ token: null, user: null });
  const [isLoading, setIsLoading] = useState(true);

  // Uygulama açılışında localStorage'dan token yükle ve doğrula
  useEffect(() => {
    const stored = localStorage.getItem('pn_auth');
    if (!stored) {
      setIsLoading(false);
      return;
    }
    try {
      const parsed: AuthState = JSON.parse(stored);
      if (!parsed.token) {
        setIsLoading(false);
        return;
      }
      // Token'ı sunucuya doğrulat
      fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${parsed.token}` },
      })
        .then(async (res) => {
          if (res.ok) {
            const user = await res.json();
            setAuth({ token: parsed.token, user: { id: user.id, email: user.email } });
          } else {
            localStorage.removeItem('pn_auth');
          }
        })
        .catch(() => {
          localStorage.removeItem('pn_auth');
        })
        .finally(() => setIsLoading(false));
    } catch {
      localStorage.removeItem('pn_auth');
      setIsLoading(false);
    }
  }, []);

  const _persist = (state: AuthState) => {
    setAuth(state);
    localStorage.setItem('pn_auth', JSON.stringify(state));
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Giriş başarısız.');
    }
    const data = await res.json();
    _persist({ token: data.token, user: data.user });
  };

  const register = async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Kayıt başarısız.');
    }
    const data = await res.json();
    _persist({ token: data.token, user: data.user });
  };

  const logout = () => {
    setAuth({ token: null, user: null });
    localStorage.removeItem('pn_auth');
  };

  return (
    <AuthContext.Provider value={{ ...auth, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
