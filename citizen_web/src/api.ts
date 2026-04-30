const BASE_URL = 'https://sdp-backend-y2aq.onrender.com';

async function request(path: string, options: RequestInit = {}) {
  const cleanBase = BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${cleanBase}${cleanPath}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
      ...options,
    });
    
    clearTimeout(timeoutId);
    if (res.status === 404) throw new Error('데이터를 찾을 수 없습니다.');
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || '서버 오류');
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('서버 응답 시간 초과');
    throw err;
  }
}

export const api = {
  login: (kakaoId: string, name: string) => 
    request('/api/auth/kakao', {
      method: 'POST',
      body: JSON.stringify({ kakaoId, name }),
    }),
  
  getMe: (userId: string) => request(`/api/auth/me/${userId}`),
  
  getTreasures: () => request('/api/treasures'),
  
  claimCoin: (payload: any) => 
    request('/api/claim-coin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    
  getBalance: (userId: string) => request(`/api/coins/balance/${userId}`),
  getHistory: (userId: string) => request(`/api/coins/history/${userId}`),
};
