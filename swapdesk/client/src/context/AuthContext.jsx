import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveSession = (data) => {
    if (data.accessToken) {
      localStorage.setItem('swapdesk_access_token', data.accessToken);
    }
    setUser(data.user || null);
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    saveSession(data);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear the local session even if the server is unavailable.
    }
    localStorage.removeItem('swapdesk_access_token');
    setUser(null);
  };

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        let token = localStorage.getItem('swapdesk_access_token');

        if (!token) {
          const refreshResponse = await api.post('/auth/refresh');
          token = refreshResponse.data.accessToken;
          if (token) localStorage.setItem('swapdesk_access_token', token);
        }

        if (token) {
          const { data } = await api.get('/auth/me');
          if (active) setUser(data.user || data.staff || data);
        }
      } catch {
        localStorage.removeItem('swapdesk_access_token');
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    const handleLogout = () => {
      localStorage.removeItem('swapdesk_access_token');
      setUser(null);
    };

    window.addEventListener('swapdesk:logout', handleLogout);
    loadSession();

    return () => {
      active = false;
      window.removeEventListener('swapdesk:logout', handleLogout);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
