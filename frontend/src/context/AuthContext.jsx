import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, getMe, logoutUser } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('hrms_token'));
  const [loading, setLoading] = useState(true); // true on first load — checks existing session

  // ── On mount: rehydrate session from localStorage ─────────────────────────
  useEffect(() => {
    const rehydrate = async () => {
      const storedToken = localStorage.getItem('hrms_token');
      if (!storedToken) { setLoading(false); return; }
      try {
        const { data } = await getMe();
        setUser(data.user);
      } catch {
        // Token expired or invalid — clear everything
        localStorage.removeItem('hrms_token');
        localStorage.removeItem('hrms_user');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    rehydrate();
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await loginUser({ email, password });
    localStorage.setItem('hrms_token', data.token);
    localStorage.setItem('hrms_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user; // caller uses role to redirect
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try { await logoutUser(); } catch { /* silent */ }
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_user');
    setToken(null);
    setUser(null);
  }, []);

  const value = { user, token, loading, login, logout, isAuthenticated: !!token };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
