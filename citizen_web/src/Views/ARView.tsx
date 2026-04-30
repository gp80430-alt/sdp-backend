import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ArrowLeft, CheckCircle, Smartphone, Radar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 효과음 URL
const APPEAR_SFX = 'https://assets.mixkit.co/sfx/preview/mixkit-magical-appearance-611.mp3';
const SHAKE_SFX = 'https://assets.mixkit.co/sfx/preview/mixkit-box-shaking-1534.mp3'; // 가상의 상자 소리
const SUCCESS_SFX = 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3';

export const ARView = ({ onBack }: { onBack: () => void }) => {
  const { user, refresh } = useAuth();
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [treasures, setTreasures] = useState<any[]>([]);
  const [nearTreasure, setNearTreasure] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [shakeCount, setShakeCount] = useState(0);

  const appearAudio = useRef(new Audio(APPEAR_SFX));
  const successAudio = useRef(new Audio(SUCCESS_SFX));
  const shakeAudio = useRef(new Audio(SHAKE_SFX));

  useEffect(() => {
    api.getTreasures().then(res => setTreasures(res.treasures || []));

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    // 카메라 권한 요청 및 비디오 시작
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        const video = document.getElementById('ar-video') as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          await video.play();
        }
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    };
    startCamera();

    return () => {
      navigator.geolocation.clearWatch(watchId);
      const video = document.getElementById('ar-video') as HTMLVideoElement;
      if (video && video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!myPos || treasures.length === 0) return;

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
    
    // 포켓몬 고 스타일: 3m 이내로 들어와야만 "발견" 가능 (더욱 엄격하게)
    if (minDist <= 3) {
      if (!nearTreasure) {
        appearAudio.current.play().catch(() => {});
        if (navigator.vibrate) navigator.vibrate(300);
      }
      setNearTreasure(closest);
    } else {
      setNearTreasure(null);
    }
  }, [myPos, treasures]);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const handleClaim = async () => {
    if (!user || !nearTreasure || claiming) return;
    setClaiming(true);
    
    // 포켓몬 고 포획 연출: 3번 흔들림
    for (let i = 1; i <= 3; i++) {
      setShakeCount(i);
      shakeAudio.current.play().catch(() => {});
      if (navigator.vibrate) navigator.vibrate(100);
      await new Promise(r => setTimeout(r, 700));
    }

    try {
      await api.claimCoin({
        userId: user.id,
        treasureId: nearTreasure.id,
        lat: myPos?.lat,
        lng: myPos?.lng,
        deviceId: 'web_client'
      });
      
      successAudio.current.play().catch(() => {});
      setSuccess(true);
      // 3. 잔액 및 내역 갱신 (반드시 두 번 확인하여 반영 보장)
      await refresh();
      setTimeout(async () => {
        await refresh();
        onBack();
      }, 1500);
    } catch (err: any) {
      alert(err.message);
      setClaiming(false);
      setShakeCount(0);
    }
  };

  return (
    <div style={{ height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* 실제 카메라 배경 */}
      <video id="ar-video" autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      
      {/* 어두운 오버레이 (UI 가독성) */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />

      <div style={{ position: 'relative', zIndex: 10, padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onBack} className="btn-ghost" style={{ width: 'fit-content', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '10px' }}>
          <ArrowLeft size={24} color="white" />
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence>
            {!success && nearTreasure && (
              <motion.div
                initial={{ scale: 0, y: 100 }}
                animate={{ 
                  scale: 1, 
                  y: 0,
                  rotate: shakeCount > 0 ? [0, -15, 15, -15, 15, 0] : 0 
                }}
                transition={{ 
                  y: { type: 'spring', damping: 10 },
                  rotate: { duration: 0.5, repeat: shakeCount > 0 ? 0 : 0 }
                }}
                key={`shake-${shakeCount}`}
                exit={{ scale: 0, opacity: 0 }}
                onClick={handleClaim}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                {/* 상자 먼지 효과 연출 */}
                {shakeCount === 0 && (
                  <motion.div 
                    initial={{ opacity: 1, scale: 0.5 }}
                    animate={{ opacity: 0, scale: 2 }}
                    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100px', height: '100px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%', filter: 'blur(20px)' }}
                  />
                )}
                
                <div style={{ fontSize: '140px', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }}>
                  {success ? '🎊' : (claiming ? '📦' : '🎁')}
                </div>
                
                {!claiming && (
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{ 
                      background: 'var(--primary)', 
                      color: 'black',
                      padding: '10px 25px', 
                      borderRadius: '30px',
                      fontWeight: 900,
                      marginTop: '30px',
                      boxShadow: '0 5px 15px rgba(255,217,61,0.4)'
                    }}
                  >
                    보물을 터치하세요!
                  </motion.div>
                )}
                {claiming && (
                  <p style={{ marginTop: '20px', fontWeight: 800, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                    {shakeCount < 3 ? '열어보는 중...' : '발견했다!'}
                  </p>
                )}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{ background: 'white', borderRadius: '50%', padding: '20px', display: 'inline-block', marginBottom: '20px' }}>
                  <CheckCircle size={80} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: '36px', fontWeight: 900, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>성공!</h2>
                <div style={{ background: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '15px', marginTop: '15px' }}>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>+{nearTreasure.coinReward} SDP 획득</p>
                </div>
              </motion.div>
            )}

            {!nearTreasure && !success && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ textAlign: 'center' }}
              >
                <div className="pulse-primary" style={{ background: 'rgba(255,217,61,0.1)', padding: '40px', borderRadius: '50%', marginBottom: '30px', border: '2px dashed var(--primary)' }}>
                  <Radar size={60} color="var(--primary)" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '10px' }}>
                  {distance && distance < 15 ? '오! 아주 가까워요! 🔥' : '주변을 탐색하세요 🔍'}
                </h3>
                <p style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)' }}>
                  {distance ? `${Math.round(distance)}m` : '---'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '10px', fontSize: '14px' }}>
                  보물상자가 나타날 때까지 이동하세요
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* 하단 거리 네비게이터 */}
      {!success && (
        <div style={{ 
          position: 'absolute', bottom: '40px', left: '20px', right: '20px', 
          background: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '25px',
          border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '50px', height: '50px', background: 'var(--grad-main)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Compass size={24} color="black" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>보물 탐지기</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary)' }}>
                  {distance ? `${Math.round(distance)}m` : '--'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <motion.div 
                  animate={{ width: distance ? `${Math.max(5, Math.min(100, 100 - (distance/50) * 100))}%` : '5%' }}
                  style={{ height: '100%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Compass = ({ size, color }: { size: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
  </svg>
);
