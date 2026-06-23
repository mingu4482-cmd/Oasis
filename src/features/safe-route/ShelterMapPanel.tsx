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

export function ShelterMapPanel() {
  const kakaoMapKey = import.meta.env.VITE_KAKAO_MAP_KEY ?? '';
  const [kakaoLoading, error] = useKakaoLoader({
    appkey: kakaoMapKey,
    libraries: ['services', 'clusterer'],
  });
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const currentOverlayRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const shelters = useSafeRouteStore((s) => s.shelters);
  const selectedId = useSafeRouteStore((s) => s.selectedShelterId);
  const activeRoute = useSafeRouteStore((s) => s.activeRoute);
  const currentLocation = useSafeRouteStore((s) => s.currentLocation);
  const isLocating = useSafeRouteStore((s) => s.isLocating);
  const selectShelter = useSafeRouteStore((s) => s.selectShelter);
  const fetchCurrentLocation = useSafeRouteStore((s) => s.fetchCurrentLocation);

  // 지도 초기화 — SDK 로드 완료 후
  useEffect(() => {
    if (kakaoLoading || error || !kakaoMapKey || !window.kakao?.maps?.Map || !mapRef.current) return;

    const map = new window.kakao.maps.Map(mapRef.current, {
      center: new window.kakao.maps.LatLng(37.5, 127.0),
      level: 7,
    });
    mapInstanceRef.current = map;
    setMapReady(true);

    fetchCurrentLocation().catch(() => {});
  }, [error, fetchCurrentLocation, kakaoLoading, kakaoMapKey]);

  // 현재 위치 마커
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !currentLocation) return;

    // 창 크기 변경 시 지도 크기 재조정
    const onResize = () => mapInstanceRef.current?.relayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [currentLocation, mapReady]);

  // 현재 위치 오버레이
  useEffect(() => {
    if (!mapReady || !currentLocation) return;
    const { kakao } = window as any;
    if (currentOverlayRef.current) currentOverlayRef.current.setMap(null);
    currentOverlayRef.current = new kakao.maps.CustomOverlay({
      map: mapInstanceRef.current,
      position: new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng),
      content: `<div style="padding:6px 10px;border-radius:8px;background:#0d2d35;color:#fff;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 4px 14px rgba(13,45,53,0.28);">📍 현재 위치</div>`,
      yAnchor: 1.4,
    });
    mapInstanceRef.current.panTo(new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng));
  }, [mapReady, currentLocation]);

  // 대피소 마커
  useEffect(() => {
    if (!mapReady) return;
    const { kakao } = window as any;
    markersRef.current.forEach((o) => o.setMap(null));
    markersRef.current = [];
    shelters.forEach((shelter) => {
      const color = STATUS_COLOR[shelter.status] ?? '#6b7280';
      const isSelected = shelter.id === selectedId;
      const size = isSelected ? '18px' : '14px';
      const content = document.createElement('div');
      content.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;';
      content.innerHTML = `
        <div style="width:${size};height:${size};border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 ${isSelected ? '10px' : '8px'} ${color}33;"></div>
        <div style="padding:3px 8px;border-radius:6px;background:${isSelected ? color : '#fff'};color:${isSelected ? '#fff' : '#162522'};font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(19,32,29,0.14);">${shelter.name}</div>
      `;
      content.addEventListener('click', () => selectShelter(shelter.id));
      const overlay = new kakao.maps.CustomOverlay({
        map: mapInstanceRef.current,
        position: new kakao.maps.LatLng(shelter.lat, shelter.lng),
        content,
        yAnchor: 1,
      });
      markersRef.current.push(overlay);
    });
  }, [mapReady, shelters, selectedId]);

  // 선택 대피소로 이동
  useEffect(() => {
    if (!mapReady) return;
    const selected = shelters.find((s) => s.id === selectedId);
    if (!selected) return;
    (window as any).kakao.maps.Map.prototype && mapInstanceRef.current.panTo(
      new (window as any).kakao.maps.LatLng(selected.lat, selected.lng)
    );
  }, [mapReady, selectedId]);

  // 경로선
  useEffect(() => {
    if (!mapReady) return;
    const { kakao } = window as any;
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
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
    mapInstanceRef.current.setBounds(bounds);
  }, [mapReady, activeRoute]);

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
      {!kakaoMapKey || error ? (
        <div className="alert-empty-state" style={{ position: 'absolute', inset: '16px', zIndex: 2 }}>
          카카오 지도 키를 확인하세요.
        </div>
      ) : kakaoLoading ? (
        <div className="alert-empty-state" style={{ position: 'absolute', inset: '16px', zIndex: 2 }}>
          지도를 불러오는 중입니다.
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => fetchCurrentLocation()}
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
