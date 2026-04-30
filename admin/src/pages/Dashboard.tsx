import React, { useEffect, useState } from 'react';
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

  const handleClearHistory = async () => {
    if (!confirm('⚠️ 모든 트랜잭션 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 대시보드 통계도 초기화됩니다.')) return;
    try {
      await clearTransactions();
      alert('✅ 모든 기록이 삭제되었습니다.');
      load();
    } catch (e: any) {
      alert(`❌ 삭제 실패: ${e.message}`);
    }
  };

  const load = async () => {
    try {
      const [s, t, tr] = await Promise.all([
        getStats(), 
        getTransactions(30),
        getTreasures()
      ]);
      setStats(s);
      setTxs(t.transactions || []);
      setTreasures(tr.treasures || []);
    } catch {
      // 서버 미연결 시 목업 데이터
      setStats({ total_issued: 1240, total_spent: 380, in_circulation: 860,
        today_claims: 47, active_spots: 6, total_txs: 143, is_paused: false, demo_mode: true });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

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
    if (!stats) return;
    const action = stats.is_paused ? 'unpause' : 'pause';
    if (!confirm(`컨트랙트를 ${action === 'pause' ? '정지' : '재개'}하시겠습니까?`)) return;
    setPauseLoading(true);
    try { await pauseContract(action); load(); }
    catch (e: any) { alert(e.message); }
    finally { setPauseLoading(false); }
  };

  if (loading) return <div style={styles.loading}><div style={styles.spinner} />데이터 로딩 중…</div>;

  const statCards = [
    { label: '총 발행 코인',     value: stats?.total_issued.toLocaleString(),   unit: 'SDP', color: '#6366F1', icon: '🪙' },
    { label: '오늘 획득된 코인', value: stats?.today_claims.toLocaleString(),   unit: '건', color: '#10B981', icon: '📍' },
    { label: '유통 중 코인',     value: stats?.in_circulation.toLocaleString(), unit: 'SDP', color: '#F59E0B', icon: '💫' },
    { label: '총 사용된 코인',   value: stats?.total_spent.toLocaleString(),    unit: 'SDP', color: '#EF4444', icon: '🛍️' },
    { label: '활성 스팟',        value: stats?.active_spots,                    unit: '개', color: '#3B82F6', icon: '🗺️' },
    { label: '총 트랜잭션',      value: stats?.total_txs.toLocaleString(),      unit: '건', color: '#8B5CF6', icon: '🔗' },
  ];

  return (
    <div style={styles.container}>
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
              <div style={{ ...styles.statBarFill, background: c.color, width: '60%' }} />
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
          onClick={handlePause} disabled={pauseLoading}
        >
          {pauseLoading ? '처리 중…' : stats?.is_paused ? '▶️ 컨트랙트 재개' : '⏸ 긴급 정지'}
        </button>
      </div>

      {/* ── 보물 스팟 목록 (위치값 포함) ── */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>🔗 최근 블록체인 트랜잭션</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn btn-ghost" 
              style={{ fontSize: 12, border: '1px solid var(--border)' }}
              onClick={() => window.open(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/api/admin/export/transactions`, '_blank')}
            >
              📊 엑셀 내보내기 (CSV)
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowTable(!showTable)}>
              {showTable ? '👁️ 목록 숨기기' : '👁️ 목록 표시'}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12, color: '#FCA5A5' }} onClick={handleClearHistory}>
              🗑️ 기록 삭제
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={load}>새로고침</button>
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
  statBar:    { height: 3, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  statBarFill:{ height: '100%', borderRadius: 2, transition: 'width 1s ease' },
  actionRow:  { display: 'flex', gap: 12, flexWrap: 'wrap' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  tableHead:  { borderBottom: '1px solid var(--border)' },
  tableRow:   { borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.1s' },
  th:         { padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' },
  td:         { padding: '10px 12px', color: 'var(--text-secondary)' },
  spotCard: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1px solid var(--border)'
  }
};
