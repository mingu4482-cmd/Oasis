import React, { useState } from 'react';
// 🌟 1. useKakaoLoader 추가
import { Map, MapMarker, Circle, useKakaoLoader } from 'react-kakao-maps-sdk';
import { Navigation, Bell, ShieldAlert, RefreshCw } from 'lucide-react';

const MOCK_SENSORS = [
    { id: 1, name: '강남역 11번 출구', lat: 37.4979, lng: 127.0276, level: 85, status: 'danger' },
    { id: 2, name: '역삼역 3번 출구', lat: 37.5006, lng: 127.0364, level: 20, status: 'safe' },
    { id: 3, name: '양재역 사거리', lat: 37.485, lng: 127.032, level: 15, status: 'safe' },
];

export const MapViewPage = () => {
    const [center, setCenter] = useState({ lat: 37.4979, lng: 127.0276 });
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 🌟 2. React 안에서 카카오맵을 안전하게 불러오는 마법의 코드!
    const [loading, error] = useKakaoLoader({
        appkey: import.meta.env.VITE_KAKAO_MAP_KEY as string,
        libraries: ['services', 'clusterer'],
    });

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setIsRefreshing(false);
            alert('실시간 하수관로 수위 데이터가 갱신되었습니다.');
        }, 1000);
    };

    // 🌟 3. 로딩 중이거나 에러가 났을 때 보여줄 화면
    if (loading)
        return (
            <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
                지도 불러오는 중... ⏳
            </div>
        );
    if (error)
        return (
            <div
                style={{
                    display: 'flex',
                    height: '100vh',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'red',
                }}
            >
                지도 로딩 에러! (F12 콘솔창을 확인해주세요)
            </div>
        );

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#f1f5f9',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(to bottom, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)',
                }}
            >
                <div
                    style={{
                        backgroundColor: 'white',
                        padding: '10px 16px',
                        borderRadius: '24px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <Navigation size={18} color="#3b82f6" />
                    <span style={{ fontWeight: 'bold', color: '#1e293b' }}>내 주변 침수 모니터링</span>
                </div>
                <button
                    style={{
                        backgroundColor: 'white',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '50%',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                    }}
                >
                    <Bell size={20} color="#64748b" />
                </button>
            </div>

            {/* 카카오맵 렌더링 */}
            <Map center={center} style={{ width: '100%', height: '100%' }} level={4}>
                {MOCK_SENSORS.map((sensor) => (
                    <React.Fragment key={sensor.id}>
                        <MapMarker
                            position={{ lat: sensor.lat, lng: sensor.lng }}
                            image={{
                                src:
                                    sensor.status === 'danger'
                                        ? 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png'
                                        : 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
                                size: { width: 24, height: 35 },
                            }}
                            title={sensor.name}
                        />
                        {sensor.status === 'danger' && (
                            <Circle
                                center={{ lat: sensor.lat, lng: sensor.lng }}
                                radius={300}
                                strokeWeight={2}
                                strokeColor={'#ef4444'}
                                strokeOpacity={0.8}
                                fillColor={'#ef4444'}
                                fillOpacity={0.3}
                            />
                        )}
                    </React.Fragment>
                ))}
            </Map>

            <div
                style={{
                    position: 'absolute',
                    bottom: 30,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    width: '90%',
                    maxWidth: '400px',
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    padding: '24px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ backgroundColor: '#fee2e2', padding: '12px', borderRadius: '50%' }}>
                        <ShieldAlert size={28} color="#ef4444" />
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#0f172a' }}>
                            반경 1km 내 침수 주의
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                            강남역 11번 출구 하수관로 수위 <strong>85cm</strong> (상승 중)
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleRefresh}
                    style={{
                        width: '100%',
                        padding: '16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: isRefreshing ? 0.7 : 1,
                    }}
                >
                    <RefreshCw size={18} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                    {isRefreshing ? '데이터 갱신 중...' : '실시간 수위 데이터 갱신'}
                </button>
            </div>
        </div>
    );
};
