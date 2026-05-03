import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ArrowLeft, History as HistoryIcon, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AMOUNT_OPTIONS = [1, 3, 5, 10];

// QR 이미지 URL — 무료 공개 API (외부 서버에 토큰 값 노출 최소화: 짧은 코드만 사용)
function qrImageUrl(token: string) {
  const code = token.substring(0, 8).toUpperCase();
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=000000&bgcolor=ffffff&data=${encodeURIComponent(code)}&qzone=1&format=png`;
}

export const SpendView = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(1);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [expireAt, setExpireAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(300);

  useEffect(() => {
    if (user) {
      api.getHistory(user.id).then(res => setHistory(res.history || []));
    }
  }, [user]);

  // QR 만료 카운트다운
  useEffect(() => {
    if (!expireAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((expireAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) { setQrToken(null); setExpireAt(null); }
    }, 1000);
    return () => clearInterval(id);
  }, [expireAt]);

  const handleGenerateQr = async () => {
    if (!user) return;
    if (user.balance < amount) {
      alert('잔액이 부족합니다.');
      return;
    }
    setLoading(true);
    setQrLoaded(false);
    try {
      const res = await api.generateQr(user.id, amount);
      setQrToken(res.token);
      setExpireAt(Date.now() + 5 * 60 * 1000); // 5분
      setRemaining(300);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setQrToken(null);
    setExpireAt(null);
    setQrLoaded(false);
  };

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="container" style={{ paddingBottom: '40px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', marginTop: '10px' }}>
        <button onClick={onBack} className="btn-ghost" style={{ padding: '8px 12px' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: '20px' }}>코인 사용하기</h2>
      </div>

      {/* 결제 카드 */}
      <div className="glass" style={{ padding: '30px', textAlign: 'center', marginBottom: '30px' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '16px' }}>
          보유 잔액: <strong style={{ color: 'var(--text-main)', fontSize: '16px' }}>{user?.balance ?? 0} SDP</strong>
        </p>

        <AnimatePresence mode="wait">
          {!qrToken ? (
            <motion.div key="generate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* 금액 선택 */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '10px' }}>사용할 금액을 선택하세요</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {AMOUNT_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAmount(opt)}
                      style={{
                        padding: '10px',
                        borderRadius: '12px',
                        border: `2px solid ${amount === opt ? 'var(--primary)' : 'var(--glass-border)'}`,
                        background: amount === opt ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                        color: amount === opt ? 'white' : 'var(--text-dim)',
                        fontWeight: amount === opt ? 700 : 400,
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'all 0.2s',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {/* 직접 입력 */}
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-dim)', flexShrink: 0 }}>직접 입력:</span>
                  <input
                    type="number" min={1} max={user?.balance ?? 9999}
                    value={amount}
                    onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: '10px',
                      border: '1px solid var(--glass-border)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'white', fontSize: '14px', outline: 'none',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-dim)', flexShrink: 0 }}>SDP</span>
                </div>
              </div>

              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>💳</div>
              <button
                onClick={handleGenerateQr}
                className="btn-primary pulse-primary"
                disabled={loading || amount < 1 || (user?.balance ?? 0) < amount}
                style={{ width: '100%' }}
              >
                {loading ? '생성 중...' : `결제 QR 만들기 (${amount} SDP)`}
              </button>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
                가맹점에 보여줄 1회용 결제 코드 (5분 유효)
              </p>
            </motion.div>
          ) : (
            <motion.div key="qr" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              {/* 실제 QR 이미지 */}
              <div style={{
                background: 'white', padding: '16px', borderRadius: '20px',
                display: 'inline-block', marginBottom: '16px', position: 'relative'
              }}>
                {!qrLoaded && (
                  <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 8 }}>
                    <span style={{ fontSize: 32 }}>⌛</span>
                  </div>
                )}
                <img
                  src={qrImageUrl(qrToken)}
                  alt="QR Code"
                  width={200} height={200}
                  onLoad={() => setQrLoaded(true)}
                  style={{ display: qrLoaded ? 'block' : 'none', borderRadius: 8 }}
                />
              </div>

              {/* 코드 + 만료 타이머 */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '3px', color: 'white' }}>
                  {qrToken.substring(0, 8).toUpperCase()}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '6px' }}>
                  {amount} SDP 결제 코드
                </div>
              </div>

              {/* 만료 카운트다운 */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: remaining < 60 ? 'rgba(255,107,107,0.15)' : 'rgba(16,185,129,0.15)',
                color: remaining < 60 ? '#ff6b6b' : '#7fe9de',
                padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700,
                marginTop: '8px', marginBottom: '16px',
              }}>
                ⏱ {fmtTime(remaining)} 후 만료
              </div>

              <br />
              <button onClick={handleCancel} className="btn-ghost" style={{ marginTop: '4px' }}>
                취소하기
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 이용 내역 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
        <HistoryIcon size={18} color="var(--primary)" />
        <h3 style={{ fontSize: '18px' }}>최근 이용 내역</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {history.length === 0 ? (
          <div className="glass" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
            내역이 없습니다.
          </div>
        ) : (
          history.map((item, idx) => (
            <div key={idx} className="glass" style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: item.type === 'EARN' ? 'rgba(127,233,222,0.1)' : 'rgba(255,107,107,0.1)',
                  padding: '10px', borderRadius: '12px',
                  color: item.type === 'EARN' ? '#7fe9de' : '#ff6b6b',
                }}>
                  <Receipt size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.reason}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    {new Date(item.created_at).toLocaleDateString('ko')}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 800, color: item.type === 'EARN' ? '#7fe9de' : '#ff6b6b', fontSize: '16px' }}>
                {item.type === 'EARN' ? '+' : '-'}{item.amount}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
