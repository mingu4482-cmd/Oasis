import React, { useEffect, useState } from 'react';
import { Map, CustomOverlayMap } from 'react-kakao-maps-sdk';
import { EXTERNAL_SENSOR_API_BASE_URL } from '../../shared/api/externalApi';

interface Manhole {
    locationId: number;
    name: string;
    latitude: number;
    longitude: number;
    waterLevel: number;
}

const SENSOR_API_ERROR_MESSAGE = '외부 하수관로 센서 API에 연결할 수 없습니다. 현재는 서울시 공공 API 기반 위험도만 표시됩니다.';

export const DigitalTwinPage = () => {
    const [manholes, setManholes] = useState<Manhole[]>([]);
    const [sensorCount, setSensorCount] = useState(0);
    const [sensorApiError, setSensorApiError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${EXTERNAL_SENSOR_API_BASE_URL}/api/manholes`);
                if (!response.ok) throw new Error('API 서버 연결 안 됨');
                const data: Manhole[] = await response.json();
                
                const validData = data.filter(m => m.latitude !== 0 && m.latitude !== null);
                setManholes(validData);
                setSensorCount(validData.length);
                setSensorApiError('');
            } catch (e) {
                console.error("🚨 백엔드 연결 실패!", e);
                setManholes([]);
                setSensorCount(0);
                setSensorApiError(SENSOR_API_ERROR_MESSAGE);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, []);

    // 🌟 멘토님 가이드: 수위별 마커 색상 지정
    const getMarkerColor = (waterLevel: number) => {
        if (waterLevel >= 90) return '#ef4444'; // 90 이상: 빨강 (심각)
        if (waterLevel >= 60) return '#f59e0b'; // 60 ~ 90: 노랑/주황 (경계)
        if (waterLevel >= 30) return '#10b981'; // 30 ~ 60: 초록 (주의)
        return '#4ade80';                       // 30 미만: 연한 초록 (정상)
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            
            {/* 상단 관제 바 */}
            <div style={{
                position: 'absolute', top: 20, left: 20, zIndex: 10,
                backgroundColor: 'rgba(15, 23, 42, 0.9)', color: 'white',
                padding: '20px', borderRadius: '12px', border: '1px solid #334155'
            }}>
                <h2>🌐 하수도 디지털 트윈 상세 관제</h2>
                <p>모니터링 중인 맨홀: <b>{sensorCount}</b> 개</p>
                {sensorApiError ? (
                    <p style={{ color: '#fca5a5', maxWidth: '360px', lineHeight: 1.5 }}>{sensorApiError}</p>
                ) : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px', fontSize: '13px' }}>
                    <span style={{ color: '#ef4444' }}>● 심각 (90cm 이상)</span>
                    <span style={{ color: '#f59e0b' }}>● 경계 (60cm ~ 90cm)</span>
                    <span style={{ color: '#10b981' }}>● 주의 (30cm ~ 60cm)</span>
                    <span style={{ color: '#4ade80' }}>● 정상 (30cm 미만)</span>
                </div>
            </div>

            <Map center={{ lat: 37.5665, lng: 126.9780 }} style={{ width: "100%", height: "100%" }} level={7}>
                {/* 🟢🟡🔴 개별 맨홀 마커들 표시 */}
                {manholes.map((m) => (
                    <CustomOverlayMap key={`dt-${m.locationId}`} position={{ lat: m.latitude, lng: m.longitude }}>
                        <div style={{
                            width: '12px', height: '12px',
                            backgroundColor: getMarkerColor(m.waterLevel),
                            borderRadius: '50%',
                            border: '1px solid white',
                            boxShadow: '0 0 6px rgba(0,0,0,0.6)',
                            cursor: 'pointer'
                        }} 
                        title={`${m.name}\n현재 수위: ${m.waterLevel}cm`}
                        />
                    </CustomOverlayMap>
                ))}
            </Map>
        </div>
    );
};
