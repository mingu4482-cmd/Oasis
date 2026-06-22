import { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { useSafeRouteStore } from './safeRouteStore';

declare global {
  interface Window {
    kakao: any;
    __kakaoReady: boolean;
  }
}

const statusDotColor: Record<string, string> = {
  '운영 중': '#0f766e',
  '대기': '#b45309',
  '만원': '#dc2626',
};

function waitForKakao(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (window.__kakaoReady && window.kakao?.maps?.Map) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

export function ShelterMapPanel() {
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

  // 지도 초기화
  useEffect(() => {
    waitForKakao().then(() => {
      if (!mapRef.current) return;

      const map = new window.kakao.maps.Map(mapRef.current, {
        center: new window.kakao.maps.LatLng(37.5, 127.0),
        level: 7,
      });
      mapInstanceRef.current = map;
      setMapReady(true);

      fetchCurrentLocation().catch(() => {});
    });
  }, []);

  // 현재 위치 마커
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !currentLocation) return;

    if (currentOverlayRef.current) {
      currentOverlayRef.current.setMap(null);
    }

    const overlay = new window.kakao.maps.CustomOverlay({
      map: mapInstanceRef.current,
      position: new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng),
      content: `<div style="padding:6px 10px;border-radius:8px;background:#0d2d35;color:#fff;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 4px 14px rgba(13,45,53,0.28);">📍 현재 위치</div>`,
      yAnchor: 1.4,
    });
    currentOverlayRef.current = overlay;

    mapInstanceRef.current.panTo(new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng));
  }, [mapReady, currentLocation]);

  // 대피소 마커
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    markersRef.current.forEach((o) => o.setMap(null));
    markersRef.current = [];

    shelters.forEach((shelter) => {
      const color = statusDotColor[shelter.status];
      const isSelected = shelter.id === selectedId;
      const size = isSelected ? '18px' : '14px';
      const shadow = isSelected ? '10px' : '8px';

      const content = document.createElement('div');
      content.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;';
      content.innerHTML = `
        <div style="width:${size};height:${size};border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 ${shadow} ${color}33;"></div>
        <div style="padding:3px 8px;border-radius:6px;background:${isSelected ? color : '#fff'};color:${isSelected ? '#fff' : '#162522'};font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(19,32,29,0.14);">${shelter.name}</div>
      `;
      content.addEventListener('click', () => selectShelter(shelter.id));

      const overlay = new window.kakao.maps.CustomOverlay({
        map: mapInstanceRef.current,
        position: new window.kakao.maps.LatLng(shelter.lat, shelter.lng),
        content,
        yAnchor: 1,
      });

      markersRef.current.push(overlay);
    });
  }, [mapReady, shelters, selectedId]);

  // 선택 대피소로 지도 이동
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const selected = shelters.find((s) => s.id === selectedId);
    if (!selected) return;
    mapInstanceRef.current.panTo(new window.kakao.maps.LatLng(selected.lat, selected.lng));
  }, [mapReady, selectedId]);

  // 실제 경로선 그리기 (API에서 받은 path 사용)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    // 기존 경로선 제거
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!activeRoute || activeRoute.path.length === 0) return;

    const { kakao } = window;
    const linePath = activeRoute.path.map((p) => new kakao.maps.LatLng(p.lat, p.lng));

    const polyline = new kakao.maps.Polyline({
      map: mapInstanceRef.current,
      path: linePath,
      strokeWeight: 5,
      strokeColor: activeRoute.mode === 'CAR' ? '#0f766e' : '#2563eb',
      strokeOpacity: 0.85,
      strokeStyle: 'solid',
    });
    polylineRef.current = polyline;

    // 경로 전체가 보이게 지도 범위 조정
    const bounds = new kakao.maps.LatLngBounds();
    linePath.forEach((p) => bounds.extend(p));
    mapInstanceRef.current.setBounds(bounds);
  }, [mapReady, activeRoute]);

  return (
    <section className="map-surface shelter-map" aria-label="안전 대피소 위치 지도">
      <div
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '8px' }}
      />

      <button
        type="button"
        onClick={() => fetchCurrentLocation()}
        disabled={isLocating}
        aria-label="현재 위치 갱신"
        style={{
          position: 'absolute',
          bottom: '60px',
          right: '14px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #cdd8d5',
          background: '#ffffff',
          color: '#0f766e',
          fontWeight: 800,
          fontSize: '13px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(19,32,29,0.14)',
        }}
      >
        <LocateFixed size={15} />
        {isLocating ? '위치 조회 중…' : '현재 위치'}
      </button>

      <div className="map-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#0f766e' }} />운영 중
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#b45309' }} />대기
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: '#dc2626' }} />만원
        </span>
      </div>
    </section>
  );
}