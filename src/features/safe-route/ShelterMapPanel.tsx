import { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { useKakaoLoader } from 'react-kakao-maps-sdk';
import { useSafeRouteStore } from './safeRouteStore';

declare global {
  interface Window {
    kakao: any;
  }
}

const STATUS_COLOR: Record<string, string> = {
  '운영 중': '#0f766e',
  '대기': '#b45309',
  '만원': '#dc2626',
};

const RADIUS_OPTIONS = [0.5, 1, 2] as const;
const RADIUS_LABEL: Record<number, string> = { 0.5: '500m', 1: '1km', 2: '2km' };
const MAP_DISPLAY_RADIUS_KM = 10; // GPS 기준 이 범위 안 마커만 지도에 표시

function calcDistKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ShelterMapPanel() {
  const kakaoMapKey = import.meta.env.VITE_KAKAO_MAP_KEY ?? '';
  const [kakaoLoading, error] = useKakaoLoader({
    appkey: kakaoMapKey,
    libraries: ['services', 'clusterer'],
    url: 'https://dapi.kakao.com/v2/maps/sdk.js',
  });

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const currentOverlayRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const shelters = useSafeRouteStore((s) => s.shelters);
  const selectedId = useSafeRouteStore((s) => s.selectedShelterId);
  const activeRoute = useSafeRouteStore((s) => s.activeRoute);
  const currentLocation = useSafeRouteStore((s) => s.currentLocation);
  const radiusFilter = useSafeRouteStore((s) => s.radiusFilter);
  const isLocating = useSafeRouteStore((s) => s.isLocating);
  const selectShelter = useSafeRouteStore((s) => s.selectShelter);
  const fetchCurrentLocation = useSafeRouteStore((s) => s.fetchCurrentLocation);
  const fetchShelters = useSafeRouteStore((s) => s.fetchShelters);
  const setRadiusFilter = useSafeRouteStore((s) => s.setRadiusFilter);

  // 대피소 데이터 로드
  useEffect(() => {
    fetchShelters().catch(() => {});
  }, [fetchShelters]);

  // 지도 초기화
  useEffect(() => {
    if (kakaoLoading || error || !kakaoMapKey || !window.kakao?.maps?.Map || !mapRef.current) return;
    const SEOUL_BOUNDS = {
      sw: { lat: 37.413294, lng: 126.734086 },
      ne: { lat: 37.715133, lng: 127.269311 },
    };
    const map = new window.kakao.maps.Map(mapRef.current, {
      center: new window.kakao.maps.LatLng(37.5665, 126.978),
      level: 7,
      maxLevel: 8,
    });
    window.kakao.maps.event.addListener(map, 'center_changed', () => {
      const c = map.getCenter();
      const lat = Math.min(Math.max(c.getLat(), SEOUL_BOUNDS.sw.lat), SEOUL_BOUNDS.ne.lat);
      const lng = Math.min(Math.max(c.getLng(), SEOUL_BOUNDS.sw.lng), SEOUL_BOUNDS.ne.lng);
      if (lat !== c.getLat() || lng !== c.getLng()) {
        map.setCenter(new window.kakao.maps.LatLng(lat, lng));
      }
    });
    mapInstanceRef.current = map;
    setMapReady(true);
    fetchCurrentLocation().catch(() => {});
  }, [error, fetchCurrentLocation, kakaoLoading, kakaoMapKey]);

  // resize 대응
  useEffect(() => {
    if (!mapReady) return;
    const onResize = () => mapInstanceRef.current?.relayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mapReady]);

  // GPS 현재 위치 오버레이
  useEffect(() => {
    if (!mapReady || !currentLocation) return;
    const { kakao } = window;
    if (currentOverlayRef.current) currentOverlayRef.current.setMap(null);
    const gpsEl = document.createElement('div');
    gpsEl.style.cssText = 'padding:6px 10px;border-radius:8px;background:#0d2d35;color:#fff;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 4px 14px rgba(13,45,53,0.28);cursor:default;';
    gpsEl.textContent = '📍 현재 위치';
    gpsEl.addEventListener('click', (e) => e.stopPropagation());
    currentOverlayRef.current = new kakao.maps.CustomOverlay({
      map: mapInstanceRef.current,
      position: new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng),
      content: gpsEl,
      yAnchor: 1.4,
    });
    mapInstanceRef.current.panTo(new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng));
  }, [mapReady, currentLocation]);

  // 반경 원 (수동 필터 설정 시만 표시)
  useEffect(() => {
    if (!mapReady) return;
    const { kakao } = window;
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setMap(null);
      radiusCircleRef.current = null;
    }
    if (!currentLocation || !radiusFilter) return;
    radiusCircleRef.current = new kakao.maps.Circle({
      map: mapInstanceRef.current,
      center: new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng),
      radius: radiusFilter * 1000,
      strokeWeight: 2,
      strokeColor: '#0f766e',
      strokeOpacity: 0.65,
      strokeStyle: 'dashed',
      fillColor: '#0f766e',
      fillOpacity: 0.06,
    });
    const deg = radiusFilter / 111;
    const bounds = new kakao.maps.LatLngBounds(
      new kakao.maps.LatLng(currentLocation.lat - deg, currentLocation.lng - deg),
      new kakao.maps.LatLng(currentLocation.lat + deg, currentLocation.lng + deg),
    );
    mapInstanceRef.current.setBounds(bounds, 60);
  }, [mapReady, currentLocation, radiusFilter]);

  // 대피소 마커 — GPS 기준 10km 이내만 표시, 수동 반경 설정 시 그 안만 표시
  useEffect(() => {
    if (!mapReady) return;
    const { kakao } = window;
    markersRef.current.forEach((o) => o.setMap(null));
    markersRef.current = [];

    shelters.forEach((shelter) => {
      const dist = currentLocation
        ? calcDistKm(currentLocation.lat, currentLocation.lng, shelter.lat, shelter.lng)
        : null;
      const displayRadius = radiusFilter ?? MAP_DISPLAY_RADIUS_KM;
      const isSelected = shelter.id === selectedId;
      const showOnMap = isSelected || dist === null || dist <= displayRadius;
      if (!showOnMap) return;

      const color = STATUS_COLOR[shelter.status] ?? '#6b7280';
      const size = isSelected ? '18px' : '14px';

      const content = document.createElement('div');
      content.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;';
      content.innerHTML = `
        <div style="width:${size};height:${size};border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 ${isSelected ? '10px' : '8px'} ${color}33;"></div>
        <div style="padding:3px 8px;border-radius:6px;background:${isSelected ? color : '#fff'};color:${isSelected ? '#fff' : '#162522'};font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(19,32,29,0.14);">${shelter.name}</div>
      `;
      content.addEventListener('click', (e) => {
        e.stopPropagation();
        selectShelter(shelter.id);
      });

      const overlay = new kakao.maps.CustomOverlay({
        map: mapInstanceRef.current,
        position: new kakao.maps.LatLng(shelter.lat, shelter.lng),
        content,
        yAnchor: 1,
      });
      markersRef.current.push(overlay);
    });
  }, [mapReady, shelters, selectedId, currentLocation, radiusFilter, selectShelter]);

  // 선택 대피소로 지도 이동
  useEffect(() => {
    if (!mapReady) return;
    const selected = shelters.find((s) => s.id === selectedId);
    if (!selected) return;
    mapInstanceRef.current?.panTo(new window.kakao.maps.LatLng(selected.lat, selected.lng));
  }, [mapReady, selectedId, shelters]);

  // 경로선
  useEffect(() => {
    if (!mapReady) return;
    const { kakao } = window;
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (!activeRoute || activeRoute.path.length === 0) return;
    const linePath = activeRoute.path.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
    polylineRef.current = new kakao.maps.Polyline({
      map: mapInstanceRef.current,
      path: linePath,
      strokeWeight: 5,
      strokeColor: activeRoute.mode === 'CAR' ? '#0f766e' : '#2563eb',
      strokeOpacity: 0.85,
      strokeStyle: 'solid',
    });
    const bounds = new kakao.maps.LatLngBounds();
    linePath.forEach((p) => bounds.extend(p));
    mapInstanceRef.current.setBounds(bounds, 60);
  }, [mapReady, activeRoute]);

  const inRangeCount =
    radiusFilter && currentLocation
      ? shelters.filter((s) => calcDistKm(currentLocation.lat, currentLocation.lng, s.lat, s.lng) <= radiusFilter).length
      : null;

  return (
    <section className="map-surface shelter-map" aria-label="안전 대피소 위치 지도">
      {kakaoLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f7f6', zIndex: 5, borderRadius: '8px' }}>
          <span style={{ color: '#0f766e', fontWeight: 700 }}>지도 로딩 중…</span>
        </div>
      )}

      <div
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '8px' }}
      />

      {/* 반경 필터 버튼 */}
      <div className="map-top-controls">
        <div className="radius-filter-row">
          <span className="radius-label">반경</span>
          {RADIUS_OPTIONS.map((km) => (
            <button
              key={km}
              type="button"
              className={`radius-button${radiusFilter === km ? ' active' : ''}`}
              onClick={() => setRadiusFilter(radiusFilter === km ? null : km)}
            >
              {RADIUS_LABEL[km]}
            </button>
          ))}
          {inRangeCount !== null && (
            <span className="radius-count">{inRangeCount}개</span>
          )}
        </div>
      </div>

      {(!kakaoMapKey || error) && (
        <div className="alert-empty-state" style={{ position: 'absolute', inset: '16px', zIndex: 2 }}>
          카카오 지도 키를 확인하세요.
        </div>
      )}

      {/* GPS 현재 위치 버튼 */}
      <button
        type="button"
        onClick={() => fetchCurrentLocation().catch(() => {})}
        disabled={isLocating}
        aria-label="현재 위치 갱신"
        style={{
          position: 'absolute', bottom: '60px', right: '14px', zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 12px', borderRadius: '8px',
          border: '1px solid #cdd8d5', background: '#ffffff', color: '#0f766e',
          fontWeight: 800, fontSize: '13px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(19,32,29,0.14)',
        }}
      >
        <LocateFixed size={15} />
        {isLocating ? '위치 조회 중…' : '현재 위치'}
      </button>

      <div className="map-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: '#0f766e' }} />운영 중</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#b45309' }} />대기</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#dc2626' }} />만원</span>
      </div>
    </section>
  );
}
