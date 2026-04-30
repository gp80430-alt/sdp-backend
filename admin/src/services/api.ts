// ── 관리자 API 서비스 ──────────────────────────────────────────
const BASE = 'https://sdp-backend-y2aq.onrender.com';
const KEY  = import.meta.env.VITE_ADMIN_KEY || 'SDP_ADMIN_2026';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-admin-key':  KEY,
});

async function req(path: string, opts: RequestInit = {}) {
  const res  = await fetch(`${BASE}${path}`, { headers: headers(), ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '서버 오류');
  return data;
}

export const getStats        = ()              => req('/api/admin/stats');
export const getTransactions = (limit = 50)    => req(`/api/admin/transactions?limit=${limit}`);
export const getTreasures    = ()              => req('/api/treasures');
export const adminMint       = (wallet: string, amount: number, reason: string) =>
  req('/api/admin/mint', { method: 'POST', body: JSON.stringify({ wallet_addr: wallet, amount, reason }) });
export const setEvent        = (payload: object) =>
  req('/api/admin/set-event', { method: 'POST', body: JSON.stringify(payload) });
export const pauseContract   = (action: 'pause' | 'unpause') =>
  req('/api/admin/pause', { method: 'POST', body: JSON.stringify({ action }) });
export const clearTransactions = () => req('/api/admin/clear-transactions', { method: 'POST' });
