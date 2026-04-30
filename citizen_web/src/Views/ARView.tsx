import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ArrowLeft, CheckCircle, Smartphone, Radar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// CACHE BUSTER: FINAL_AR_EXPERIENCE_v2.0.0


// 효과음 URL
const APPEAR_SFX = 'https://assets.mixkit.co/sfx/preview/mixkit-magical-appearance-611.mp3';
const SHAKE_SFX = 'https://assets.mixkit.co/sfx/preview/mixkit-box-shaking-1534.mp3';
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
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const appearAudio = useRef(new Audio(APPEAR_SFX));
  const successAudio = useRef(new Audio(SUCCESS_SFX));
  const shakeAudio = useRef(new Audio(SHAKE_SFX));

  useEffect(() => {
    // 1. 초기 지연 및 데이터 로드
    setTimeout(() => setIsReady(true), 2000);
    api.getTreasures().then(res => setTreasures(res.treasures || []));

    // 2. 위치 추적 시작
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true }
    );

    // 3. 카메라 시작 (Ref 기반)
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // 일부 브라우저 대응을 위해 명시적으로 play 호출
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Video play failed:", e));
          };
        }
      } catch (err: any) {
        console.error("Camera Error:", err);
        setCameraError(err.name === 'NotAllowedError' ? "카메라 권한이 거부되었습니다." : "카메라를 시작할 수 없습니다.");
      }
    };
    initCamera();

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
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
    
    // 3m 이내 탐지 로직 (isReady 지연 포함)
    if (isReady && minDist <= 3) {
      if (!nearTreasure) {
        appearAudio.current.play().catch(() => {});
        if (navigator.vibrate) navigator.vibrate(300);
      }
      setNearTreasure(closest);
    } else {
      setNearTreasure(null);
    }
  }, [myPos, treasures, isReady]);

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
    
    for (let i = 1; i <= 3; i++) {
      setShakeCount(i);
      shakeAudio.current.play().catch(() => {});
      if (navigator.vibrate) navigator.vibrate(100);
      await new Promise(r => setTimeout(r, 700));
    }

    try {
      await api.claimCoin({
        userId: user.id, treasureId: nearTreasure.id,
        lat: myPos?.lat, lng: myPos?.lng, deviceId: 'web_client'
      });
      
      successAudio.current.play().catch(() => {});
      setSuccess(true);
      await refresh();
      setTimeout(async () => { await refresh(); onBack(); }, 2000);
    } catch (err: any) {
      alert(err.message);
      setClaiming(false);
      setShakeCount(0);
    }
  };

  return (
    <div style={{ height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* 카메라 배경 (Ref 사용) */}
      <video 
        ref={videoRef}
        autoPlay 
        playsInline 
        muted 
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} 
      />
      
      {/* 카메라 실패 시 폴백 배경 */}
      {cameraError && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #1a1c2c, #4a192c)', zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>{cameraError}<br/>지도를 보며 이동해 주세요.</p>
        </div>
      )}

      {/* 어두운 오버레이 */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 2 }} />

      <div style={{ position: 'relative', zIndex: 10, padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onBack} className="btn-ghost" style={{ width: 'fit-content', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '10px' }}>
          <ArrowLeft size={24} color="white" />
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence>
            {!success && nearTreasure && (
              <motion.div
                initial={{ scale: 0, y: 100 }}
                animate={{ scale: 1, y: 0, rotate: shakeCount > 0 ? [0, -15, 15, -15, 15, 0] : 0 }}
                transition={{ y: { type: 'spring', damping: 10 } }}
                key={`shake-${shakeCount}`}
                exit={{ scale: 0, opacity: 0 }}
                onClick={handleClaim}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '140px', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }}>
                  {success ? '🎊' : (claiming ? '📦' : '🎁')}
                </div>
                {!claiming && (
                  <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{ background: 'var(--primary)', color: 'black', padding: '10px 25px', borderRadius: '30px', fontWeight: 900, marginTop: '30px' }}>
                    보물을 터치하세요!
                  </motion.div>
                )}
              </motion.div>
            )}

            {success && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ textAlign: 'center' }}>
                <div style={{ background: 'white', borderRadius: '50%', padding: '20px', display: 'inline-block', marginBottom: '20px' }}>
                  <CheckCircle size={80} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: '36px', fontWeight: 900, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>성공!</h2>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', marginTop: '15px' }}>+{nearTreasure.coinReward} SDP 획득</p>
              </motion.div>
            )}

            {!nearTreasure && !success && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
                <div className="pulse-primary" style={{ background: 'rgba(255,217,61,0.1)', padding: '40px', borderRadius: '50%', marginBottom: '30px', border: '2px dashed var(--primary)' }}>
                  <Radar size={60} color="var(--primary)" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '10px' }}>
                  {distance && distance < 15 ? '오! 아주 가까워요! 🔥' : (distance && distance < 30 ? '보물 신호를 잡았습니다! 📡' : '주변을 탐색하세요 🔍')}
                </h3>
                <p style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)' }}>
                  {distance && distance < 30 ? `${Math.round(distance)}m` : '---'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* 하단 거리 네비게이터 */}
      {!success && distance && distance < 30 && (
        <div style={{ position: 'absolute', bottom: '40px', left: '20px', right: '20px', background: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '25px', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', zIndex: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '50px', height: '50px', background: 'var(--grad-main)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radar size={24} color="black" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>보물 탐지기</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary)' }}>{Math.round(distance)}m</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <motion.div animate={{ width: `${Math.max(5, Math.min(100, 100 - (distance/30) * 100))}%` }} style={{ height: '100%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
