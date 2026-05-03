import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, Dimensions, Vibration, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics  from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { haversine, formatDistance } from '../utils/haversine';
import { useAuth } from '../context/AuthContext';
import { Linking } from 'react-native';
import { getTreasures, claimCoin, BASE_URL } from '../services/api';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Asset } from 'expo-asset';
import { Magnetometer, Accelerometer } from 'expo-sensors';

const { width: W, height: H } = Dimensions.get('window');
const CLAIM_RADIUS = 100; // 테스트를 위해 100m로 상향 (확실한 노출 확인용)

interface Treasure {
  id: string; name: string; lat: number; lng: number;
  coinReward: number; icon: string; radius: number;
}

interface Creature {
  id: string; name: string; type: 'fire' | 'water' | 'grass' | 'electric';
  modelUrl: string; spawnChance: number; // 0-1
  catchDifficulty: number; // 0-1
  icon: string;
}

// ── 파티클(폭죽) 한 개 ──────────────────────────────────────────
function Particle({ delay }: { delay: number }) {
  const x    = useRef(new Animated.Value(0)).current;
  const y    = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const angle  = Math.random() * Math.PI * 2;
  const speed  = 80 + Math.random() * 120;
  const colors = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#A78BFA','#FFA07A','#98FB98'];
  const color  = colors[Math.floor(Math.random() * colors.length)];
  const size   = 6 + Math.random() * 8;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(x,  { toValue: Math.cos(angle) * speed, duration: 800, useNativeDriver: true }),
        Animated.timing(y,  { toValue: Math.sin(angle) * speed - 60, duration: 800, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0,  duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      width: size, height: size,
      borderRadius: size / 2,
      backgroundColor: color,
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      opacity: op,
    }} />
  );
}

// ── 폭죽 컨테이너 ────────────────────────────────────────────────
function Confetti({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 40 }).map((_, i) => (
        <View key={i} style={styles.particleOrigin}>
          <Particle delay={i * 20} />
        </View>
      ))}
    </View>
  );
}

