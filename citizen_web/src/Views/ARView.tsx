import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ArrowLeft, CheckCircle, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 효과음 URL
const APPEAR_SFX = 'https://assets.mixkit.co/sfx/preview/mixkit-magical-appearance-611.mp3';
const SUCCESS_SFX = 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3';

export const ARView = ({ onBack }: { onBack: () => void }) => {
  const { user, refresh } = useAuth();
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [treasures, setTreasures] = useState<any[]>([]);
  const [nearTreasure, setNearTreasure] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  // 오디오 객체 관리
  const appearAudio = useRef(new Audio(APPEAR_SFX));
  const successAudio = useRef(new Audio(SUCCESS_SFX));

  useEffect(() => {
    // 1. 보물 목록 로드
    api.getTreasures().then(res => setTreasures(res.treasures || []));

    // 2. 위치 추적
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPos(current);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!myPos || treasures.length === 0) return;

    // 가장 가까운 보물 찾기
    let closest = null;
    let minDist = Infinity;

    treasures.forEach(t => {
      const d = haversine(myPos.lat, myPos.lng, t.lat, t.lng);
      if (d < minDist) {
        minDist = d;
        closest = t;
      }
    });

    setDistance(minDist);
    
    // 15m 이내일 때만 상자 표시
    if (minDist <= 15) {
      if (!nearTreasure) appearAudio.current.play().catch(() => {});
      setNearTreasure(closest);
    } else {
      setNearTreasure(null);
    }
  }, [myPos, treasures]);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleClaim = async () => {
    if (!user || !nearTreasure || claiming) return;
    
    // 1. 흔들림 효과 시작
    setIsShaking(true);
    setClaiming(true);
    
    // 연출을 위해 약간의 딜레이
    await new Promise(r => setTimeout(r, 800));

    try {
      await api.claimCoin({
        userId: user.id,
        treasureId: nearTreasure.id,
        lat: myPos?.lat,
        lng: myPos?.lng,
        deviceId: 'web_client'
      });
      
      // 2. 성공 연출
      successAudio.current.play().catch(() => {});
      setSuccess(true);
      
      // 3. 잔액 갱신 (핵심!)
      await refresh();
      
      setTimeout(() => onBack(), 2500);
    } catch (err: any) {
      alert(err.message);
      setIsShaking(false);
      setClaiming(false);
    }
  };

  return (
    <div style={{ height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* 카메라 배경 시뮬레이션 (실제로는 비디오 스트림 가능) */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #1a1c2c, #4a192c)', opacity: 0.8 }}>
        <video id="ar-video" autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 10, padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onBack} className="btn-ghost" style={{ width: 'fit-content' }}>
          <ArrowLeft size={24} />
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence>
            {!success && nearTreasure && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: isShaking ? [0, -10, 10, -10, 10, 0] : 0 
                }}
                transition={{ 
                  scale: { type: 'spring', damping: 12 },
                  x: { duration: 0.4, repeat: isShaking ? Infinity : 0 }
                }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={handleClaim}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '120px', filter: 'drop-shadow(0 0 20px rgba(255,217,61,0.5))' }}>
                  🎁
                </div>
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{ 
                    background: 'rgba(0,0,0,0.6)', 
                    padding: '8px 20px', 
                    borderRadius: '20px',
                    border: '1px solid var(--primary)',
                    marginTop: '20px'
                  }}
                >
                  <p style={{ fontWeight: 800, color: 'var(--primary)' }}>보물상자를 터치하세요!</p>
                </motion.div>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ scale: 0, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                style={{ textAlign: 'center' }}
              >
                <CheckCircle size={100} color="#7fe9de" style={{ marginBottom: '20px' }} />
                <h2 style={{ fontSize: '32px', fontWeight: 800 }}>획득 성공!</h2>
                <p style={{ color: 'var(--text-dim)', marginTop: '10px' }}>{nearTreasure.coinReward} SDP가 지갑으로 전송되었습니다.</p>
              </motion.div>
            )}

            {!nearTreasure && !success && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '30px', borderRadius: '50%', marginBottom: '20px' }}>
                  <Smartphone size={48} color="var(--primary)" />
                </div>
                <p style={{ fontSize: '18px', fontWeight: 600 }}>주변을 탐색 중입니다...</p>
                {distance && (
                  <p style={{ color: 'var(--text-dim)', marginTop: '10px' }}>
                    가장 가까운 보물까지 약 {Math.round(distance)}m
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* 하단 거리 인디케이터 */}
      {!success && (
        <div style={{ 
          position: 'absolute', bottom: '40px', left: '20px', right: '20px', 
          background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '20px',
          backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
            <span>탐색 범위</span>
            <span>{distance ? `${Math.round(distance)}m` : '--'}</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <motion.div 
              animate={{ width: distance ? `${Math.max(0, 100 - (distance/100) * 100)}%` : '0%' }}
              style={{ height: '100%', background: 'var(--primary)' }} 
            />
          </div>
        </div>
      )}
    </div>
  );
};
