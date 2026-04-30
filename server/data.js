// ── 인메모리 데이터베이스 (실제 서비스는 PostgreSQL/MongoDB 대체) ──
const { v4: uuidv4 } = require('uuid');

// ── 보물 장소 (성동구 실제 좌표) ──────────────────────────────────
const TREASURES = [
  {
    id: 'T001',
    name: '응봉산 팔각정',
    description: '봄 개나리 명소! 팔각정 앞에서 성동 코인을 찾아보세요.',
    lat: 37.550473,
    lng: 127.024915,
    coinReward: 3,
    icon: '🏯',
    radius: 50,         // 인정 반경(m)
    isActive: true,
    claimedBy: [],      // [{userId, claimedAt}]
    dailyLimit: 100,
  },
  {
    id: 'T002',
    name: '서울숲 솔밭 광장',
    description: '피크닉 명소 솔밭 광장에서 코인을 잡아요!',
    lat: 37.544122,
    lng: 127.037418,
    coinReward: 2,
    icon: '🌲',
    radius: 50,
    isActive: true,
    claimedBy: [],
    dailyLimit: 200,
  },
  {
    id: 'T003',
    name: '성동구청 광장',
    description: '성동구청 앞 광장에서 구민 특별 코인!',
    lat: 37.563597,
    lng: 127.036813,
    coinReward: 1,
    icon: '🏛️',
    radius: 50,
    isActive: true,
    claimedBy: [],
    dailyLimit: 500,
  },
  {
    id: 'T004',
    name: '왕십리 광장',
    description: '왕십리역 앞 광장 — 도심 속 보물찾기!',
    lat: 37.561446,
    lng: 127.038580,
    coinReward: 2,
    icon: '🚉',
    radius: 50,
    isActive: true,
    claimedBy: [],
    dailyLimit: 300,
  },
  {
    id: 'T005',
    name: '뚝섬한강공원 피크닉존',
    description: '한강을 바라보며 코인을 수집하세요!',
    lat: 37.530797,
    lng: 127.066207,
    coinReward: 3,
    icon: '🌊',
    radius: 50,
    isActive: true,
    claimedBy: [],
    dailyLimit: 150,
  },
  {
    id: 'T006',
    name: '금호동 벽화마을',
    description: '예쁜 벽화가 가득한 골목에서 숨겨진 코인!',
    lat: 37.554500,
    lng: 127.019200,
    coinReward: 2,
    icon: '🎨',
    radius: 50,
    isActive: false,
    claimedBy: [],
    dailyLimit: 80,
  },
  {
    id: 'T007',
    name: '성수 카페거리',
    description: '핫한 성수동에서 특별 한정 코인!',
    lat: 37.544600,
    lng: 127.056300,
    coinReward: 5,
    icon: '☕',
    radius: 50,
    isActive: true,
    claimedBy: [],
    dailyLimit: 50,
  },
  {
    id: 'T008',
    name: '마장체육센터',
    description: '수영장 근처에서 코인을 획득하세요!',
    lat: 37.567123,
    lng: 127.045456,
    coinReward: 2,
    icon: '🏊',
    radius: 50,
    isActive: true,
    claimedBy: [],
    dailyLimit: 100,
  },
  {
    id: 'T009',
    name: '성수 구두공원',
    description: '구두 테마 공원에서 특별한 코인을!',
    lat: 37.542345,
    lng: 127.054321,
    coinReward: 3,
    icon: '👞',
    radius: 50,
    isActive: true,
    claimedBy: [],
    dailyLimit: 100,
  },
  {
    id: 'T010',
    name: '사근동 한양대',
    description: '캠퍼스 내에서 보물을 찾아보세요.',
    lat: 37.558789,
    lng: 127.048123,
    coinReward: 2,
    icon: '🎓',
    radius: 50,
    isActive: true,
    claimedBy: [],
    dailyLimit: 150,
  },
];

// ── 사용처(가맹점) ─────────────────────────────────────────────
const MERCHANTS = [
  { id: 'M001', name: '응봉산 축제 푸드트럭', type: '음식', discount: '1코인 = 핫도그 1개', icon: '🌭' },
  { id: 'M002', name: '성동 생활체육센터 수영장', type: '레저', discount: '5코인 = 1일 이용권', icon: '🏊' },
  { id: 'M003', name: '성동 헬스장 3곳', type: '운동', discount: '10코인 = 1개월 20% 할인', icon: '💪' },
  { id: 'M004', name: '성동구 공공도서관', type: '문화', discount: '2코인 = 도서 연체료 면제', icon: '📚' },
  { id: 'M005', name: '서울숲 카페', type: '음료', discount: '1코인 = 아이스 아메리카노', icon: '🧋' },
];

// ── 유저 저장소 ─────────────────────────────────────────────────
const USERS = [
  // 시드 관리자 유저
  {
    id: 'U_ADMIN',
    name: '성동구청 관리자',
    phone: '02-2286-5000',
    kakaoId: 'admin_kakao',
    isAdmin: true,
    balance: 0,
    createdAt: Date.now() - 86400000 * 30,
  },
  // 시드 일반 유저
  {
    id: 'U001',
    name: '김성동',
    phone: '010-1234-5678',
    kakaoId: 'kakao_001',
    isAdmin: false,
    balance: 0,
    createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'U002',
    name: '이응봉',
    phone: '010-9876-5432',
    kakaoId: 'kakao_002',
    isAdmin: false,
    balance: 0,
    createdAt: Date.now() - 86400000 * 3,
  },
];

// ── QR 결제 토큰 저장소 ────────────────────────────────────────
const QR_TOKENS = new Map(); // token -> { userId, amount, expiresAt }

// ── 헬퍼 ───────────────────────────────────────────────────────
function findUser(userId)    { return USERS.find(u => u.id === userId); }
function findTreasure(tid)   { return TREASURES.find(t => t.id === tid); }
function findMerchant(mid)   { return MERCHANTS.find(m => m.id === mid); }
function createUser(data) {
  const user = { id: uuidv4(), isAdmin: false, createdAt: Date.now(), ...data };
  USERS.push(user);
  return user;
}
function createQRToken(userId, amount) {
  const token = uuidv4();
  QR_TOKENS.set(token, { userId, amount, expiresAt: Date.now() + 5 * 60_000 });
  return token;
}

module.exports = { TREASURES, MERCHANTS, USERS, QR_TOKENS, findUser, findTreasure, findMerchant, createUser, createQRToken };
