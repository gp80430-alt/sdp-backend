import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ArrowLeft, Navigation, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 하버사인 거리 계산
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

export const ARView = ({ onBack }: { onBack: () => void }) => {
  const { user, refresh } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [treasures, setTreasures] = useState<any[]>([]);
  const [myPos, setMyPos] = useState<{ lat: number, lng: number } | null>(null);
  const [nearTreasure, setNearTreasure] = useState<any | null>(null);
  const [claiming, setClaiming] = useState(false);

  // 카메라 시작
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        });
    }
    
    // 위치 추적
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    // 보물 로드
    api.getTreasures().then(res => setTreasures(res.treasures || []));

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 근처 보물 체크
  useEffect(() => {
    if (!myPos || treasures.length === 0) return;
    
    let closest = null;
    let minD = Infinity;

    treasures.forEach(t => {
      const d = getDistance(myPos.lat, myPos.lng, t.lat, t.lng);
      if (d < minD) { minD = d; closest = { ...t, dist: d }; }
    });

    if (closest && closest.dist < 100) { // 100m 이내 감지
      setNearTreasure(closest);
    } else {
      setNearTreasure(null);
    }
  }, [myPos, treasures]);

  const handleClaim = async () => {
    if (!nearTreasure || !user || claiming) return;
    setClaiming(true);
    try {
      await api.claimCoin({
        userId: user.id,
        treasureId: nearTreasure.id,
        lat: myPos?.lat,
        lng: myPos?.lng,
        deviceId: 'web_client'
      });
      alert('🎁 코인을 획득했습니다!');
      await refresh();
      setNearTreasure(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000' }}>
      {/* 카메라 배경 */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
      />

      {/* 오버레이 UI */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <SafeArea top style={{ padding: '20px' }}>
          <button 
            onClick={onBack}
            className="glass"
            style={{ pointerEvents: 'auto', padding: '10px 20px', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={20} /> 탐험 종료
          </button>
        </SafeArea>

        {/* 하단 정보창 */}
        <div style={{ position: 'absolute', bottom: '30px', left: '20px', right: '20px', pointerEvents: 'auto' }}>
          <AnimatePresence>
            {nearTreasure ? (
              <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="glass" 
                style={{ padding: '25px', textAlign: 'center', border: '2px solid var(--accent)' }}
              >
                <div style={{ fontSize: '50px', marginBottom: '10px' }}>🪙</div>
                <h3 style={{ fontSize: '20px', marginBottom: '5px' }}>{nearTreasure.name} 발견!</h3>
                <p style={{ color: 'var(--accent)', fontWeight: 800, marginBottom: '20px' }}>약 {Math.round(nearTreasure.dist)}m 거리에 보물이 있습니다</p>
                <button onClick={handleClaim} className="btn-primary pulse-primary" disabled={claiming}>
                  {claiming ? '획득 중...' : '코인 획득하기'}
                </button>
              </motion.div>
            ) : (
              <div className="glass" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div className="animate-float" style={{ color: 'var(--primary)' }}>
                  <Target size={32} />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px' }}>주변을 탐색 중입니다</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>보물 근처 100m 이내로 이동해 주세요</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const SafeArea = ({ children, top, style }: any) => (
  <div style={{ paddingTop: top ? 'env(safe-area-inset-top)' : 0, ...style }}>
    {children}
  </div>
);
