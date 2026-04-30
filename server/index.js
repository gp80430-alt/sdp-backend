/**
 * 성동 패스 (SDP) — 메인 Express 서버
 * PORT 3000 (API) | WebSocket 실시간 업데이트
 */

const express    = require('express');
const cors       = require('cors');
const { v4: uuidv4 } = require('uuid');
const http       = require('http');
const { WebSocketServer } = require('ws');

const blockchain          = require('./blockchain');
const { haversine }       = require('./haversine');
const {
  TREASURES, MERCHANTS, USERS, QR_TOKENS,
  findUser, findTreasure, findMerchant, createUser, createQRToken,
} = require('./data');

// ── Express 설정 ───────────────────────────────────────────────
const app  = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json());

// ── WebSocket (실시간 코인 획득 알림) ──────────────────────────
const wss = new WebSocketServer({ server });
function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

// ════════════════════════════════════════════════════════════════
//  AUTH 라우트
// ════════════════════════════════════════════════════════════════

// 카카오 소셜 로그인 (실제 OAuth는 생략, ID 기반 매핑)
app.post('/api/auth/kakao', (req, res) => {
  const { kakaoId, name, phone } = req.body;
  if (!kakaoId) return res.status(400).json({ error: '카카오 ID 필요' });

  let user = USERS.find(u => u.kakaoId === kakaoId);
  if (!user) {
    user = createUser({ kakaoId, name: name || '성동 시민', phone: phone || '' });
  }

  res.json({ success: true, user: sanitizeUser(user) });
});

// 내 정보 조회
app.get('/api/auth/me/:userId', (req, res) => {
  const user = findUser(req.params.userId);
  if (!user) return res.status(404).json({ error: '유저 없음' });
  const balance = blockchain.getBalance(user.id);
  res.json({ ...sanitizeUser(user), balance });
});

// ════════════════════════════════════════════════════════════════
//  보물(TREASURE) 라우트
// ════════════════════════════════════════════════════════════════

// 활성 보물 목록
app.get('/api/treasures', (req, res) => {
  const list = TREASURES
    .filter(t => t.isActive)
    .map(t => ({
      id:          t.id,
      name:        t.name,
      description: t.description,
      lat:         t.lat,
      lng:         t.lng,
      coinReward:  t.coinReward,
      icon:        t.icon,
      radius:      t.radius,
      claimedCount: t.claimedBy.length,
    }));
  res.json({ treasures: list });
});

// 보물 획득 요청 (/api/claim-coin)
app.post('/api/claim-coin', (req, res) => {
  const { userId, treasureId, lat, lng, deviceId } = req.body;

  // 1. 유저 확인
  const user = findUser(userId);
  if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

  // 2. 보물 확인
  const treasure = findTreasure(treasureId);
  if (!treasure || !treasure.isActive)
    return res.status(404).json({ error: '보물을 찾을 수 없습니다.' });

  // 3. 오늘 이미 획득했는지 확인
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const alreadyClaimed = treasure.claimedBy.some(
    c => c.userId === userId && c.claimedAt >= todayStart.getTime()
  );
  if (alreadyClaimed)
    return res.status(409).json({ error: '오늘 이미 이 장소에서 코인을 획득했습니다.' });

  // 4. Haversine 거리 검증
  const dist = haversine(lat, lng, treasure.lat, treasure.lng);
  if (dist > treasure.radius)
    return res.status(403).json({
      error: `현재 위치가 너무 멉니다. (${Math.round(dist)}m / 허용 ${treasure.radius}m)`,
      distance: Math.round(dist),
    });

  // 5. 블록체인에 기록
  const block = blockchain.addBlock({
    type:       'EARN',
    userId:     user.id,
    treasureId: treasure.id,
    treasureName: treasure.name,
    amount:     treasure.coinReward,
    lat, lng,
    deviceId:   deviceId || 'unknown',
  });

  // 6. 획득 기록 저장
  treasure.claimedBy.push({ userId, claimedAt: Date.now(), blockHash: block.hash });

  // 7. WebSocket 브로드캐스트
  broadcast({
    event: 'COIN_CLAIMED',
    userName: user.name,
    treasureName: treasure.name,
    amount: treasure.coinReward,
    blockHash: block.hash.slice(0, 12) + '...',
    timestamp: Date.now(),
  });

  res.json({
    success: true,
    message: `🎉 ${treasure.coinReward} 성동 코인을 획득했습니다!`,
    earned:  treasure.coinReward,
    newBalance: blockchain.getBalance(user.id),
    block: { hash: block.hash, index: block.index },
  });
});

// ════════════════════════════════════════════════════════════════
//  코인/잔액 라우트
// ════════════════════════════════════════════════════════════════

// 잔액 조회
app.get('/api/coins/balance/:userId', (req, res) => {
  const user = findUser(req.params.userId);
  if (!user) return res.status(404).json({ error: '유저 없음' });
  res.json({ userId: user.id, balance: blockchain.getBalance(user.id) });
});

// 거래 내역
app.get('/api/coins/history/:userId', (req, res) => {
  const user = findUser(req.params.userId);
  if (!user) return res.status(404).json({ error: '유저 없음' });
  res.json({ history: blockchain.getTxHistory(user.id) });
});

