import React, { useEffect, useState, useCallback } from 'react';
import { getStats, getTransactions, getTreasures, adminMint, pauseContract, clearTransactions } from '../services/api';

interface Stats {
  total_issued:   number;
  total_spent:    number;
  in_circulation: number;
  today_claims:   number;
  active_spots:   number;
  total_txs:      number;
  is_paused:      boolean;
  demo_mode:      boolean;
}

interface Treasure {
  id: string; name: string; lat: number; lng: number;
  coinReward: number; icon: string; radius: number;
}

interface Tx {
  id: number; type: string; user_id: string;
  wallet: string; amount: number; reason: string;
  tx_hash: string; created_at: string;
}

// ── 경량 토스트 훅 ────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' | 'info' } | null>(null);
  const show = useCallback((msg: string, kind: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, show };
}

// ── 확인 모달 ─────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>취소</button>
          <button className="btn btn-danger" onClick={onConfirm}>확인</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]           = useState<Stats | null>(null);
  const [txs,   setTxs]             = useState<Tx[]>([]);
  const [treasures, setTreasures]   = useState<Treasure[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showMint, setShowMint]     = useState(false);
  const [mintWallet, setMintWallet] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [mintReason, setMintReason] = useState('관리자 수동 발행');
  const [mintLoading, setMintLoading] = useState(false);
  const [mintResult,  setMintResult]  = useState('');
  const [pauseLoading, setPauseLoading] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const { toast, show: showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const [s, t, tr] = await Promise.all([
        getStats(),
        getTransactions(50),
        getTreasures()
      ]);
      setStats(s);
      setTxs(t.transactions || []);
      setTreasures(tr.treasures || []);
    } catch {
      setStats({ total_issued: 1240, total_spent: 380, in_circulation: 860,
        today_claims: 47, active_spots: 6, total_txs: 143, is_paused: false, demo_mode: true });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  const handleClearHistory = async () => {
    setConfirmClear(false);
    try {
      await clearTransactions();
      showToast('✅ 모든 기록이 삭제되었습니다.', 'success');
      load();
    } catch (e: any) {
      showToast(`❌ 삭제 실패: ${e.message}`, 'error');
    }
  };

  const handleMint = async () => {
    if (!mintWallet || !mintAmount) { setMintResult('❌ 지갑 주소와 수량을 입력하세요.'); return; }
    setMintLoading(true); setMintResult('');
    try {
      const res = await adminMint(mintWallet, Number(mintAmount), mintReason);
      setMintResult(`✅ ${mintAmount} SDP 발행 완료! TX: ${res.tx_hash?.slice(0,16)}…`);
      load();
    } catch (e: any) { setMintResult(`❌ ${e.message}`); }
    finally { setMintLoading(false); }
  };

  const handlePause = async () => {
    setConfirmPause(false);
    if (!stats) return;
    const action = stats.is_paused ? 'unpause' : 'pause';
    setPauseLoading(true);
    try {
      await pauseContract(action);
      showToast(action === 'pause' ? '⏸ 컨트랙트가 정지되었습니다.' : '▶️ 컨트랙트가 재개되었습니다.', 'info');
      load();
    } catch (e: any) {
      showToast(`❌ ${e.message}`, 'error');
    } finally { setPauseLoading(false); }
  };

  if (loading) return <div style={styles.loading}><div style={styles.spinner} />데이터 로딩 중…</div>;

  // 실제 비율 계산 (스탯바 너비)
  const maxIssued = stats?.total_issued || 1;
  const statCards = [
    { label: '총 발행 코인',     value: stats?.total_issued.toLocaleString(),   unit: 'SDP', color: '#6366F1', icon: '🪙',
      pct: 100 },
    { label: '오늘 획득된 코인', value: stats?.today_claims.toLocaleString(),   unit: '건', color: '#10B981', icon: '📍',
      pct: Math.min(100, ((stats?.today_claims || 0) / Math.max(stats?.total_txs || 1, 1)) * 100 * 5) },
    { label: '유통 중 코인',     value: stats?.in_circulation.toLocaleString(), unit: 'SDP', color: '#F59E0B', icon: '💫',
      pct: Math.min(100, ((stats?.in_circulation || 0) / maxIssued) * 100) },
    { label: '총 사용된 코인',   value: stats?.total_spent.toLocaleString(),    unit: 'SDP', color: '#EF4444', icon: '🛍️',
      pct: Math.min(100, ((stats?.total_spent || 0) / maxIssued) * 100) },
    { label: '활성 스팟',        value: stats?.active_spots,                    unit: '개', color: '#3B82F6', icon: '🗺️',
      pct: Math.min(100, ((stats?.active_spots || 0) / 10) * 100) },
    { label: '총 트랜잭션',      value: stats?.total_txs.toLocaleString(),      unit: '건', color: '#8B5CF6', icon: '🔗',
      pct: Math.min(100, ((stats?.total_txs || 0) / Math.max(stats?.total_txs || 1, 200)) * 100) },
  ];

  return (
    <div style={styles.container}>
      {/* ── 토스트 알림 ── */}
      {toast && (
        <div style={{
          ...styles.toast,
          borderColor: toast.kind === 'success' ? 'rgba(16,185,129,0.4)'
                      : toast.kind === 'error'   ? 'rgba(239,68,68,0.4)'
                      : 'rgba(99,102,241,0.4)',
          color: toast.kind === 'success' ? 'var(--green)'
               : toast.kind === 'error'   ? 'var(--red)'
               : 'var(--text-primary)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── 확인 모달: 기록 삭제 ── */}
      {confirmClear && (
        <ConfirmModal
          message={'⚠️ 모든 트랜잭션 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 통계도 초기화됩니다.'}
          onConfirm={handleClearHistory}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {/* ── 확인 모달: 정지/재개 ── */}
      {confirmPause && (
        <ConfirmModal
          message={stats?.is_paused
            ? '▶️ 컨트랙트를 재개하시겠습니까?'
            : '⏸ 컨트랙트를 긴급 정지하시겠습니까?\n코인 이동 및 획득이 불가해집니다.'}
          onConfirm={handlePause}
          onCancel={() => setConfirmPause(false)}
        />
      )}

      {/* ── 상태 배너 ── */}
      {stats?.demo_mode && (
        <div style={styles.demoBanner}>
          ⚠️ <strong>데모 모드</strong> — 블록체인 연결 없음. <code>server_py/.env</code>에 환경변수를 설정하면 실제 체인에 연결됩니다.
        </div>
      )}
      {stats?.is_paused && (
        <div style={{ ...styles.demoBanner, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#FCA5A5' }}>
          🚨 <strong>컨트랙트 일시정지 중</strong> — 코인 이동 및 획득이 불가합니다.
        </div>
      )}

      {/* ── 통계 카드 ── */}
      <div style={styles.statsGrid}>
        {statCards.map(c => (
          <div key={c.label} className="card" style={styles.statCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>
                  {c.value}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{c.unit}</div>
              </div>
              <div style={{ ...styles.iconCircle, background: `${c.color}22` }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
              </div>
            </div>
            <div style={{ ...styles.statBar, background: `${c.color}33` }}>
              <div style={{ ...styles.statBarFill, background: c.color, width: `${c.pct.toFixed(1)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── 액션 버튼 영역 ── */}
      <div style={styles.actionRow}>
        <button className="btn btn-primary" style={{ fontSize: 15, padding: '12px 24px' }}
          onClick={() => setShowMint(true)}>
          ⛏️ 코인 추가 발행 (Mint)
        </button>
        <button
          className={`btn ${stats?.is_paused ? 'btn-green' : 'btn-danger'}`}
          style={{ fontSize: 15, padding: '12px 24px' }}
          onClick={() => setConfirmPause(true)} disabled={pauseLoading}
        >
          {pauseLoading ? '처리 중…' : stats?.is_paused ? '▶️ 컨트랙트 재개' : '⏸ 긴급 정지'}
        </button>
      </div>

      {/* ── 보물 스팟 목록 ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📍 보물 스팟 목록 및 위치값</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {treasures.map(t => (
            <div key={t.id} style={styles.spotCard}>
              <div style={{ fontSize: 24 }}>{t.icon || '💰'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                  위치: {t.lat.toFixed(6)}, {t.lng.toFixed(6)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                  보상: {t.coinReward} SDP | 반경: {t.radius}m
                </div>
              </div>
            </div>
          ))}
          {treasures.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 20 }}>활성화된 보물 스팟이 없습니다.</div>
          )}
        </div>
      </div>

      {/* ── 최근 트랜잭션 ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>🔗 최근 블록체인 트랜잭션</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, border: '1px solid var(--border)' }}
              onClick={() => window.open(`${import.meta.env.VITE_API_BASE || 'https://sdp-backend-y2aq.onrender.com'}/api/admin/export/transactions`, '_blank')}
            >
              📊 CSV 내보내기
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowTable(!showTable)}>
              {showTable ? '👁️ 숨기기' : '👁️ 표시'}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12, color: '#FCA5A5' }} onClick={() => setConfirmClear(true)}>
              🗑️ 기록 삭제
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={load}>↻ 새로고침</button>
          </div>
        </div>

        {showTable && (
          <>
            {txs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32, fontSize: 13 }}>
                트랜잭션이 없습니다. 서버를 실행하고 구민이 코인을 획득하면 여기에 표시됩니다.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHead}>
                      {['#', '유형', '사용자', '지갑', '금액', '사유', 'TX 해시', '시각'].map(h => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map(tx => (
                      <tr key={tx.id} style={styles.tableRow}>
                        <td style={styles.td}>{tx.id}</td>
                        <td style={styles.td}>
                          <span className={`badge ${tx.type === 'EARN' ? 'badge-green' : tx.type === 'MINT' ? 'badge-blue' : 'badge-yellow'}`}>
                            {tx.type === 'EARN' ? '획득' : tx.type === 'MINT' ? '발행' : '사용'}
                          </span>
                        </td>
                        <td style={styles.td}>{tx.user_id || '—'}</td>
                        <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11 }}>
                          {tx.wallet ? tx.wallet.slice(0, 8) + '…' : '—'}
                        </td>
                        <td style={{ ...styles.td, color: tx.type === 'EARN' || tx.type === 'MINT' ? 'var(--green)' : 'var(--yellow)', fontWeight: 700 }}>
                          {tx.type === 'SPEND' ? '-' : '+'}{tx.amount} SDP
                        </td>
                        <td style={{ ...styles.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.reason}
                        </td>
                        <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)' }}>
                          {tx.tx_hash ? tx.tx_hash.slice(0, 14) + '…' : '—'}
                        </td>
                        <td style={{ ...styles.td, color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {tx.created_at ? new Date(tx.created_at).toLocaleString('ko') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 코인 발행 모달 ── */}
      {showMint && (
        <div className="modal-overlay" onClick={() => setShowMint(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">⛏️ 코인 추가 발행 (Mint)</div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">수신 지갑 주소 (0x…)</label>
              <input className="form-input" placeholder="0xABCD…" value={mintWallet} onChange={e => setMintWallet(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">발행 수량 (SDP)</label>
              <input className="form-input" type="number" min={1} max={10000} placeholder="예: 100"
                value={mintAmount} onChange={e => setMintAmount(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="form-label">발행 사유</label>
              <input className="form-input" value={mintReason} onChange={e => setMintReason(e.target.value)} />
            </div>
            {mintResult && (
              <div style={{ marginBottom: 12, fontSize: 12, color: mintResult.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>
                {mintResult}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleMint} disabled={mintLoading}>
                {mintLoading ? '발행 중…' : '⛏️ 발행 실행'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowMint(false); setMintResult(''); }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container:  { display: 'flex', flexDirection: 'column', gap: 20 },
  loading:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, height: 200, color: 'var(--text-secondary)' },
  spinner:    { width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  demoBanner: { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#FCD34D' },
  statsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 },
  statCard:   { transition: 'transform 0.2s', cursor: 'default' },
  iconCircle: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statBar:    { height: 4, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  statBarFill:{ height: '100%', borderRadius: 2, transition: 'width 1s ease' },
  actionRow:  { display: 'flex', gap: 12, flexWrap: 'wrap' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  tableHead:  { borderBottom: '1px solid var(--border)' },
  tableRow:   { borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.1s' },
  th:         { padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' },
  td:         { padding: '10px 12px', color: 'var(--text-secondary)' },
  spotCard: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12, padding: 16,
    display: 'flex', alignItems: 'center', gap: 12,
    border: '1px solid var(--border)',
  },
  toast: {
    position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
    background: 'var(--bg-card)', border: '1px solid',
    borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 600,
    zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    animation: 'slideUp 0.2s ease', whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
};