// ── 주 화면 ─────────────────────────────────────────────────────
export default function ARScreen({ navigation }: any) {
  const { user, refreshBalance } = useAuth();
  const [camPerm,  requestCam]  = useCameraPermissions();
  const [locPerm,  setLocPerm]  = useState(false);

  // 보물 데이터
  const [treasures,   setTreasures]   = useState<Treasure[]>([]);
  const [nearTreasure, setNearTreasure] = useState<Treasure | null>(null);
  const [distances,   setDistances]   = useState<Record<string, number>>({});
  const [modelUrl, setModelUrl] = useState<string | undefined>();

  // 크리처 데이터
  const [creatures, setCreatures] = useState<Creature[]>([
    { id: 'C001', name: '불꽃몬', type: 'fire', modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Duck/glTF/Duck.gltf', spawnChance: 0.3, catchDifficulty: 0.4, icon: '🔥' },
    { id: 'C002', name: '물방몬', type: 'water', modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Duck/glTF/Duck.gltf', spawnChance: 0.3, catchDifficulty: 0.4, icon: '💧' },
    { id: 'C003', name: '풀몬', type: 'grass', modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Duck/glTF/Duck.gltf', spawnChance: 0.3, catchDifficulty: 0.4, icon: '🌿' },
  ]);
  const [nearCreature, setNearCreature] = useState<Creature | null>(null);
  const [spawnedCreatures, setSpawnedCreatures] = useState<Array<Creature & { lat: number; lng: number }>>([]);
  
  // 기기 방향 (AR 효과용)
  const [deviceOrientation, setDeviceOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const orientationSub = useRef<any>(null);

  // 보물/크리처별 3D 모델 매핑 (실제 GLTF 파일로 교체 필요)
  const modelMap: Record<string, string> = {
    'T001': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Coin/glTF/Coin.gltf',
    'T002': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Coin/glTF/Coin.gltf',
    'C001': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Duck/glTF/Duck.gltf',
    'C002': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Duck/glTF/Duck.gltf',
    'C003': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Duck/glTF/Duck.gltf',
    // 기본 모델
    'default': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Coin/glTF/Coin.gltf',
  };

  // 크리처 스폰 함수
  const spawnCreatures = useCallback(() => {
    if (!myPos) return;
    
    const newSpawned = [...spawnedCreatures];
    creatures.forEach(creature => {
      if (Math.random() < creature.spawnChance && !newSpawned.find(c => c.id === creature.id)) {
        // 사용자 위치 주변 100-500m 내 랜덤 스폰
        const latOffset = (Math.random() - 0.5) * 0.01; // 약 1km 반경
        const lngOffset = (Math.random() - 0.5) * 0.01;
        newSpawned.push({
          ...creature,
          lat: myPos.lat + latOffset,
          lng: myPos.lng + lngOffset,
        });
      }
    });
    setSpawnedCreatures(newSpawned);
  }, [myPos, creatures, spawnedCreatures]);

  // 근처 보물 변경 시 모델 URL 업데이트
  useEffect(() => {
    if (nearTreasure) {
      setModelUrl(modelMap[nearTreasure.id] || modelMap['default']);
    } else {
      setModelUrl(undefined);
    }
  }, [nearTreasure]);

  // ── 3D AR 씬 설정 (표면 감지 + 방향 가이드) ────────────────────────────────────────────────
  const createARScene = useCallback((gl: any) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 하늘색 배경 (AR 느낌)

    const camera = new THREE.PerspectiveCamera(75, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0); // 사람 눈높이

    const renderer = new THREE.WebGLRenderer({ canvas: gl, context: gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

    // 조명 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // 가상 지면 (표면 감지 효과)
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x808080, 
      transparent: true, 
      opacity: 0.3,
      side: THREE.DoubleSide 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    scene.add(ground);

    // 격자 무늬 (AR 그리드)
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridHelper.position.y = -1;
    scene.add(gridHelper);

    // 기본 3D 오브젝트 (GLTF 로드 실패 시 대체)
    const geometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
    let treasureModel = new THREE.Mesh(geometry, material);
    treasureModel.position.y = 0; // 지면 위에 배치

    // GLTF 모델 로드 시도
    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          scene.remove(treasureModel);
          treasureModel = gltf.scene;
          treasureModel.position.y = 0;
          scene.add(treasureModel);
        },
        undefined,
        (error) => console.error('GLTF 로드 오류:', error)
      );
    } else {
      scene.add(treasureModel);
    }

    // 방향 화살표 (목표물 방향 표시)
    const arrowGeometry = new THREE.ConeGeometry(0.3, 1, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(0, 2, -3);
    arrow.rotation.x = Math.PI / 2;
    scene.add(arrow);

    // 회전 애니메이션 + 기기 방향 반영
    const animate = () => {
      const frame = requestAnimationFrame(animate);
      
      // 기기 방향에 따른 카메라 회전 (AR 효과)
      const alpha = deviceOrientation.alpha * (Math.PI / 180);
      camera.rotation.y = alpha;

      if (treasureModel) {
        treasureModel.rotation.y += 0.01;
      }
      
      // 화살표 깜빡임
      arrow.material = new THREE.MeshBasicMaterial({ 
        color: arrow.material.color,
        transparent: true,
        opacity: 0.5 + Math.sin(Date.now() * 0.005) * 0.5
      });

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();

    return { scene, camera, renderer };
  }, [modelUrl, deviceOrientation]);

  // 위치
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const spawnTimer = useRef<NodeJS.Timeout | null>(null);

  // UI 상태
  const [claiming,     setClaiming]     = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [claimMsg,     setClaimMsg]     = useState('');
  const claimedThisSession = useRef<Set<string>>(new Set());

  // 애니메이션
  const coinScale    = useRef(new Animated.Value(0)).current;
  const coinRotate   = useRef(new Animated.Value(0)).current;
  const coinFloat    = useRef(new Animated.Value(0)).current;
  const coinOpacity  = useRef(new Animated.Value(0)).current;
  const scannerAnim  = useRef(new Animated.Value(0)).current;
  const msgOpacity   = useRef(new Animated.Value(0)).current;
  const radarScale   = useRef(new Animated.Value(1)).current;
  const radarOpacity = useRef(new Animated.Value(0.6)).current;

  // ── 카메라/위치 권한 요청 ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (!camPerm?.granted) await requestCam();
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocPerm(status === 'granted');
    })();
    fetchTreasures();

    // 스캐너 라인 애니메이션
    Animated.loop(
      Animated.timing(scannerAnim, { toValue: 1, duration: 2500, useNativeDriver: true })
    ).start();

    // 레이더 펄스
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(radarScale,   { toValue: 1.8, duration: 1200, useNativeDriver: true }),
          Animated.timing(radarOpacity, { toValue: 0,   duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(radarScale,   { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(radarOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // 기기 방향 센서 구독
    const subscribeOrientation = async () => {
      Magnetometer.setUpdateInterval(100);
      Accelerometer.setUpdateInterval(100);
      
      orientationSub.current = Magnetometer.addListener((data) => {
        setDeviceOrientation(prev => ({ ...prev, alpha: data.alpha }));
      });
    };
    subscribeOrientation();

    return () => { 
      locationSub.current?.remove(); 
      if (spawnTimer.current) clearInterval(spawnTimer.current);
      orientationSub.current?.remove();
    };
  }, []);

  const fetchTreasures = async () => {
    try {
      console.log("📡 보물 데이터 동기화 시도 중...");
      const res = await getTreasures();
      console.log("✅ 보물 데이터 로드 성공:", res.treasures?.length);
      setTreasures(res.treasures || []);
    } catch (err: any) {
      console.error("❌ 보물 데이터 동기화 실패:", err.message);
      Alert.alert("동기화 오류", "서버에서 보물 정보를 가져오지 못했습니다.");
    }
  };

  // ── 위치 권한 획득 후 GPS 추적 시작 ────────────────────────────
  useEffect(() => {
    if (!locPerm) return;
    console.log("🚀 GPS 추적 및 데이터 로드 시작");
    startTracking();
    fetchTreasures(); 
  }, [locPerm]);

  // ── GPS 1초마다 추적 ──────────────────────────────────────────
  const startTracking = async () => {
    locationSub.current?.remove();
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
      (loc) => {
        const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setMyPos(pos);
        checkProximity(pos);
      }
    );

    // 크리처 스폰 타이머 시작 (30초마다)
    if (!spawnTimer.current) {
      spawnTimer.current = setInterval(spawnCreatures, 30000);
    }
  };

  // ── Haversine 거리 계산 + 10m 이내 보물/크리처 감지 ─────────────────
  const checkProximity = useCallback((pos: { lat: number; lng: number }) => {
    // 보물 체크
    if (treasures.length > 0) {
      const dists: Record<string, number> = {};
      let closest: Treasure | null = null;
      let closestDist = Infinity;

      for (const t of treasures) {
        if (typeof t.lat !== 'number' || typeof t.lng !== 'number') continue;
        const d = haversine(pos.lat, pos.lng, t.lat, t.lng);
        dists[t.id] = d;
        if (d < closestDist) { closestDist = d; closest = t; }
      }
      setDistances(dists);

      if (closest && closestDist <= CLAIM_RADIUS && !claimedThisSession.current.has(closest.id)) {
        setNearTreasure(closest);
        setNearCreature(null);
        showCoinAnimation();
      } else if (!closest || closestDist > CLAIM_RADIUS * 3) {
        hideCoinAnimation();
        setNearTreasure(null);
      }
    }

    // 크리처 체크
    const nearbyCreature = spawnedCreatures.find(c => {
      const d = haversine(pos.lat, pos.lng, c.lat, c.lng);
      return d <= 50; // 50m 이내 크리처 감지
    });

    if (nearbyCreature) {
      setNearCreature(nearbyCreature);
      setModelUrl(nearbyCreature.modelUrl);
      showCoinAnimation();
    } else if (nearCreature) {
      setNearCreature(null);
      hideCoinAnimation();
    }
  }, [treasures, spawnedCreatures, nearCreature]);

  // 보물 목록 로드 후 재계산
  useEffect(() => {
    if (myPos) checkProximity(myPos);
  }, [treasures]);

  // ── 코인 팝업 애니메이션 (등장) ──────────────────────────────
  const showCoinAnimation = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(coinScale,   { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(coinOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      // 둥둥 + 회전 무한 반복
      Animated.loop(
        Animated.sequence([
          Animated.timing(coinFloat, { toValue: -18, duration: 1000, useNativeDriver: true }),
          Animated.timing(coinFloat, { toValue: 0,   duration: 1000, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.timing(coinRotate, { toValue: 1, duration: 2000, useNativeDriver: true })
      ).start();
    });
  };

  const hideCoinAnimation = () => {
    Animated.parallel([
      Animated.timing(coinScale,   { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(coinOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      coinRotate.stopAnimation();
      coinRotate.setValue(0);
    });
  };

  // ── [1단계] 구글 맵 내비게이션 연결 ──────────────────────────
  const openNavigation = (t: Treasure) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${t.lat},${t.lng}`,
      android: `geo:0,0?q=${t.lat},${t.lng}(${t.name})`,
    });
    if (url) Linking.openURL(url);
  };

  // ── 획득 처리 (보물/크리처) ─────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!myPos || !user || claiming) return;
    if (!nearTreasure && !nearCreature) return;

    setClaiming(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      let earned = 0;
      let msg = '';
      
      if (nearTreasure) {
        const res = await claimCoin({
          userId:     user.id,
          treasureId: nearTreasure.id,
          lat:        myPos.lat,
          lng:        myPos.lng,
          deviceId:   Platform.OS + '_' + (user.id ?? 'anon'),
        });
        earned = res.earned ?? nearTreasure.coinReward;
        msg = `🎉 ${earned} 성동 코인 획득!`;
        claimedThisSession.current.add(nearTreasure.id);
        setNearTreasure(null);
        await refreshBalance();
      } else if (nearCreature) {
        earned = 50; // 크리처 잡으면 50코인
        msg = `🎉 ${nearCreature.name}을(를) 잡았다! +${earned} 코인`;
        setSpawnedCreatures(prev => prev.filter(c => c.id !== nearCreature.id));
        setNearCreature(null);
      }

      // 성공 피드백
      setShowConfetti(true);
      setClaimMsg(msg);
      Animated.sequence([
        Animated.timing(msgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(msgOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();

      hideCoinAnimation();
      setTimeout(() => setShowConfetti(false), 2000);

    } catch (e: any) {
      Alert.alert('획득 실패', e.message);
    } finally {
      setClaiming(false);
    }
  };

  // 근처 보물/크리처 목록 (거리 순)
  const nearbyList = [
    ...treasures.map(t => ({ ...t, dist: distances[t.id] ?? Infinity, type: 'treasure' as const })),
    ...spawnedCreatures.map(c => ({ 
      ...c, 
      dist: myPos ? haversine(myPos.lat, myPos.lng, c.lat, c.lng) : Infinity, 
      type: 'creature' as const 
    })),
  ].sort((a, b) => a.dist - b.dist).slice(0, 5);

  // 권한 없음 화면
  if (!camPerm?.granted) {
    return (
      <LinearGradient colors={['#0A0E1A', '#0F1B35']} style={styles.permScreen}>
        <Text style={{ fontSize: 48 }}>📷</Text>
        <Text style={styles.permTitle}>카메라 권한이 필요합니다</Text>
        <Text style={styles.permSub}>AR 보물찾기를 위해 카메라와 위치 정보에 접근해 주세요.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestCam}>
          <Text style={styles.permBtnText}>권한 허용하기</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const rotate = coinRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scannerY = scannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, H * 0.55] });

  return (
    <View style={styles.container}>
      {/* ── 카메라 뷰 ── */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* ── 스캐너 오버레이 ── */}
      <View style={styles.scannerFrame}>
        <View style={[styles.scannerCorner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
        <View style={[styles.scannerCorner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
        <View style={[styles.scannerCorner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
        <View style={[styles.scannerCorner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
        <Animated.View style={[styles.scannerLine, { transform: [{ translateY: scannerY }] }]} />
      </View>

      {/* ── 상단 HUD ── */}
      <SafeAreaView style={styles.hud}>
        <View style={styles.hudRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← 뒤로</Text>
          </TouchableOpacity>
          <View style={styles.hudCenter}>
            <Text style={styles.hudTitle}>{user?.title || '성동 입문자'} {user?.name}</Text>
            {myPos && <Text style={styles.hudSub}>GPS 활성 🟢</Text>}
          </View>
          <View style={styles.hudCoin}>
            <Text style={styles.hudCoinText}>🪙 {user?.balance ?? 0}</Text>
          </View>
        </View>

        {/* 근처 보물 목록 */}
        <View style={styles.nearbyList}>
          {nearbyList.map(t => (
            <View key={t.id} style={[
              styles.nearbyItem,
              t.dist <= CLAIM_RADIUS && styles.nearbyItemClose,
            ]}>
              <Text style={{ fontSize: 16 }}>{t.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.nearbyName}>{t.name}</Text>
                <Text style={[styles.nearbyDist, t.dist <= CLAIM_RADIUS && { color: '#4ADE80' }]}>
                  {t.dist <= CLAIM_RADIUS ? '🎯 범위 내!' : formatDistance(t.dist)} • {t.lat.toFixed(5)}, {t.lng.toFixed(5)}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.navBtn} 
                onPress={() => openNavigation(t as any)}
              >
                <Text style={styles.navBtnText}>길찾기</Text>
              </TouchableOpacity>
              <Text style={styles.nearbyCoin}>+{t.coin_reward || t.coinReward}</Text>
            </View>
          ))}
        </View>
      </SafeAreaView>

      {/* ── 레이더 펄스 (AR 탐색 중 표시) ── */}
      {!nearTreasure && !nearCreature && (
        <View style={styles.radarContainer} pointerEvents="none">
          <Animated.View style={[styles.radarRing, {
            transform: [{ scale: radarScale }],
            opacity: radarOpacity,
          }]} />
          <View style={styles.radarCenter}>
            <Text style={{ fontSize: 28 }}>📡</Text>
          </View>
        </View>
      )}

      {/* ── 나침반 (방향 표시) ── */}
      <View style={styles.compass} pointerEvents="none">
        <Text style={styles.compassText}>N</Text>
        <View style={[styles.compassArrow, { transform: [{ rotate: `${-deviceOrientation.alpha}deg` }] }]}>
          <Text style={{ fontSize: 24 }}>↑</Text>
        </View>
      </View>

      {/* ── 방향 가이드 (가장 가까운 대상) ── */}
      {nearbyList.length > 0 && !nearTreasure && !nearCreature && (
        <View style={styles.directionGuide}>
          <Text style={styles.directionGuideText}>
            {nearbyList[0].type === 'creature' ? '🎮' : '🪙'} {formatDistance(nearbyList[0].dist)}
          </Text>
        </View>
      )}

      {/* ── 보물 코인 (10m 이내 등장) ── */}
      {nearTreasure && (
        <TouchableOpacity
          style={styles.coinWrapper}
          onPress={handleClaim}
          disabled={claiming}
          activeOpacity={0.8}
        >
          <Animated.View style={[styles.coinContainer, {
            opacity: coinOpacity,
            transform: [
              { scale: coinScale },
              { translateY: coinFloat },
              { rotate },
            ],
          }]}>
            {/* 빛 번짐 */}
            <View style={styles.coinGlow} />
            {/* 3D 코인 본체 */}
            <GLView
              key={modelUrl}
              style={[styles.coinContainer, { backgroundColor: 'transparent' }]}
              onContextCreate={(gl) => createARScene(gl)}
            />
            {/* 반짝이 입자 */}
            {[...Array(6)].map((_, i) => (
              <Animated.View key={i} style={[
                styles.sparkle,
                {
                  top:  40 + 55 * Math.sin((i / 6) * Math.PI * 2),
                  left: 40 + 55 * Math.cos((i / 6) * Math.PI * 2),
                  transform: [{ rotate: `${i * 60}deg` }],
                },
              ]}>
                <Text style={{ fontSize: 10 }}>✨</Text>
              </Animated.View>
            ))}
          </Animated.View>

           {/* 터치 유도 텍스트 */}
           <View style={styles.tapHint}>
             <Text style={styles.tapHintText}>
               {claiming ? '획득 중…' : nearCreature ? '탭하여 잡기!' : '탭하여 획득!'}
             </Text>
             <Text style={styles.tapHintSub}>
               {nearCreature ? `${nearCreature.name} (${nearCreature.type})` : `${nearTreasure?.name} — ${nearTreasure?.coinReward} SDP`}
             </Text>
           </View>
        </TouchableOpacity>
      )}

      {/* ── 폭죽 이펙트 ── */}
      <Confetti visible={showConfetti} />

      {/* ── 획득 메시지 ── */}
      <Animated.View style={[styles.claimMsg, { opacity: msgOpacity }]}>
        <Text style={styles.claimMsgText}>{claimMsg}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#000' },

  // 스캐너
  scannerFrame: {
    position: 'absolute', top: H * 0.25, left: W * 0.1,
    width: W * 0.8, height: H * 0.55,
  },
  scannerCorner: {
    position: 'absolute', width: 24, height: 24, borderColor: '#6366F1',
  },
  scannerLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: 'rgba(99,102,241,0.7)',
    shadowColor: '#6366F1', shadowRadius: 6, elevation: 4,
  },

  // HUD
  hud:      { position: 'absolute', top: 0, left: 0, right: 0 },
  hudRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  backBtn:  { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backBtnText: { color: '#FFF', fontSize: 13 },
  hudCenter:{ alignItems: 'center' },
  hudTitle: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  hudSub:   { color: '#4ADE80', fontSize: 10, marginTop: 2 },
  hudCoin:  { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  hudCoinText: { color: '#FFD700', fontSize: 13, fontWeight: '700' },

  // 근처 보물
  nearbyList: { marginHorizontal: 16, marginTop: 12, gap: 6 },
  nearbyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  nearbyItemClose: { borderColor: 'rgba(74,222,128,0.5)', backgroundColor: 'rgba(0,0,0,0.7)' },
  nearbyName: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  nearbyDist: { color: '#94A3B8', fontSize: 11 },
  navBtn: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
  },
  navBtnText: { color: '#A5B4FC', fontSize: 10, fontWeight: '600' },
  nearbyCoin: { color: '#FFD700', fontSize: 13, fontWeight: '700' },

  // 레이더
  radarContainer: {
    position: 'absolute', top: H * 0.42, left: W / 2 - 40,
    width: 80, height: 80, alignItems: 'center', justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: 'rgba(99,102,241,0.6)',
  },
  radarCenter: { alignItems: 'center', justifyContent: 'center' },

  // 코인
  coinWrapper: {
    position: 'absolute', top: H * 0.28, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  coinContainer: {
    width: 130, height: 130,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  coinGlow: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,215,0,0.2)',
    shadowColor: '#FFD700', shadowRadius: 30, shadowOpacity: 1,
  },
  coinEmoji: { fontSize: 80, textShadowColor: '#FFD700', textShadowRadius: 20 },
  sparkle:   { position: 'absolute' },
  tapHint:   { marginTop: 16, alignItems: 'center' },
  tapHintText: {
    color: '#FFD700', fontSize: 20, fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4,
  },
  tapHintSub: { color: '#FFF', fontSize: 12, marginTop: 4, opacity: 0.8 },

  // 파티클
  particleOrigin: {
    position: 'absolute', top: '50%', left: '50%',
    alignItems: 'center', justifyContent: 'center',
  },

  // 획득 메시지
  claimMsg: {
    position: 'absolute', bottom: 120, left: 20, right: 20,
    backgroundColor: 'rgba(16,185,129,0.9)', borderRadius: 16,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.5)',
  },
  claimMsgText: { color: '#FFF', fontSize: 18, fontWeight: '800' },

   // 권한 화면
  permScreen:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle:   { color: '#FFF', fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  permSub:     { color: '#6B7EAB', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  permBtn:     { backgroundColor: '#6366F1', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  permBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // 나침반
  compass: {
    position: 'absolute', top: H * 0.55, right: 20,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  compassText: { color: '#FF0000', fontSize: 14, fontWeight: '700', position: 'absolute', top: 2 },
  compassArrow: { position: 'absolute' },

  // 방향 가이드
  directionGuide: {
    position: 'absolute', bottom: 200, left: 20, right: 20,
    backgroundColor: 'rgba(99,102,241,0.8)', borderRadius: 12,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  directionGuideText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
