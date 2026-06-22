import React, { useEffect, useRef, useState } from 'react';
import { Viewer, Cartesian3, Math as CesiumMath, Ion, Terrain, createOsmBuildingsAsync, Color, CallbackProperty } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css'; 
import { ShieldAlert, Activity, Droplets } from 'lucide-react'; 
// 🌟 1. Recharts 모듈 추가 (팀원분이 설치해둔 라이브러리 활용!)
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

(window as any).CESIUM_BASE_URL = 'https://unpkg.com/cesium@1.131.0/Build/Cesium/';
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhYTg0ZWE3Yi1mYTk2LTRlNDUtODE4Mi1mZDM0MjBiYzU0NDAiLCJpZCI6NDQ1NDYyLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODE2NTc0ODl9.EDQLLfquxBL5Iy8RiVGLF0lSfbfA6twQytT1iY2ABew'; // 발급받으신 토큰은 유지해 주세요!

export const DigitalTwinPage = () => {
  const cesiumContainer = useRef<HTMLDivElement>(null);
  const [floodDepth, setFloodDepth] = useState<number>(0);
  const floodAltitudeRef = useRef(15); 

  // 🌟 2. 차트 데이터를 담을 상태 (최근 15초 분량의 데이터를 유지)
  const [chartData, setChartData] = useState(
    Array.from({ length: 15 }, () => ({ time: '', level: 0 }))
  );

  // 슬라이더 값이 변할 때 Ref 업데이트
  useEffect(() => {
    floodAltitudeRef.current = 15 + floodDepth; 
  }, [floodDepth]);

  // 🌟 3. 실시간 센서 데이터 에뮬레이터 (1초마다 그래프 업데이트)
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData((prev) => {
        const newData = [...prev.slice(1)]; // 가장 오래된 과거 데이터 1개 삭제
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        // 현재 슬라이더 수위를 기준으로 약간의 무작위 노이즈(출렁임)를 추가해 실제 물결처럼 연출
        const currentDepth = floodAltitudeRef.current - 15;
        const noise = currentDepth > 0 ? (Math.random() - 0.5) * 1.2 : 0; 
        const finalLevel = Math.max(0, currentDepth + noise);

        newData.push({ time: timeStr, level: Number(finalLevel.toFixed(1)) }); // 새로운 데이터 1개 꼬리에 추가
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval); // 컴포넌트 종료 시 타이머 해제
  }, []);

  // Cesium 3D 초기화 로직
  useEffect(() => {
    if (!cesiumContainer.current) return;
    let viewer: Viewer | null = null;

    const initCesium = async () => {
      try {
        viewer = new Viewer(cesiumContainer.current!, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          terrain: Terrain.fromWorldTerrain(),
        });

        try {
          const buildingsTileset = await createOsmBuildingsAsync();
          viewer.scene.primitives.add(buildingsTileset);
        } catch (e) {
          console.error("건물 로딩 에러:", e);
        }

        viewer.entities.add({
          name: "강남역 침수 구역",
          polygon: {
            hierarchy: Cartesian3.fromDegreesArray([
              127.0250, 37.4960,
              127.0300, 37.4960,
              127.0300, 37.5000,
              127.0250, 37.5000,
            ]),
            material: Color.CORNFLOWERBLUE.withAlpha(0.6),
            height: 15, 
            extrudedHeight: new CallbackProperty(() => floodAltitudeRef.current, false),
          }
        });

        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(127.0276, 37.4979, 800),
          orientation: {
            heading: CesiumMath.toRadians(0.0),
            pitch: CesiumMath.toRadians(-30.0),
          },
          duration: 3,
        });

      } catch (error) {
        console.error("Cesium 렌더링 에러:", error);
      }
    };

    initCesium();

    return () => {
      if (viewer) viewer.destroy();
    };
  }, []); 

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0f172a', color: '#f8fafc' }}>
      
      {/* 왼쪽: 3D 뷰어 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={cesiumContainer} style={{ width: '100%', height: '100%' }} />
        <div style={{ 
          position: 'absolute', top: 20, left: 20, zIndex: 10, 
          backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: '16px 20px', 
          borderRadius: 8, border: '1px solid #334155', backdropFilter: 'blur(4px)'
        }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 20 }}>
            <ShieldAlert color={floodDepth > 5 ? "#ef4444" : "#3b82f6"} size={24} />
            침수 위험 관제 상황실
          </h2>
          <p style={{ color: '#94a3b8', margin: '8px 0 0 0', fontSize: 14 }}>
            현재 침수 깊이: <strong style={{ color: floodDepth > 5 ? "#ef4444" : "#fff"}}>{floodDepth}m</strong>
          </p>
        </div>
      </div>

      {/* 오른쪽: 관리자 패널 */}
      <div style={{ 
        width: '450px', borderLeft: '1px solid #1e293b', 
        padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
        overflowY: 'auto'
      }}>
        
        {/* 시뮬레이션 컨트롤러 */}
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
            <Droplets color="#0ea5e9" size={20} />
            강수량 시뮬레이션 제어
          </h3>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
            슬라이더를 움직여 가상의 폭우 상황을 부여하세요.
          </p>
          <input 
            type="range" min="0" max="20" step="0.5" value={floodDepth}
            onChange={(e) => setFloodDepth(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer', accentColor: '#0ea5e9' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#64748b', fontSize: 12 }}>
            <span>정상 (0m)</span><span>위험 (10m)</span><span>재난 (20m)</span>
          </div>
        </div>

        {/* 🌟 4. Recharts 실시간 그래프 영역 */}
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', height: '320px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
            <Activity color="#38bdf8" size={20} />
            실시간 수위 센서 (강남구 01)
          </h3>
          
          <div style={{ flex: 1, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickMargin={10} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 25]} width={30} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                />
                {/* isAnimationActive={false} 로 설정해야 1초마다 버벅거리지 않고 자연스럽게 흘러갑니다 */}
                <Line type="monotone" dataKey="level" stroke="#38bdf8" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};