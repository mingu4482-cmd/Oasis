import React, { useEffect, useRef, useState } from 'react';
import { MapPinned } from 'lucide-react';
import styles from './KakaoMapPanel.module.css';

declare global {
  interface Window {
    kakao?: any;
  }
}

interface Props {
  apiKey: string;
  location: string;
}

const DEFAULT_LAT = 37.4979;
const DEFAULT_LNG = 127.0276;

export default function KakaoMapPanel({ apiKey, location }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('카카오 JavaScript Key를 입력하면 지도가 표시됩니다.');

  useEffect(() => {
    if (!apiKey.trim()) {
      setStatus('카카오 JavaScript Key를 입력하면 지도가 표시됩니다.');
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
        infoContent.textContent = location || '강남역 1번 출구 인근';
        infoContent.style.padding = '7px 10px';
        infoContent.style.fontSize = '12px';
        infoContent.style.color = '#111';
        infoContent.style.whiteSpace = 'nowrap';

        const infoWindow = new window.kakao.maps.InfoWindow({
          content: infoContent,
        });

        infoWindow.open(map, marker);
        setStatus('지도 연결 완료');
      });
    };

    const previousScript = document.getElementById(scriptId);
    if (previousScript) {
      previousScript.remove();
      delete window.kakao;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(apiKey.trim())}&autoload=false`;
    script.async = true;
    script.onload = drawMap;
    script.onerror = () => setStatus('지도 로드 실패: JavaScript Key와 도메인 등록을 확인하세요.');
    document.head.appendChild(script);

    return () => {
      canceled = true;
    };
  }, [apiKey, location]);

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div>
          <p className={styles.sectionLabel}>카카오맵 미리보기</p>
          <p className={styles.status}>{status}</p>
        </div>
        <div className={styles.badge}>
          <MapPinned size={14} />
          {location || '위치 미입력'}
        </div>
      </div>

      <div className={styles.mapBox}>
        {!apiKey.trim() && (
          <div className={styles.empty}>
            카카오 Developers에서 발급한 JavaScript Key를 입력해 주세요.
          </div>
        )}
        <div ref={mapRef} className={styles.map} />
      </div>
    </section>
  );
}
