import React, { useEffect, useState } from 'react';
import { Map, Circle } from 'react-kakao-maps-sdk';

interface Manhole {
    locationId: number;
    name: string;
    latitude: number;
    longitude: number;
    waterLevel: number;
}

export const MapViewPage = () => {
    const [manholes, setManholes] = useState<Manhole[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('http://localhost:8080/api/manholes');
                if (!response.ok) throw new Error('API 서버 연결 안 됨');
                const data: Manhole[] = await response.json();
                
                const validData = data.filter(m => m.latitude !== 0 && m.latitude !== null);
                setManholes(validData);
            } catch (e) {
                console.error("🚨 백엔드 연결 실패!", e);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, []);

    // 수위별 히트맵 구역 색상 결정
    const getHeatmapColor = (waterLevel: number) => {
        if (waterLevel >= 90) return '#ef4444'; // 심각 (빨강)
        if (waterLevel >= 60) return '#f59e0b'; // 경계 (노랑/주황)
        return '#10b981';                       // 주의 (초록)
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            
            {/* 대시보드 연동용 심플 범례 */}
            <div style={{
                position: 'absolute', top: 20, left: 20, zIndex: 10,
                backgroundColor: 'rgba(15, 23, 42, 0.9)', color: 'white',
                padding: '20px', borderRadius: '12px', border: '1px solid #334155'
            }}>
                <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>⚠️ 실시간 종합 침수 위험 구역</h2>
                <div style={{ display: 'flex', gap: '15px', fontSize: '13px' }}>
                    <span style={{ color: '#ef4444' }}>■ 심각 (90cm~)</span>
                    <span style={{ color: '#f59e0b' }}>■ 경계 (60cm~)</span>
                    <span style={{ color: '#10b981' }}>■ 주의 (30cm~)</span>
                </div>
            </div>

            <Map center={{ lat: 37.5665, lng: 126.9780 }} style={{ width: "100%", height: "100%" }} level={8}>
                {/* 🔴🟡🟢 맨홀 점은 없고, 오직 수위 30cm 이상인 위험 영역(원)들만 렌더링 */}
                {manholes
                    .filter((m) => m.waterLevel >= 30) // 30cm 이상인 곳만 히트맵 생성
                    .map((m) => {
                        const zoneColor = getHeatmapColor(m.waterLevel);
                        return (
                            <Circle
                                key={`zone-${m.locationId}`}
                                center={{ lat: m.latitude, lng: m.longitude }}
                                radius={400} // 구역 반경 400m
                                strokeWeight={1}
                                strokeColor={zoneColor}
                                strokeOpacity={0.2}
                                fillColor={zoneColor}
                                fillOpacity={0.15} // 겹칠수록 진해지는 효과
                            />
                        );
                    })}
            </Map>
        </div>
    );
};

export default MapViewPage;