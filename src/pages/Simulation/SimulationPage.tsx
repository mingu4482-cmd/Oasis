import { useState, useEffect, useRef } from 'react';
import { Play, Square, CloudRain, BellRing } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { RegionRiskMapPanel } from '../../features/kakao-map/RegionRiskMapPanel';

const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  '강남구': { lat: 37.5172, lng: 127.0473 },
  '서초구': { lat: 37.4837, lng: 127.0324 },
  '동작구': { lat: 37.5124, lng: 126.9393 },
};

function calcDistKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function SimulationPage() {
  const [targetRegion, setTargetRegion] = useState('강남구');
  const [rainfall, setRainfall] = useState(50);
  const [isSimulating, setIsSimulating] = useState(false);
  const [waterLevel, setWaterLevel] = useState(25);
  
  // 💡 최근 울린 알람 메시지들을 배열로 저장 (화면에 여러 개 띄우기 위해)
  const [recentAlarms, setRecentAlarms] = useState<string[]>([]);
  
  // 💡 이미 알람이 울린 맨홀 ID를 기억하는 공간 (중복 알람 방지)
  const alarmedManholesRef = useRef<Set<number>>(new Set());

  const queryClient = useQueryClient();

  // 🔌 개별 맨홀 알람 호출 함수
  const triggerExternalAlarm = (manholeName: string, level: number) => {
    const alarmMessage = `[침수 경고] ${manholeName} 수위 ${level.toFixed(1)}% 돌파!`;
    console.log(`🚨 외부 알람 시스템 호출: ${alarmMessage}`);
    
    // 화면에 띄울 알람 목록 업데이트 (최대 3개까지만 표시)
    setRecentAlarms((prev) => [alarmMessage, ...prev].slice(0, 3));
  };

  const handleReset = () => {
    setIsSimulating(false);
    setWaterLevel(25);
    setRecentAlarms([]);
    alarmedManholesRef.current.clear(); // 기억해둔 알람 기록 초기화
    queryClient.invalidateQueries({ queryKey: ["external-manholes"] });
  };

  // 타겟 구역이 바뀌면 알람 기록도 초기화
  useEffect(() => {
    setRecentAlarms([]);
    alarmedManholesRef.current.clear();
  }, [targetRegion]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSimulating) {
      interval = setInterval(() => {
        queryClient.setQueryData(["external-manholes"], (oldData: any[]) => {
          if (!oldData || oldData.length === 0) return oldData;
          
          let currentMaxLevel = 0;
          const center = REGION_CENTERS[targetRegion] || REGION_CENTERS['강남구'];

          const newData = oldData.map((manhole) => {
            const dist = calcDistKm(center.lat, center.lng, manhole.latitude, manhole.longitude);

            if (dist <= 5) {
              const increase = (rainfall / 40) + (Math.random() * 1.5);
              const nextLevel = Math.min(manhole.waterLevel + increase, 100);
              
              // 🚨 개별 맨홀이 90%를 넘었고, 아직 알람이 안 울린 맨홀이라면?
              if (nextLevel >= 90 && !alarmedManholesRef.current.has(manhole.locationId)) {
                alarmedManholesRef.current.add(manhole.locationId); // 알람 울렸다고 도장 찍기
                triggerExternalAlarm(manhole.name, nextLevel); // 해당 맨홀 이름으로 알람 발사!
              }

              if (nextLevel > currentMaxLevel) currentMaxLevel = nextLevel;
              return { ...manhole, waterLevel: nextLevel };
            }
            return manhole;
          });

          const formattedMax = Number(currentMaxLevel.toFixed(1));
          if (formattedMax > 0) setWaterLevel(formattedMax);

          // 💡 100%가 되어도 멈추는 코드를 삭제함! 비는 계속 내린다!
          return newData;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isSimulating, rainfall, targetRegion, queryClient]);

  return (
    <div className="simulation-layout" style={{ display: 'flex', gap: '20px', padding: '20px', height: '100vh', background: '#f8fafc' }}>
      
      <div className="map-area" style={{ flex: 2, position: 'relative', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
         <RegionRiskMapPanel 
            height="100%" 
            layerVisibility={{ regionalRisk: false, waterLevel: true, rainfall: false, safeRoute: false }} 
         />

         {/* 🚨 실시간 다중 알람 토스트 UI */}
         {recentAlarms.length > 0 && (
           <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>
             {recentAlarms.map((alarm, idx) => (
               <div key={idx} style={{ background: '#dc2626', color: 'white', padding: '12px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', animation: 'fadeIn 0.3s', fontWeight: 'bold' }}>
                 <BellRing size={20} /> {alarm}
               </div>
             ))}
           </div>
         )}
      </div>

      <aside className="control-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '320px' }}>
        <div className="panel" style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 20px 0', fontSize: '1.25rem' }}>
            <CloudRain size={24} color="#2563eb" /> 시나리오 설정
          </h2>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>타겟 구역</label>
            <select value={targetRegion} onChange={(e) => setTargetRegion(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}>
              <option value="강남구">강남구</option>
              <option value="서초구">서초구</option>
              <option value="동작구">동작구</option>
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>시간당 강수량 설정</label>
            <input 
              type="range" 
              min="10" max="200" 
              value={rainfall} 
              onChange={(e) => setRainfall(Number(e.target.value))} 
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#2563eb', marginTop: '8px', fontSize: '1.1rem' }}>{rainfall} mm/h</div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => setIsSimulating(!isSimulating)}
              style={{ flex: 2, padding: '14px', background: isSimulating ? '#eab308' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1rem' }}
            >
              {isSimulating ? <><Square size={20} style={{ marginRight: '8px' }}/> 일시정지</> : <><Play size={20} style={{ marginRight: '8px' }}/> 시뮬레이션 시작</>}
            </button>
            <button 
              onClick={handleReset} 
              style={{ flex: 1, padding: '14px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
            >
              초기화
            </button>
          </div>
        </div>

        <div className="panel" style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#334155' }}>해당 구역 최대 수위</h3>
          <div style={{ width: '100%', background: '#f1f5f9', height: '36px', borderRadius: '18px', overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0' }}>
            <div style={{ 
              width: `${waterLevel}%`, 
              height: '100%', 
              background: waterLevel >= 80 ? '#dc2626' : waterLevel >= 60 ? '#f97316' : '#2563eb',
              transition: 'width 1s linear, background 0.5s ease'
            }} />
            <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold', color: waterLevel >= 55 ? 'white' : '#0f172a' }}>
              {waterLevel}%
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}