// QR 결제 토큰 생성 (구민 → 가맹점 결제)
app.post('/api/coins/generate-qr', (req, res) => {
  const { userId, amount } = req.body;
  const user = findUser(userId);
  if (!user) return res.status(404).json({ error: '유저 없음' });

  const balance = blockchain.getBalance(userId);
  if (balance < amount) return res.status(402).json({ error: '잔액 부족', balance });

  const token = createQRToken(userId, amount);
  res.json({ token, expiresIn: 300 }); // 5분 유효
});

// QR 결제 처리 (가맹점 → 서버)
app.post('/api/coins/pay-qr', (req, res) => {
  const { token, merchantId } = req.body;
  const qr = QR_TOKENS.get(token);
  if (!qr || Date.now() > qr.expiresAt) {
    QR_TOKENS.delete(token);
    return res.status(410).json({ error: 'QR 코드가 만료되었습니다.' });
  }

  const merchant = findMerchant(merchantId);
  if (!merchant) return res.status(404).json({ error: '가맹점 없음' });

  const balance = blockchain.getBalance(qr.userId);
  if (balance < qr.amount) return res.status(402).json({ error: '잔액 부족' });

  const block = blockchain.addBlock({
    type:       'SPEND',
    userId:     qr.userId,
    merchantId,
    merchantName: merchant.name,
    amount:     qr.amount,
  });

  QR_TOKENS.delete(token);

  broadcast({
    event: 'COIN_SPENT',
    merchantName: merchant.name,
    amount: qr.amount,
    blockHash: block.hash.slice(0, 12) + '...',
    timestamp: Date.now(),
  });

  res.json({
    success: true,
    message: `${qr.amount} 성동 코인이 사용되었습니다.`,
    newBalance: blockchain.getBalance(qr.userId),
    block: { hash: block.hash, index: block.index },
  });
});

// ════════════════════════════════════════════════════════════════
//  관리자(ADMIN) 라우트
// ════════════════════════════════════════════════════════════════

// 미들웨어: 관리자 확인
function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== 'SDP_ADMIN_2026') return res.status(403).json({ error: '관리자 권한 필요' });
  next();
}

// 대시보드 통계
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const stats = blockchain.getStats();
  const activeSpots = TREASURES.filter(t => t.isActive).length;
  const totalClaims = TREASURES.reduce((s, t) => s + t.claimedBy.length, 0);
  res.json({ ...stats, activeSpots, totalClaims, totalUsers: USERS.length - 1 });
});

// 전체 유저 목록
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = USERS
    .filter(u => !u.isAdmin)
    .map(u => ({
      ...sanitizeUser(u),
      balance: blockchain.getBalance(u.id),
      txCount: blockchain.getTxHistory(u.id).length,
    }));
  res.json({ users });
});

// 전체 거래(블록) 목록
app.get('/api/admin/transactions', requireAdmin, (req, res) => {
  const txs = blockchain.chain.slice(1).reverse().map(b => ({
    hash:      b.hash.slice(0, 16) + '...',
    fullHash:  b.hash,
    index:     b.index,
    timestamp: b.timestamp,
    ...b.data,
  }));
  res.json({ transactions: txs, total: txs.length });
});

// 보물 장소 전체 (관리자)
app.get('/api/admin/treasures', requireAdmin, (req, res) => {
  res.json({ treasures: TREASURES });
});

// 보물 추가
app.post('/api/admin/treasures', requireAdmin, (req, res) => {
  const { name, description, lat, lng, coinReward, icon, radius, dailyLimit } = req.body;
  const t = {
    id: `T${String(TREASURES.length + 1).padStart(3,'0')}`,
    name, description, lat, lng,
    coinReward: coinReward || 1,
    icon: icon || '💰',
    radius: radius || 50,
    dailyLimit: dailyLimit || 100,
    isActive: true,
    claimedBy: [],
  };
  TREASURES.push(t);
  res.json({ success: true, treasure: t });
});

// 보물 수정
app.put('/api/admin/treasures/:id', requireAdmin, (req, res) => {
  const t = findTreasure(req.params.id);
  if (!t) return res.status(404).json({ error: '없음' });
  Object.assign(t, req.body);
  res.json({ success: true, treasure: t });
});

// 보물 활성/비활성 토글
app.patch('/api/admin/treasures/:id/toggle', requireAdmin, (req, res) => {
  const t = findTreasure(req.params.id);
  if (!t) return res.status(404).json({ error: '없음' });
  t.isActive = !t.isActive;
  res.json({ success: true, isActive: t.isActive });
});

// 블록체인 전체 조회
app.get('/api/admin/blockchain', requireAdmin, (req, res) => {
  res.json({
    chain: blockchain.chain,
    isValid: blockchain.isValid(),
    stats: blockchain.getStats(),
  });
});

// 가맹점 목록
app.get('/api/merchants', (req, res) => {
  res.json({ merchants: MERCHANTS });
});

// ── 헬퍼 ───────────────────────────────────────────────────────
function sanitizeUser(u) {
  return { id: u.id, name: u.name, phone: u.phone, kakaoId: u.kakaoId, isAdmin: u.isAdmin, createdAt: u.createdAt };
}

// ── 서버 시작 ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║  🌟 성동 패스(SDP) 백엔드 서버 실행 중   ║
  ║  HTTP : http://localhost:${PORT}           ║
  ║  WS   : ws://localhost:${PORT}             ║
  ╚══════════════════════════════════════════╝
  `);
});
