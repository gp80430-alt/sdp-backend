import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ArrowLeft, CheckCircle, Smartphone, Radar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// CACHE BUSTER: v2.0.1_FINAL_STABLE
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
    // 1. 초기 지연 단축 (0.5초)
    setTimeout(() => setIsReady(true), 500);
    
    // 2. 보물 로드 (실패 시 샘플 데이터라도 넣음)
    api.getTreasures().then(res => {
      const list = res.treasures || [];
      if (list.length === 0) {
        console.warn("No treasures found, using demo treasure.");
        // 테스트용: 사용자 근처 혹은 성동구청 근처 샘플
        setTreasures([{ id: 'demo', lat: 37.5635, lng: 127.0365, name: '샘플 보물', coinReward: 10 }]);
      } else {
        setTreasures(list);
      }
    });

    // 3. 위치 추적 (더 공격적으로)
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setCameraError("GPS 신호를 찾을 수 없습니다. 설정에서 위치 권한을 확인해 주세요."),
      { enableHighAccuracy: true, timeout: 5000 }
    );

    // 4. 카메라 시작
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(() => {});
        }
      } catch (err) {
        setCameraError("카메라를 켤 수 없습니다. 브라우저 권한을 확인해 주세요.");
      }
    };
    initCamera();

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
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
    
    // 발견 범위 (다시 5m로 소폭 완화 - 너무 안 나오면 답답하므로)
    if (isReady && minDist <= 5) {
      if (!nearTreasure) appearAudio.current.play().catch(() => {});
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
      await new Promise(r => setTimeout(r, 700));
    }

    try {
      await api.claimCoin({ userId: user.id, treasureId: nearTreasure.id, lat: myPos?.lat, lng: myPos?.lng, deviceId: 'web_client' });
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
      <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 2 }} />

      <div style={{ position: 'relative', zIndex: 10, padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onBack} style={{ width: 'fit-content', background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', padding: '10px' }}>
          <ArrowLeft size={24} color="white" />
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence>
            {!success && nearTreasure && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: shakeCount > 0 ? [0, -10, 10, -10, 10, 0] : 0 }} key={`shake-${shakeCount}`} exit={{ scale: 0 }} onClick={handleClaim} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '120px' }}>{claiming ? '📦' : '🎁'}</div>
                {!claiming && <div style={{ background: 'var(--primary)', color: 'black', padding: '10px 20px', borderRadius: '20px', fontWeight: 900, marginTop: '20px' }}>보물을 터치하세요!</div>}
              </motion.div>
            )}

            {success && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ textAlign: 'center' }}>
                <CheckCircle size={80} color="var(--primary)" style={{ marginBottom: '20px' }} />
                <h2 style={{ fontSize: '32px', color: 'white' }}>획득 성공!</h2>
              </motion.div>
            )}

            {!nearTreasure && !success && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
                <div className="pulse-primary" style={{ background: 'rgba(255,217,61,0.2)', padding: '30px', borderRadius: '50%', marginBottom: '20px' }}>
                  <Radar size={50} color="var(--primary)" />
                </div>
                <h3 style={{ color: 'white', marginBottom: '10px' }}>
                  {cameraError ? cameraError : (distance && distance < 30 ? "근처에 신호가 잡혔습니다! 📡" : "주변을 탐색 중입니다... 🔍")}
                </h3>
                <p style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>
                  {distance && distance < 1000 ? `${Math.round(distance)}m` : '---'}
                </p>
                {treasures.length === 0 && <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '10px' }}>근처에 배치된 보물이 없습니다.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
