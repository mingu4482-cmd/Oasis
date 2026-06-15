import React, { useEffect, useRef, useState } from 'react';
import { MapPinned } from 'lucide-react';
import styles from './KakaoMapPanel.module.css';

declare global {
  interface Window {
    kakao?: any;
  }
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Props {
  location: string;
  selectedCoords: Coordinates | null;
  onSelectLocation: (coords: Coordinates, label: string) => void;
}

const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.9780;
const KAKAO_MAP_KEY = process.env.REACT_APP_KAKAO_MAP_KEY || '';

function formatCoords(coords: Coordinates | null) {
  if (!coords) return '위치를 선택해 주세요';
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}

export default function KakaoMapPanel({ location, selectedCoords, onSelectLocation }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelectLocation);
  const [status, setStatus] = useState('지도를 준비하고 있습니다.');

  useEffect(() => {
    onSelectRef.current = onSelectLocation;
  }, [onSelectLocation]);

  useEffect(() => {
    if (!KAKAO_MAP_KEY.trim()) {
      setStatus('REACT_APP_KAKAO_MAP_KEY 환경변수가 없습니다.');
      return;
    }

    let canceled = false;
    const scriptId = 'kakao-map-sdk';

    const drawMap = () => {
      if (canceled || !mapRef.current || !window.kakao?.maps) return;

      window.kakao.maps.load(() => {
        if (canceled || !mapRef.current) return;

        const center = new window.kakao.maps.LatLng(DEFAULT_LAT, DEFAULT_LNG);
        const map = new window.kakao.maps.Map(mapRef.current, {
          center,
          level: 4,
        });

        const marker = new window.kakao.maps.Marker({
          position: center,
          map,
        });

        const infoContent = document.createElement('div');
        infoContent.textContent = location || '서울 시청 인근';
        infoContent.style.padding = '7px 10px';
        infoContent.style.fontSize = '12px';
        infoContent.style.color = '#111';
        infoContent.style.whiteSpace = 'nowrap';

        const infoWindow = new window.kakao.maps.InfoWindow({
          content: infoContent,
        });

        infoWindow.open(map, marker);

        window.kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
          const latlng = mouseEvent.latLng;
          const coords = {
            latitude: latlng.getLat(),
            longitude: latlng.getLng(),
          };
          const label = `선택 위치 (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`;

          marker.setPosition(latlng);
          infoContent.textContent = label;
          infoWindow.open(map, marker);
          onSelectRef.current(coords, label);
          setStatus('좌표를 가져왔습니다. 위험도 조회를 실행해 주세요.');
        });

        setStatus('지도를 클릭해 위치를 선택하세요.');
      });
    };

    const existingScript = document.getElementById(scriptId);
    if (existingScript && window.kakao?.maps) {
      drawMap();
      return () => {
        canceled = true;
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_MAP_KEY.trim())}&autoload=false`;
    script.async = true;
    script.onload = drawMap;
    script.onerror = () => setStatus('지도 로드 실패: Kakao JavaScript 키와 Web 플랫폼 도메인을 확인하세요.');
    document.head.appendChild(script);

    return () => {
      canceled = true;
    };
    // Initialize the Kakao map once; marker updates happen inside the click listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div>
          <p className={styles.sectionLabel}>KakaoMap 위치 선택</p>
          <p className={styles.status}>{status}</p>
        </div>
        <div className={styles.badge}>
          <MapPinned size={14} />
          {formatCoords(selectedCoords)}
        </div>
      </div>

      <div className={styles.mapBox}>
        {!KAKAO_MAP_KEY.trim() && (
          <div className={styles.empty}>
            .env 파일에 REACT_APP_KAKAO_MAP_KEY를 설정한 뒤 개발 서버를 다시 실행해 주세요.
          </div>
        )}
        <div ref={mapRef} className={styles.map} />
      </div>
    </section>
  );
}
