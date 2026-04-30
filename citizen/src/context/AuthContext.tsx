import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../services/api';

interface User {
  id: string;
  name: string;
  phone: string;
  balance: number;
  title?: string;
  total_earned?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (kakaoId: string, name: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);

  // 실시간 동기화용 소켓 연결
  useEffect(() => {
    if (!user) return;

    const wsUrl = api.BASE_URL.replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      // 내 관련 코인 이벤트(획득/결제)가 발생하면 즉시 잔액 새로고침
      if ((data.event === 'COIN_CLAIMED' || data.event === 'COIN_SPENT') && data.userName === user.name) {
        refreshBalance();
      }
    };

    return () => ws.close();
  }, [user?.id]);

  useEffect(() => {
    // 앱 시작 시 저장된 유저 복원 및 최신 정보 동기화
    AsyncStorage.getItem('sdp_user').then(async (raw) => {
      if (raw) {
        const savedUser = JSON.parse(raw);
        setUser(savedUser);
        // 서버에서 최신 등급/잔액 정보 가져오기
        try {
          const meRes = await api.getMe(savedUser.id);
          const updated = { ...savedUser, balance: meRes.balance, title: meRes.title };
          setUser(updated);
          await AsyncStorage.setItem('sdp_user', JSON.stringify(updated));
        } catch (e) {
          console.log('초기 동기화 실패:', e);
        }
      }
      setLoading(false);
    });
  }, []);

  const login = async (kakaoId: string, name: string, phone?: string) => {
    const res  = await api.kakaoLogin(kakaoId, name, phone);
    const meRes = await api.getMe(res.user.id);
    const fullUser = { ...res.user, balance: meRes.balance, title: meRes.title };
    setUser(fullUser);
    await AsyncStorage.setItem('sdp_user', JSON.stringify(fullUser));
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('sdp_user');
  };

  const refreshBalance = async () => {
    if (!user) return;
    try {
      const meRes = await api.getMe(user.id);
      const updated = { ...user, balance: meRes.balance, title: meRes.title };
      setUser(updated);
      await AsyncStorage.setItem('sdp_user', JSON.stringify(updated));
    } catch (e) {
      console.error('잔액 갱신 실패:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshBalance }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
