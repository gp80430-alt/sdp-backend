import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { LogIn, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export const LoginView = () => {
  const [name, setName] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await login(name);
    } catch (err) {
      alert('로그인 실패: ' + (err as any).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass" 
        style={{ padding: '40px 30px', textAlign: 'center' }}
      >
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          style={{ fontSize: '80px', marginBottom: '20px', display: 'inline-block' }}
        >
          🪙
        </motion.div>
        
        <h1 style={{ fontSize: '32px', marginBottom: '10px', background: 'var(--grad-main)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          SDP CITIZEN
        </h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '30px' }}>
          성동구의 보물을 찾아 떠나는 모험 <br/> 지금 바로 시작하세요!
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '18px 20px',
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: '16px',
                outline: 'none'
              }}
            />
          </div>
          <button type="submit" className="btn-primary pulse-primary" disabled={isSubmitting}>
            {isSubmitting ? '입장 중...' : <><LogIn size={20} /> 모험 시작하기</>}
          </button>
        </form>

        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '20px', opacity: 0.5 }}>
          <Sparkles size={16} />
          <span style={{ fontSize: '12px' }}>성동구 스마트 시티 서비스</span>
        </div>
      </motion.div>
    </div>
  );
};
