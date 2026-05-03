import React, { useEffect, useRef, useState, useCallback } from 'react';
import { setEvent, getTreasures, getActiveEvent } from '../services/api';

// ── 응봉산 팔각정 좌표 (기본 중심) ───────────────────────────────
const CENTER = { lat: 37.550473, lng: 127.024915 };
const MAX_MARKERS = 10;

interface TreasureMarker {
  id:         string;
  lat:        number;
  lng:        number;
  name:       string;
  coinReward: number;
  radius:     number;
}

interface PolygonCoord { lat: number; lng: number; }

declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
    __GMAPS_LOADED__: boolean;
    __GMAPS_CALLBACKS__: (() => void)[];
  }
}

export default function MapControl() {
  const mapRef        = useRef<HTMLDivElement>(null);
  const googleMapRef  = useRef<any>(null);
  const drawingMgrRef = useRef<any>(null);
  const polygonRef    = useRef<any>(null);
  const markersRef    = useRef<any[]>([]);

  const [markers,       setMarkers]       = useState<TreasureMarker[]>([]);
  const [polygonCoords, setPolygonCoords] = useState<PolygonCoord[]>([]);
  const [mapMode,       setMapMode]       = useState<'view' | 'polygon' | 'marker'>('view');
  const [mapLoaded,     setMapLoaded]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saveResult,    setSaveResult]    = useState<string | null>(null);
  const [editMarker,    setEditMarker]    = useState<TreasureMarker | null>(null);
  const [locLoading,    setLocLoading]    = useState(false);
  const [sampleCount,   setSampleCount]   = useState(3);

  const apiKey = import.meta.env.VITE_GMAPS_KEY || '';

  // Google Maps API 동적 로드 (drawing + geometry 라이브러리)
  const loadGoogleMaps = (key: string): Promise<void> =>
    new Promise((resolve) => {
      if (window.__GMAPS_LOADED__) { resolve(); return; }
      window.__GMAPS_CALLBACKS__.push(resolve);
      if (document.querySelector('#gmaps-script')) return;
      const script = document.createElement('script');
      script.id  = 'gmaps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=drawing,geometry&callback=initGoogleMaps`;
      script.async = true;
      document.head.appendChild(script);
    });

  // ── 지도 초기화 및 데이터 로드 ─────────────────────────────────────
  useEffect(() => {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      setMapLoaded(false);
      return;
    }
    loadGoogleMaps(apiKey).then(async () => {
      if (!mapRef.current || googleMapRef.current) return;

      const map = new window.google.maps.Map(mapRef.current, {
        center: CENTER, zoom: 16,
        mapTypeId: 'hybrid',
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: true,
        styles: DARK_MAP_STYLE,
      });
      googleMapRef.current = map;

      // Drawing Manager (다각형 그리기)
      const dm = new window.google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polygonOptions: {
          fillColor:    '#7C3AED',
          fillOpacity:  0.25,
          strokeColor:  '#A78BFA',
          strokeWeight: 2,
          editable:     true,
          draggable:    false,
        },
      });
      dm.setMap(map);
      drawingMgrRef.current = dm;

      // ── 기존 데이터 로드 ──
      try {
        const eventData = await getActiveEvent();
        if (eventData.success) {
          // 1. 다각형 복원
          if (eventData.polygon_coords && eventData.polygon_coords.length > 0) {
            setPolygonCoords(eventData.polygon_coords);
            const poly = new window.google.maps.Polygon({
              paths: eventData.polygon_coords,
              fillColor: '#7C3AED',
              fillOpacity: 0.25,
              strokeColor: '#7C3AED',
              strokeWeight: 2,
              editable: true,
              draggable: true,
            });
            poly.setMap(map);
            polygonRef.current = poly;
          }

          // 2. 마커 복원
          if (eventData.treasure_spots) {
            const ms = eventData.treasure_spots.map((s: any, idx: number) => {
              const spotId = s.id || `T${Date.now()}_${idx}`;
              const gMarker = new window.google.maps.Marker({
                position: { lat: s.lat, lng: s.lng },
                map,
                draggable: true,
                title: s.name,
                label: { text: `${idx + 1}`, color: '#fff', fontWeight: 'bold', fontSize: '12px' },
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 16,
                  fillColor: '#7C3AED',
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                },
              });

              const markerData: TreasureMarker = {
                id: spotId, lat: s.lat, lng: s.lng,
                name: s.name, coinReward: s.coinReward ?? 1, radius: s.radius ?? 30,
              };

              // 드래그 완료 시 상태 업데이트
              gMarker.addListener('dragend', (e: any) => {
                setMarkers(ms => ms.map(m => m.id === spotId
                  ? { ...m, lat: e.latLng.lat(), lng: e.latLng.lng() }
                  : m));
              });

              // 클릭 시 편집 모달
              gMarker.addListener('click', () => setEditMarker(markerData));

              markersRef.current.push({ id: spotId, gMarker });
              return markerData;
            });
            setMarkers(ms);
          }
        }
      } catch (err) {
        console.error("데이터 복원 실패:", err);
      }

      // 다각형 완료 이벤트
      window.google.maps.event.addListener(dm, 'polygoncomplete', (poly: any) => {
        if (polygonRef.current) polygonRef.current.setMap(null);
        polygonRef.current = poly;
        const coords = poly.getPath().getArray().map((ll: any) => ({
          lat: ll.lat(), lng: ll.lng()
        }));
        setPolygonCoords(coords);
        dm.setDrawingMode(null);
        setMapMode('view');

        window.google.maps.event.addListener(poly.getPath(), 'set_at', () => {
          const updated = poly.getPath().getArray().map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }));
          setPolygonCoords(updated);
        });
      });

      // 지도 클릭 → 마커 추가
      map.addListener('click', (e: any) => {
        setMapMode(prev => {
          if (prev !== 'marker') return prev;
          addMarkerAt(e.latLng.lat(), e.latLng.lng());
          return prev;
        });
      });

      setMapLoaded(true);
    });
  }, [apiKey]);

  // ── 마커 상태와 실제 지도 마커 동기화 ────────────────────────────────
  useEffect(() => {
    markers.forEach(m => {
      const ref = markersRef.current.find(r => r.id === m.id);
      if (ref && ref.gMarker) {
        const pos = ref.gMarker.getPosition();
        if (pos && (pos.lat() !== m.lat || pos.lng() !== m.lng)) {
          ref.gMarker.setPosition({ lat: m.lat, lng: m.lng });
        }
      }
    });
  }, [markers]);

  // ── 마커 추가 ────────────────────────────────────────────────
  const addMarkerAt = useCallback((lat: number, lng: number) => {
    setMarkers(prev => {
      if (prev.length >= MAX_MARKERS) {
        alert(`마커는 최대 ${MAX_MARKERS}개까지만 추가할 수 있습니다.`);
        return prev;
      }
      // 고유 ID 생성 (타임스탬프 활용)
      const uniqueId = `T${Date.now()}`;
      const newMarker: TreasureMarker = { id: uniqueId, lat, lng, name: `보물 스팟 ${prev.length + 1}`, coinReward: 1, radius: 30 };

      // 구글 맵 마커 생성
      const gMarker = new window.google.maps.Marker({
        position: { lat, lng },
        map: googleMapRef.current,
        draggable: true,
        title: newMarker.name,
        label: {
          text: `${prev.length + 1}`,
          color: '#fff', fontWeight: 'bold', fontSize: '12px'
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: '#7C3AED',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });

      // 드래그 완료 시 좌표 업데이트
      gMarker.addListener('dragend', (e: any) => {
        const newLat = e.latLng.lat();
        const newLng = e.latLng.lng();
        setMarkers(ms => ms.map(m => m.id === uniqueId ? { ...m, lat: newLat, lng: newLng } : m));
      });

      // 클릭 시 편집
      gMarker.addListener('click', () => {
        setEditMarker(newMarker);
      });

      markersRef.current.push({ id: uniqueId, gMarker });
      return [...prev, newMarker];
    });
  }, []);

  // ── 모드 전환 ────────────────────────────────────────────────
  useEffect(() => {
    if (!drawingMgrRef.current) return;
    const G = window.google.maps.drawing.OverlayType;
    drawingMgrRef.current.setDrawingMode(
      mapMode === 'polygon' ? G.POLYGON : null
    );
  }, [mapMode]);

  // ── 마커 삭제 ────────────────────────────────────────────────
  const deleteMarker = (id: string) => {
    const ref = markersRef.current.find(r => r.id === id);
    if (ref) { 
      ref.gMarker.setMap(null); 
      markersRef.current = markersRef.current.filter(r => r.id !== id); 
    }
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  // ── [추가] 마커 위치로 지도 이동 ──────────────────────────────
  const moveToMarker = (m: TreasureMarker) => {
    googleMapRef.current?.panTo({ lat: m.lat, lng: m.lng });
    googleMapRef.current?.setZoom(18);
  };

  // ── 다각형 지우기 ─────────────────────────────────────────────
  const clearPolygon = () => {
    if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
    setPolygonCoords([]);
  };

  // ── 저장 ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (polygonCoords.length < 3) { alert('다각형 행사 구역을 먼저 그려주세요.'); return; }
    if (markers.length === 0)     { alert('보물 스팟을 1개 이상 추가해주세요.'); return; }

    setSaving(true);
    setSaveResult(null);
    try {
      await setEvent({
        name:            '성동 AR 행사 구역',
        polygon_coords:  polygonCoords,
        treasure_spots:  markers,
      });
      setSaveResult('✅ 행사 설정이 저장되었습니다!');
    } catch (e: any) {
      setSaveResult(`❌ 저장 실패: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── [추가] 내 주변 혹은 구역 내에 랜덤 보물 생성 ──────────────────
  const createSamplesNearMe = () => {
    if (!navigator.geolocation) return alert('GPS를 지원하지 않습니다.');
    
    const scatterMarkers = (lat: number, lng: number) => {
      let count = 0;
      let attempts = 0;
      const targetCount = Math.min(sampleCount, MAX_MARKERS - markers.length);

      if (targetCount <= 0) return alert('더 이상 보물을 추가할 수 없습니다.');

      while (count < targetCount && attempts < 100) {
        attempts++;
        // 약 50~100m 이내 랜덤 오차
        const dLat = (Math.random() - 0.5) * 0.0008;
        const dLng = (Math.random() - 0.5) * 0.0008;
        const newLat = lat + dLat;
        const newLng = lng + dLng;

        // 다각형이 있으면 그 안에 있는지 확인
        if (polygonRef.current) {
          const point = new window.google.maps.LatLng(newLat, newLng);
          if (!window.google.maps.geometry.poly.containsLocation(point, polygonRef.current)) {
            continue; 
          }
        }

        addMarkerAt(newLat, newLng);
        count++;
      }
      setSaveResult(`🎁 ${count}개의 보물이 생성되었습니다!`);
    };

    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // 1. 구역이 없으면 샘플 사각형 생성
        if (polygonCoords.length === 0) {
          const pSize = 0.0004;
          const pCoords = [
            { lat: lat + pSize, lng: lng + pSize },
            { lat: lat + pSize, lng: lng - pSize },
            { lat: lat - pSize, lng: lng - pSize },
            { lat: lat - pSize, lng: lng + pSize },
          ];
          setPolygonCoords(pCoords);
          if (polygonRef.current) polygonRef.current.setMap(null);
          polygonRef.current = new window.google.maps.Polygon({
            paths: pCoords,
            map: googleMapRef.current,
            fillColor: '#7C3AED', fillOpacity: 0.25,
            strokeColor: '#A78BFA', strokeWeight: 2,
          });
        }
        
        // 2. 마커 뿌리기
        scatterMarkers(lat, lng);
        googleMapRef.current?.panTo({ lat, lng });
        setLocLoading(false);
      },
      (err) => { alert(err.message); setLocLoading(false); },
      { enableHighAccuracy: true }
    );
  };

  // ── [보안] 현재 위치로 이동 ───────────────────────────────────
  const moveToCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 정보를 지원하지 않습니다.');
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const newPos = { lat, lng };
        googleMapRef.current?.setCenter(newPos);
        googleMapRef.current?.setZoom(17);

        // 현재 위치 표시용 특수 마커
        new window.google.maps.Marker({
          position: newPos,
          map: googleMapRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#3B82F6', // 파란색
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
          },
          title: '현재 위치',
          zIndex: 999
        });
        setLocLoading(false);
      },
      (err) => {
        alert('위치 정보를 가져오지 못했습니다: ' + err.message);
        setLocLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* ── 툴바 ── */}
      <div style={styles.toolbar}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${mapMode === 'polygon' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMapMode(m => m === 'polygon' ? 'view' : 'polygon')}
            title="다각형을 클릭으로 그린 후 첫 점을 클릭해 닫으세요"
          >
            ⬡ 행사 구역 그리기
          </button>
          <button
            className={`btn ${mapMode === 'marker' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMapMode(m => m === 'marker' ? 'view' : 'marker')}
            disabled={markers.length >= MAX_MARKERS}
          >
            📍 보물 마커 추가 ({markers.length}/{MAX_MARKERS})
          </button>
          <button 
            className="btn btn-ghost" 
            onClick={moveToCurrentLocation}
            disabled={locLoading}
          >
            {locLoading ? '⌛ 찾는 중...' : '🎯 내 위치'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '0 8px' }}>
            <input 
              type="number" min={1} max={10} 
              value={sampleCount}
              onChange={e => setSampleCount(Number(e.target.value))}
              style={{ width: 40, background: 'transparent', border: 'none', color: '#fff', textAlign: 'center', fontSize: 13, padding: '8px 0' }}
            />
            <button 
              className="btn btn-ghost" 
              onClick={createSamplesNearMe}
              disabled={locLoading}
              style={{ color: '#FCD34D', paddingLeft: 4 }}
            >
              🎁 샘플 생성
            </button>
          </div>
          {polygonCoords.length > 0 && (
            <button className="btn btn-ghost" onClick={clearPolygon}>🗑 구역 삭제</button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveResult && (
            <span style={{ color: saveResult.startsWith('✅') ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>
              {saveResult}
            </span>
          )}
          <button className="btn btn-green" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '💾 행사 설정 저장'}
          </button>
        </div>
      </div>

      {/* ── 안내 배너 ── */}
      {mapMode !== 'view' && (
        <div style={styles.modeBanner}>
          {mapMode === 'polygon'
            ? '🖊 지도를 클릭해서 행사 구역 경계를 그리세요. 시작점을 다시 클릭하면 완료됩니다.'
            : `📍 지도를 클릭해서 보물 스팟을 추가하세요. (${MAX_MARKERS - markers.length}개 남음) — 마커를 드래그해서 위치 조정 가능`
          }
        </div>
      )}

      {/* ── 지도 + 사이드패널 ── */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>

        {/* 구글 지도 */}
        <div style={{ flex: 1, position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' ? (
            <div style={styles.mapPlaceholder}>
              <div>
                <p style={{ fontSize: 48, marginBottom: 16 }}>🗺️</p>
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Google Maps API 키가 필요합니다</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  <code>admin/.env</code> 파일에서<br />
                  <code>VITE_GMAPS_KEY=YOUR_KEY</code>를 설정해주세요
                </p>
              </div>
            </div>
          ) : (
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          )}

          {/* 지도 범례 */}
          <div style={styles.legend}>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#7C3AED' }} /> 보물 스팟</div>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#A78BFA', opacity: 0.5 }} /> 행사 구역</div>
          </div>
        </div>

        {/* 사이드 패널: 마커 목록 */}
        <div style={styles.sidePanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              📍 보물 스팟 목록
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{markers.length}/{MAX_MARKERS}</span>
          </div>

          {markers.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', paddingTop: 32 }}>
              마커 추가 모드에서<br />지도를 클릭하세요
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {markers.map((m, i) => (
                <div 
                  key={m.id} 
                  style={{...styles.markerCard, cursor: 'pointer'}}
                  onClick={() => moveToMarker(m)}
                  className="marker-list-item"
                >
                  <div style={styles.markerNum}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{m.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                    </div>
                    <div style={{ color: 'var(--yellow)', fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      🪙 <span>{m.coinReward} SDP</span>
                      <span style={{ color: 'var(--text-muted)' }}>|</span>
                      <span style={{ color: 'var(--text-muted)' }}>📡 {m.radius ?? 30}m</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      style={{ ...styles.iconBtn, color: '#A78BFA' }}
                      onClick={(e) => { e.stopPropagation(); setEditMarker(m); }}
                      title="편집"
                    >✎</button>
                    <button
                      style={{ ...styles.iconBtn, color: 'var(--red)' }}
                      onClick={(e) => { e.stopPropagation(); deleteMarker(m.id); }}
                      title="삭제"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 다각형 정보 */}
          {polygonCoords.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(124,58,237,0.1)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.3)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#A78BFA', marginBottom: 4 }}>⬡ 행사 구역</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>꼭짓점 {polygonCoords.length}개</div>
            </div>
          )}
        </div>
      </div>

      {/* 마커 편집 모달 */}
      {editMarker && (
        <MarkerEditModal
          marker={editMarker}
          onSave={(updated) => {
            setMarkers(prev => prev.map(m => m.id === updated.id ? updated : m));
            setEditMarker(null);
          }}
          onClose={() => setEditMarker(null)}
          onDelete={() => { deleteMarker(editMarker.id); setEditMarker(null); }}
        />
      )}
    </div>
  );
}

// ── 마커 편집 모달 ────────────────────────────────────────────────
function MarkerEditModal({ marker, onSave, onClose, onDelete }: {
  marker: TreasureMarker;
  onSave: (m: TreasureMarker) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [name,   setName]   = useState(marker.name);
  const [reward, setReward] = useState(marker.coinReward);
  const [radius, setRadius] = useState(marker.radius ?? 30);
  const [lat,    setLat]    = useState(marker.lat);
  const [lng,    setLng]    = useState(marker.lng);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">📍 보물 스팟 편집</div>

        <div style={{ marginBottom: 12 }}>
          <label className="form-label">스팟 이름</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="form-label">위치 정보 (위도, 경도)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              type="number" step="0.000001" value={lat}
              onChange={e => setLat(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <input
              className="form-input"
              type="number" step="0.000001" value={lng}
              onChange={e => setLng(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="form-label">코인 보상 (SDP)</label>
          <input className="form-input" type="number" min={1} max={100} value={reward}
            onChange={e => setReward(Number(e.target.value))} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="form-label">획득 반경 (m) — 현재: {radius}m</label>
          <input className="form-input" type="number" min={5} max={500} value={radius}
            onChange={e => setRadius(Number(e.target.value))} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }}
            onClick={() => onSave({ ...marker, name, coinReward: reward, lat, lng, radius })}>저장</button>
          <button className="btn btn-danger" onClick={onDelete}>삭제</button>
          <button className="btn btn-ghost" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: 8,
  },
  modeBanner: {
    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#A78BFA',
  },
  mapPlaceholder: {
    width: '100%', height: '100%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-card)', color: 'var(--text-primary)', textAlign: 'center',
  },
  legend: {
    position: 'absolute', bottom: 12, left: 12,
    background: 'rgba(13,20,37,0.9)', backdropFilter: 'blur(4px)',
    borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 12,
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' },
  legendDot:  { width: 12, height: 12, borderRadius: '50%', display: 'inline-block' },
  sidePanel: {
    width: 220, background: 'var(--bg-card)', borderRadius: 14,
    border: '1px solid var(--border)', padding: 16, overflowY: 'auto',
  },
  markerCard: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.04)', borderRadius: 10,
    padding: '10px 12px', border: '1px solid var(--border)',
    transition: 'all 0.2s ease',
  },
  markerNum: {
    width: 24, height: 24, borderRadius: '50%',
    background: '#7C3AED', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
  iconBtn: {
    background: 'rgba(255,255,255,0.05)', border: 'none', 
    borderRadius: 6, width: 24, height: 24, 
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 12, transition: 'background 0.2s',
  },
};

// 보물 마커 SVG 아이콘
const TREASURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="16" fill="#7C3AED" stroke="white" stroke-width="2"/>
  <text x="18" y="23" text-anchor="middle" font-size="16">💰</text>
</svg>`;

// 구글 맵 다크 스타일
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#1a3a2a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#334564' }] },
];
