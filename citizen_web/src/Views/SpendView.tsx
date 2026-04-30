import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ArrowLeft, History as HistoryIcon, QrCode, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SpendView = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      api.getHistory(user.id).then(res => setHistory(res.history || []));
    }
  }, [user]);

  const handleGenerateQr = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.generateQr(user.id, 1); // 기본 1코인 결제용 QR
      setQrToken(res.token);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '40px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', marginTop: '10px' }}>
        <button onClick={onBack} className="btn-ghost" style={{ padding: '8px' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ fontSize: '20px' }}>코인 사용하기</h2>
      </div>

      {/* 결제 카드 */}
      <div className="glass" style={{ padding: '30px', textAlign: 'center', marginBottom: '30px' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '10px' }}>보유 잔액: {user?.balance} SDP</p>
        
        <AnimatePresence mode="wait">
          {!qrToken ? (
            <motion.div
              key="generate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div style={{ fontSize: '60px', marginBottom: '20px', opacity: 0.5 }}>💳</div>
              <button 
                onClick={handleGenerateQr} 
                className="btn-primary pulse-primary" 
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? '생성 중...' : '결제 QR 만들기'}
              </button>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '15px' }}>
                가맹점에 보여줄 1회용 결제 코드를 생성합니다.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="qr"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ background: 'white', padding: '20px', borderRadius: '20px', display: 'inline-block', marginBottom: '20px' }}
            >
              {/* 실제 QR 라이브러리 대신 시각적 구현 */}
              <div style={{ width: '200px', height: '200px', position: 'relative' }}>
                <QrCode size={200} color="#000" />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: 'white', padding: '5px', borderRadius: '5px' }}>
                    🪙
                  </div>
                </div>
              </div>
              <div style={{ color: '#000', fontWeight: 800, marginTop: '10px', fontSize: '18px', letterSpacing: '2px' }}>
                {qrToken.substring(0, 8).toUpperCase()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {qrToken && (
          <button onClick={() => setQrToken(null)} className="btn-ghost" style={{ marginTop: '10px' }}>
            취소하기
          </button>
        )}
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
                  color: item.type === 'EARN' ? '#7fe9de' : '#ff6b6b'
                }}>
                  <Receipt size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.reason}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{new Date(item.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ fontWeight: 800, color: item.type === 'EARN' ? '#7fe9de' : '#ff6b6b' }}>
                {item.type === 'EARN' ? '+' : '-'}{item.amount}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
