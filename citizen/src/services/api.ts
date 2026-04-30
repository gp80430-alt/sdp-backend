// ─── 성동 패스 API 서비스 (Unified Backend) ───────────────────────────
export const BASE_URL = 'https://sdp-backend-y2aq.onrender.com'; 

async function request(path: string, options: RequestInit = {}) {
  // 주소 끝의 / 와 경로 시작의 / 가 중복되지 않도록 정규화
  const cleanBase = BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${cleanBase}${cleanPath}`;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  
  if (res.status === 404) {
    // 혹시 /api 가 중복되었거나 빠졌을 경우를 대비해 한 번 더 확인 안내
    throw new Error(`주소를 찾을 수 없습니다(404). 호출 주소: ${url}`);
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || '서버 오류');
  return data;
}

// 카카오 로그인 (소셜 ID 기반)
export const kakaoLogin = (kakaoId: string, name: string, phone?: string) =>
  request('/api/auth/kakao', {
    method: 'POST',
    body: JSON.stringify({ kakaoId, name, phone }),
  });

// 내 정보 조회
export async function getMe(userId: string) {
  const res = await fetch(`${BASE_URL}/api/auth/me/${userId}`);
  return await res.json();
}

export async function updateUser(userId: string, data: { name?: string; phone?: string }) {
  const res = await fetch(`${BASE_URL}/api/auth/me/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await res.json();
}
export const getTreasures = () =>
  request('/api/treasures');

// 코인 획득 요청 (GPS 검증 포함)
export const claimCoin = (payload: {
  userId: string;
  treasureId: string;
  lat: number;
  lng: number;
  deviceId: string;
}) =>
  request('/api/claim-coin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// 잔액 조회
export const getBalance = (userId: string) =>
  request(`/api/coins/balance/${userId}`);

// 거래 내역
export const getHistory = (userId: string) =>
  request(`/api/coins/history/${userId}`);

// QR 결제 토큰 생성
export const generateQR = (userId: string, amount: number) =>
  request('/api/coins/generate-qr', {
    method: 'POST',
    body: JSON.stringify({ userId, amount }),
  });

// 가맹점 목록
export const getMerchants = () =>
  request('/api/merchants');
