import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

interface User {
  id: string;
  name: string;
  balance: number;
  title?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (name: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('sdp_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed);
      api.getMe(parsed.id).then(me => {
        const updated = { ...parsed, balance: me.balance, title: me.title };
        setUser(updated);
        localStorage.setItem('sdp_user', JSON.stringify(updated));
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (name: string) => {
    const kakaoId = `web_${name}_${Math.floor(Math.random() * 10000)}`;
    const res = await api.login(kakaoId, name);
    const me = await api.getMe(res.user.id);
    const fullUser = { ...res.user, balance: me.balance, title: me.title };
    setUser(fullUser);
    localStorage.setItem('sdp_user', JSON.stringify(fullUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sdp_user');
  };

  const refresh = async () => {
    if (!user) return;
    const me = await api.getMe(user.id);
    const updated = { ...user, balance: me.balance, title: me.title };
    setUser(updated);
    localStorage.setItem('sdp_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
