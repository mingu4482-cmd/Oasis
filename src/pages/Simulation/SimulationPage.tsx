import React, { useState, useEffect, useRef } from 'react';
import { SWMM_API_BASE_URL } from '../../shared/api/externalApi';

declare global {
    interface Window {
        vw: any;
        ws3d: any;
        Cesium: any;
    }
}

// 🌟 수정 1: 통짜 네모가 아니라, 도로 모양을 따라가는 여러 개의 폴리곤으로 분리!
const FLOOD_ZONES = [
    // 1. 세종대로 메인 도로 (세로)
    { id: 1, coords: [126.9772, 37.5740, 126.9782, 37.5740, 126.9782, 37.5700, 126.9772, 37.5700] },
    // 2. 종로 메인 도로 (가로 십자교차)
    { id: 2, coords: [126.9740, 37.5716, 126.9800, 37.5716, 126.9800, 37.5708, 126.9740, 37.5708] },
    // 3. 종로구청 옆 골목길
    { id: 3, coords: [126.9782, 37.5732, 126.9805, 37.5732, 126.9805, 37.5727, 126.9782, 37.5727] }
];

// 광화문 인근 실제 지면 고도 (건물을 안 가리도록 바닥에 깔리게 세팅)
const BASE_ALTITUDE = 38; 
const SWMM_API_ERROR_MESSAGE = '시뮬레이션 서버가 실행되지 않아 결과를 불러올 수 없습니다. 외부 SWMM API 서버 실행 후 다시 시도해주세요.';

export const SimulationPage = () => {
    const [rainfall, setRainfall] = useState<number>(150);
    const [isSimulating, setIsSimulating] = useState<boolean>(false);
    const [simulationError, setSimulationError] = useState<string>('');
    
    const mapRef = useRef<any>(null);
    const simIntervalRef = useRef<any>(null);
    const isMapInitialized = useRef<boolean>(false);
    const waterLevelRef = useRef<number>(0);

    useEffect(() => {
        if (isMapInitialized.current) return;
        if (!window.vw) return;

        window.vw.ws3dInitCallBack = () => {
            initScene();
        };

        const mapOptions = {
            mapId: 'vmap-sim',
            initPosition: new window.vw.CameraPosition(
                new window.vw.CoordZ(126.9775, 37.5715, 800),
                new window.vw.Direction(15, -45, 0),
            ),
            logo: false,
            navigation: true,
        };

        mapRef.current = new window.vw.Map();
        mapRef.current.setOption(mapOptions);
        mapRef.current.start();

        isMapInitialized.current = true;

        return () => {
            if (simIntervalRef.current) clearInterval(simIntervalRef.current);
        };
    }, []);

    const initScene = () => {
        const viewer = window.ws3d?.viewer;
        const Cesium = window.Cesium;
        if (!viewer) return;

        viewer.entities.removeAll();
        waterLevelRef.current = 0;

        FLOOD_ZONES.forEach((zone) => {
            viewer.entities.add({
                id: `flood-zone-${zone.id}`,
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(zone.coords)),
                    height: BASE_ALTITUDE,
                    
                    // 🌟 수정 2: 물기둥이 하늘로 안 솟구치게 두께를 1m로 아주 얇게 고정!
                    extrudedHeight: BASE_ALTITUDE + 1, 

                    // 🌟 수정 3: 수위가 60을 넘으면 뉴스 화면처럼 '완전 빨간색'으로 경고 표시
                    material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => {
                        const level = waterLevelRef.current;
                        if (level <= 0) return Cesium.Color.WHITE.withAlpha(0.01); 
                        if (level >= 60) return Cesium.Color.RED.withAlpha(0.85); // 침수 위험! (빨간색)
                        return Cesium.Color.DODGERBLUE.withAlpha(0.6); // 물이 고이는 중 (파란색)
                    }, false)),
                }
            });
        });
    };

    const handleRunSimulation = async () => {
        const viewer = window.ws3d?.viewer;

        if (isSimulating) {
            setIsSimulating(false);
            clearInterval(simIntervalRef.current);
            waterLevelRef.current = 0;
            if (viewer) viewer.scene.requestRender();
            return;
        }

        setIsSimulating(true);
        waterLevelRef.current = 0;
        setSimulationError('');

        try {
            const response = await fetch(`${SWMM_API_BASE_URL}/api/test/swmm?rainfall=${rainfall}`);
            if (!response.ok) throw new Error('SWMM API 서버 연결 안 됨');
            const result = await response.json();

            if (result.status === 'success') {
                const targetWaterLevel = result.data[0].waterLevel; 

                simIntervalRef.current = setInterval(() => {
                    waterLevelRef.current += 2; // 차오르는 속도
                    
                    if (viewer) viewer.scene.requestRender();

                    if (waterLevelRef.current >= targetWaterLevel) {
                        waterLevelRef.current = targetWaterLevel;
                        clearInterval(simIntervalRef.current);
                    }
                }, 50);
            } else {
                throw new Error('SWMM API 응답 형식 오류');
            }
        } catch (error) {
            console.error("🚨 시뮬레이션 에러:", error);
            setIsSimulating(false);
            setSimulationError(SWMM_API_ERROR_MESSAGE);
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <div
                style={{
                    position: 'absolute', top: 20, left: 20, zIndex: 10,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', color: 'white',
                    padding: '25px', borderRadius: '12px', minWidth: '340px', border: '1px solid #334155'
                }}
            >
                <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#ef4444' }}>
                    🚨 스마트 하수도 침수 예측
                </h2>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#cbd5e1' }}>
                    예상 강우량에 따른 도로 침수 위험도를 시각화합니다.
                </p>
                {simulationError ? (
                    <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(127, 29, 29, 0.55)', color: '#fecaca', fontSize: '13px', lineHeight: 1.5 }}>
                        {simulationError}
                    </div>
                ) : null}
                
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '8px' }}>
                    <label style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>예상 폭우량 (mm/h)</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input 
                            type="range" min="0" max="300" step="10"
                            value={rainfall} onChange={(e) => setRainfall(Number(e.target.value))}
                            disabled={isSimulating} style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{rainfall} mm</span>
                    </div>
                </div>

                <button 
                    onClick={handleRunSimulation}
                    style={{
                        width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
                        backgroundColor: isSimulating ? '#475569' : '#b91c1c',
                        color: 'white', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                    }}
                >
                    {isSimulating ? '🛑 시뮬레이션 초기화' : '⚠️ 침수 시뮬레이션 가동'}
                </button>
            </div>
            <div id="vmap-sim" style={{ width: '100%', height: '100%' }} />
        </div>
    );
};
