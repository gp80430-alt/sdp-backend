import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ArrowLeft, CheckCircle, Radar } from 'lucide-react';
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
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

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

    // 3. 위치 추적
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(null);
      },
      (err) => {
        const msg = err.code === 1
          ? 'GPS 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.'
          : err.code === 2
          ? 'GPS 신호를 찾을 수 없습니다. 야외로 이동해 주세요.'
          : 'GPS 응답 시간이 초과되었습니다. 재시도 중…';
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
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
      setTimeout(async () => { await refresh(); onBack(); }, 2500);
    } catch (err: any) {
      setClaimError(err.message);
      setTimeout(() => setClaimError(null), 4000);
      setClaiming(false);
      setShakeCount(0);
    }
  };

  return (
    <div style={{ height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 2 }} />

      <div style={{ position: 'relative', zIndex: 10, padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 뒤로 + 상태바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onBack} style={{ background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft size={24} color="white" />
          </button>
          {/* GPS 상태 뱃지 */}
          <div style={{
            background: gpsError ? 'rgba(255,107,107,0.25)' : myPos ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)',
            border: `1px solid ${gpsError ? 'rgba(255,107,107,0.5)' : myPos ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.5)'}`,
            borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 700,
            color: gpsError ? '#ff6b6b' : myPos ? '#7fe9de' : '#fcd34d',
          }}>
            {gpsError ? '📵 GPS 오류' : myPos ? '📡 GPS 연결됨' : '🔍 GPS 탐색 중…'}
          </div>
        </div>

        {/* GPS 오류 메시지 */}
        {gpsError && (
          <div style={{
            marginTop: '10px', background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.4)',
            borderRadius: '12px', padding: '10px 14px', fontSize: '12px', color: '#fca5a5',
          }}>
            {gpsError}
          </div>
        )}

        {/* 카메라 오류 메시지 */}
        {cameraError && !gpsError && (
          <div style={{
            marginTop: '10px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: '12px', padding: '10px 14px', fontSize: '12px', color: '#fcd34d',
          }}>
            📷 {cameraError}
          </div>
        )}

        {/* 획득 실패 토스트 */}
        <AnimatePresence>
          {claimError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                marginTop: '10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)',
                borderRadius: '12px', padding: '10px 14px', fontSize: '13px', color: '#fca5a5', fontWeight: 600,
              }}
            >
              ❌ {claimError}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence>
            {!success && nearTreasure && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: shakeCount > 0 ? [0, -10, 10, -10, 10, 0] : 0 }}
                key={`shake-${shakeCount}`}
                exit={{ scale: 0, opacity: 0 }}
                onClick={handleClaim}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '120px', filter: claiming ? 'grayscale(0.5)' : 'none', transition: 'filter 0.3s' }}>
                  {claiming ? '📦' : '🎁'}
                </div>
                <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginTop: '10px' }}>
                  {nearTreasure.name}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '4px' }}>
                  보상: {nearTreasure.coinReward} SDP
                </div>
                {!claiming && (
                  <div style={{ background: 'var(--primary)', color: 'white', padding: '12px 24px', borderRadius: '20px', fontWeight: 900, marginTop: '20px', fontSize: '16px' }}>
                    탭해서 획득하기! 🎉
                  </div>
                )}
                {claiming && (
                  <div style={{ color: 'rgba(255,255,255,0.7)', marginTop: '16px', fontSize: '14px' }}>
                    획득 중…
                  </div>
                )}
              </motion.div>
            )}

            {success && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ textAlign: 'center' }}>
                <CheckCircle size={80} color="#7fe9de" style={{ marginBottom: '20px' }} />
                <h2 style={{ fontSize: '32px', color: 'white', marginBottom: '8px' }}>획득 성공!</h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px' }}>
                  +{nearTreasure?.coinReward ?? ''} SDP 적립되었습니다
                </p>
              </motion.div>
            )}

            {!nearTreasure && !success && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
                <div className="pulse-primary" style={{ background: 'rgba(99,102,241,0.2)', padding: '32px', borderRadius: '50%', marginBottom: '24px', display: 'inline-flex' }}>
                  <Radar size={52} color="#a78bfa" />
                </div>
                <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '18px' }}>
                  {distance && distance < 30
                    ? '📡 근처에 신호가 잡혔습니다!'
                    : '🔍 주변을 탐색 중…'}
                </h3>
                {distance !== null && distance < 1000 && (
                  <p style={{ fontSize: '36px', fontWeight: 900, color: distance < 30 ? '#7fe9de' : '#fcd34d', marginTop: '4px' }}>
                    {Math.round(distance)}m
                  </p>
                )}
                {distance !== null && distance < 1000 && (
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '8px' }}>
                    5m 이내에 가면 보물이 나타납니다
                  </p>
                )}
                {treasures.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '12px', fontSize: '13px' }}>
                    이 주변에 배치된 보물이 없습니다.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 하단 거리 표시바 */}
        {!nearTreasure && !success && distance !== null && distance < 200 && (
          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '12px 16px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
              <span>200m</span><span>목표 5m</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${Math.max(5, 100 - (distance / 200) * 100)}%`,
                background: distance < 30 ? '#7fe9de' : 'linear-gradient(90deg, #6366f1, #a78bfa)',
                transition: 'width 0.5s ease, background 0.5s ease',
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
