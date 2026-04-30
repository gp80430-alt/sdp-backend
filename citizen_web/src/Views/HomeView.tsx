import { useAuth } from '../AuthContext';
import { Compass, Gift, LogOut, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const MERCHANTS = [
  { icon: '🌭', name: '응봉산 푸드트럭', desc: '1코인 = 핫도그 1개' },
  { icon: '🏊', name: '성동 수영장', desc: '5코인 = 1일 이용권' },
  { icon: '🧋', name: '서울숲 카페', desc: '1코인 = 아아 1잔' },
];

export const HomeView = ({ onNavigate }: { onNavigate: (view: string) => void }) => {
  const { user, logout } = useAuth();

  return (
    <div className="container" style={{ paddingBottom: '100px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', marginTop: '10px' }}>
        <div>
          <p style={{ color: 'var(--secondary)', fontSize: '13px', fontWeight: 800 }}>{user?.title || '성동 입문자'} ✨</p>
          <h2 style={{ fontSize: '24px' }}>{user?.name} 님</h2>
        </div>
        <button 
          onClick={logout} 
          className="btn-ghost"
          style={{ padding: '8px 12px', color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}
        >
          <LogOut size={18} />
          <span>로그아웃</span>
        </button>
      </div>

      {/* 코인 카드 */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        className="glass pulse-primary" 
        style={{ 
          background: 'var(--grad-main)', 
          padding: '30px', 
          borderRadius: '30px',
          marginBottom: '30px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', fontSize: '120px', opacity: 0.2 }}>🪙</div>
        <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '5px' }}>현재 보유 코인</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '48px', fontWeight: 800 }}>{user?.balance || 0}</span>
          <span style={{ fontSize: '18px', fontWeight: 600, opacity: 0.9 }}>SDP</span>
        </div>
      </motion.div>

      {/* 액션 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '40px' }}>
        <button 
          onClick={() => onNavigate('AR')}
          className="glass" 
          style={{ padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', border: 'none' }}
        >
          <div style={{ background: '#7fe9de20', padding: '15px', borderRadius: '20px', color: '#7fe9de' }}>
            <Compass size={28} />
          </div>
          <span style={{ fontWeight: 600, color: 'white' }}>보물찾기</span>
        </button>

        <button 
          onClick={() => onNavigate('SPEND')}
          className="glass" 
          style={{ padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', border: 'none' }}
        >
          <div style={{ background: '#ffd93d20', padding: '15px', borderRadius: '20px', color: '#ffd93d' }}>
            <Gift size={28} />
          </div>
          <span style={{ fontWeight: 600, color: 'white' }}>코인사용</span>
        </button>
      </div>

      {/* 추천 가맹점 */}
      <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>어디서 쓸까요? 🤔</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {MERCHANTS.map(m => (
          <div key={m.name} className="glass" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '24px', background: 'rgba(255,255,255,0.05)', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '15px' }}>
              {m.icon}
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '16px', marginBottom: '2px' }}>{m.name}</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{m.desc}</p>
            </div>
            <ChevronRight size={18} color="var(--text-dim)" />
          </div>
        ))}
        {/* 버전 표시 */}
        <div style={{ textAlign: 'center', marginTop: '30px', opacity: 0.3, fontSize: '12px' }}>
          SDP v2.1.0 (PROXIMITY_FIX_APPLIED)
        </div>
      </div>
    </div>
  );
};
