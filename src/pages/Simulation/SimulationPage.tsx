import { useState, useEffect, useRef } from 'react';
import { Play, Square, CloudRain, BellRing, ChevronDown } from 'lucide-react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RegionRiskMapPanel,
  fetchExternalManholes,
  findClosestDistrictName,
  type Manhole,
} from '../../features/kakao-map/RegionRiskMapPanel';
import { fetchRiskPrediction, type RiskLabel } from '../../shared/api/aiApi';

// 💡 서울 25개 구 전체 중심 좌표 (가나다순 정렬됨)
const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  '강남구': { lat: 37.5172, lng: 127.0473 },
  '강동구': { lat: 37.5301, lng: 127.1237 },
  '강북구': { lat: 37.6396, lng: 127.0255 },
  '강서구': { lat: 37.5509, lng: 126.8495 },
  '관악구': { lat: 37.4784, lng: 126.9515 },
  '광진구': { lat: 37.5381, lng: 127.0821 },
  '구로구': { lat: 37.4954, lng: 126.8874 },
  '금천구': { lat: 37.4568, lng: 126.8954 },
  '노원구': { lat: 37.6542, lng: 127.0568 },
  '도봉구': { lat: 37.6688, lng: 127.0471 },
  '동대문구': { lat: 37.5744, lng: 127.0400 },
  '동작구': { lat: 37.5124, lng: 126.9393 },
  '마포구': { lat: 37.5662, lng: 126.9016 },
  '서대문구': { lat: 37.5791, lng: 126.9368 },
  '서초구': { lat: 37.4837, lng: 127.0324 },
  '성동구': { lat: 37.5633, lng: 127.0371 },
  '성북구': { lat: 37.5891, lng: 127.0182 },
  '송파구': { lat: 37.5145, lng: 127.1058 },
  '양천구': { lat: 37.5169, lng: 126.8664 },
  '영등포구': { lat: 37.5264, lng: 126.8962 },
  '용산구': { lat: 37.5326, lng: 126.9900 },
  '은평구': { lat: 37.6027, lng: 126.9291 },
  '종로구': { lat: 37.5729, lng: 126.9793 },
  '중구': { lat: 37.5636, lng: 126.9975 },
  '중랑구': { lat: 37.6065, lng: 127.0924 },
};

// 가나다순으로 구 이름 배열 만들기
const DISTRICT_LIST = Object.keys(REGION_CENTERS).sort();

function getRegionMaxLevels(manholes: Manhole[], regions: string[]) {
  const levels = Object.fromEntries(regions.map((region) => [region, 0])) as Record<string, number>;
  manholes.forEach((manhole) => {
    const region = findClosestDistrictName(manhole.latitude, manhole.longitude);
    if (region in levels) levels[region] = Math.max(levels[region], manhole.waterLevel);
  });
  return Object.fromEntries(Object.entries(levels).map(([region, level]) => [region, Number(level.toFixed(1))]));
}

export function SimulationPage() {
  // 💡 다중 선택을 위해 배열(string[])로 변경! (초기값은 강남구)
  const [targetRegions, setTargetRegions] = useState<string[]>(['강남구']);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // 드롭다운 열림 상태

  const [rainfall, setRainfall] = useState(50);
  const [duration, setDuration] = useState(4); 
  const [elapsedTime, setElapsedTime] = useState(0); 
  const [isSimulating, setIsSimulating] = useState(false);
  const [waterLevel, setWaterLevel] = useState(25);
  const [regionWaterLevels, setRegionWaterLevels] = useState<Record<string, number>>({});
  
  const [recentAlarms, setRecentAlarms] = useState<string[]>([]);
  const alarmedManholesRef = useRef<Set<number>>(new Set());

  const queryClient = useQueryClient();
  const manholesQuery = useQuery({
    queryKey: ['external-manholes'],
    queryFn: fetchExternalManholes,
    staleTime: 30_000,
  });
  const simulatedRiseRate = isSimulating && elapsedTime < duration
    ? Number((((rainfall / 40) + 0.75) / 100).toFixed(3))
    : 0;
  const forecastHours = Math.max(0, Math.min(3, duration - elapsedTime));
  const simulationRiskQueries = useQueries({
    queries: targetRegions.map((region) => ({
      queryKey: ['simulation-risk', region, rainfall, duration, elapsedTime, regionWaterLevels[region] ?? 0],
      queryFn: () => fetchRiskPrediction({
        current_level: regionWaterLevels[region] ?? 0,
        level_velocity: simulatedRiseRate,
        current_rainfall: rainfall,
        forecast_rainfall: rainfall * Math.min(1, forecastHours),
      }),
      staleTime: 1_000,
    })),
  });
  const simulationRegionRiskOverrides = Object.fromEntries(
    targetRegions.flatMap((region, index) => {
      const prediction = simulationRiskQueries[index]?.data;
      return prediction ? [[region, {
        riskScore: prediction.riskScore ?? 0,
        riskLabel: prediction.riskLabel,
      }]] : [];
    }),
  );
  const simulationRisk = simulationRiskQueries
    .map((query, index) => ({ region: targetRegions[index], prediction: query.data }))
    .filter((item) => item.prediction)
    .sort((a, b) => (b.prediction?.riskScore ?? 0) - (a.prediction?.riskScore ?? 0))[0];
  const simulationRiskError = simulationRiskQueries.some((query) => query.isError);

  const riskLabelText: Record<RiskLabel, string> = {
    SAFE: '안전',
    CAUTION: '관심',
    WARNING: '경계',
    DANGER: '위험',
  };

  const triggerExternalAlarm = (manholeName: string, level: number) => {
    const alarmMessage = `[침수 경고] ${manholeName} 수위 ${level.toFixed(1)}% 돌파!`;
    setRecentAlarms((prev) => [alarmMessage, ...prev].slice(0, 3));
  };

  const handleReset = () => {
    setIsSimulating(false);
    setWaterLevel(25);
    setElapsedTime(0); 
    setRecentAlarms([]);
    alarmedManholesRef.current.clear();
    queryClient.invalidateQueries({ queryKey: ["external-manholes"] });
  };

  // 💡 구역 선택 토글 함수
  const toggleRegion = (region: string) => {
    setTargetRegions(prev => 
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  // 💡 전체 선택/해제 함수
  const toggleAllRegions = () => {
    if (targetRegions.length === DISTRICT_LIST.length) {
      setTargetRegions([]); // 모두 선택되어 있으면 전체 해제
    } else {
      setTargetRegions(DISTRICT_LIST); // 아니면 모두 선택
    }
  };

  useEffect(() => {
    setRecentAlarms([]);
    alarmedManholesRef.current.clear();
  }, [targetRegions]);

  useEffect(() => {
    if (isSimulating || !manholesQuery.data) return;
    const levels = getRegionMaxLevels(manholesQuery.data, targetRegions);
    setRegionWaterLevels(levels);
    setWaterLevel(Math.max(0, ...Object.values(levels)));
  }, [isSimulating, manholesQuery.data, targetRegions]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSimulating) {
      interval = setInterval(() => {
        setElapsedTime((prevTime) => {
          const nextTime = prevTime + 1;

          queryClient.setQueryData(["external-manholes"], (oldData: any[]) => {
            if (!oldData || oldData.length === 0) return oldData;
            
            const newData = oldData.map((manhole) => {
              const region = findClosestDistrictName(manhole.latitude, manhole.longitude);
              if (targetRegions.includes(region)) {
                let nextLevel = manhole.waterLevel;
                
                if (prevTime < duration) {
                  const manholeSensitivity = 0.65 + (manhole.locationId % 11) * 0.055;
                  const increase = (rainfall / 40) * manholeSensitivity;
                  nextLevel = Math.min(manhole.waterLevel + increase, 100);
                } else {
                  const drainageRate = 1 + (manhole.locationId % 7) * 0.25;
                  nextLevel = Math.max(manhole.waterLevel - drainageRate, 0);
                }
                
                if (nextLevel >= 90 && !alarmedManholesRef.current.has(manhole.locationId)) {
                  alarmedManholesRef.current.add(manhole.locationId);
                  triggerExternalAlarm(manhole.name, nextLevel);
                }

                return { ...manhole, waterLevel: nextLevel };
              }
              return manhole;
            });

            const nextRegionLevels = getRegionMaxLevels(newData, targetRegions);
            setRegionWaterLevels(nextRegionLevels);
            setWaterLevel(Math.max(0, ...Object.values(nextRegionLevels)));

            return newData;
          });
          
          return nextTime; 
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isSimulating, rainfall, duration, targetRegions, queryClient]);

  // 드롭다운 버튼에 표시할 텍스트 로직
  const getDropdownText = () => {
    if (targetRegions.length === 0) return "구역을 선택하세요";
    if (targetRegions.length === DISTRICT_LIST.length) return "서울 전체 구역";
    if (targetRegions.length === 1) return targetRegions[0];
    return `${targetRegions[0]} 외 ${targetRegions.length - 1}개`;
  };

  return (
    <div className="simulation-layout" style={{ display: 'flex', gap: '20px', padding: '20px', height: '100vh', background: '#f8fafc' }}>
      
      <div className="map-area" style={{ flex: 2, position: 'relative', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
         <RegionRiskMapPanel 
           height="100%"
           selectedRegions={targetRegions}
           showOnlySelectedRegions
           regionRiskOverrides={simulationRegionRiskOverrides}
           layerVisibility={{ regionalRisk: true, waterLevel: true, rainfall: false, safeRoute: false }}
         />

         {isSimulating && (
            <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'rgba(255,255,255,0.95)', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 10 }}>
               경과 시간: <span style={{ color: '#2563eb' }}>{elapsedTime}</span> / {duration}시간
               {elapsedTime >= duration && <span style={{ color: '#16a34a', marginLeft: '10px' }}>(배수 진행 중 ↓)</span>}
            </div>
         )}

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
          
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>타겟 구역 (다중 선택)</label>
            
            {/* 💡 커스텀 드롭다운 메뉴 시작 */}
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ width: '100%', padding: '10px 12px', height: '42px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'white' }}
            >
              <span style={{ fontWeight: targetRegions.length > 0 ? 'bold' : 'normal', color: targetRegions.length > 0 ? '#0f172a' : '#94a3b8' }}>
                {getDropdownText()}
              </span>
              <ChevronDown size={20} color="#64748b" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </div>

            {/* 드롭다운 리스트 (열렸을 때만 보임) */}
            {isDropdownOpen && (
              <div style={{ position: 'absolute', top: '75px', left: 0, width: '100%', maxHeight: '250px', overflowY: 'auto', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50 }}>
                {/* 💡 전체 선택 버튼 */}
                <label style={{ display: 'flex', alignItems: 'center', padding: '12px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: '#f8fafc', fontWeight: 'bold' }}>
                  <input 
                    type="checkbox" 
                    checked={targetRegions.length === DISTRICT_LIST.length} 
                    onChange={toggleAllRegions} 
                    style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  전체
                </label>
                
                {/* 💡 개별 구역 리스트 (가나다순) */}
                {DISTRICT_LIST.map(district => (
                  <label key={district} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer' }}>
                        <input 
                        type="checkbox" 
                        checked={targetRegions.includes(district)} 
                        onChange={() => toggleRegion(district)}
                        style={{ marginRight: '10px', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        {district}
                    </label>
                ))}
              </div>
            )}
            {/* 커스텀 드롭다운 메뉴 끝 */}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>시간당 강수량 설정</label>
            <input 
              type="range" min="1" max="200" step="1"
              value={rainfall} onChange={(e) => setRainfall(Number(e.target.value))} 
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#2563eb', marginTop: '8px', fontSize: '1.1rem' }}>{rainfall} mm/h</div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>강수 지속 시간 (시간)</label>
            <input 
              type="range" min="1" max="24" step="1"
              value={duration} onChange={(e) => setDuration(Number(e.target.value))} 
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#2563eb', marginTop: '8px', fontSize: '1.1rem' }}>{duration} 시간</div>
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

        <div className="panel simulation-ai-risk-card" style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>시뮬레이션 기반</span>
              <h3 style={{ margin: '4px 0 0', fontSize: '1.1rem', color: '#334155' }}>AI 침수 위험도</h3>
            </div>
            <strong className={`simulation-risk-badge simulation-risk-${simulationRisk?.prediction?.riskLabel?.toLowerCase() ?? 'safe'}`}>
              {simulationRisk?.prediction ? riskLabelText[simulationRisk.prediction.riskLabel] : '계산 중'}
            </strong>
          </div>
          {targetRegions.length === 0 ? (
            <p style={{ margin: '18px 0 0', color: '#dc2626' }}>분석할 구역을 선택하세요.</p>
          ) : simulationRiskError ? (
            <p style={{ margin: '18px 0 0', color: '#dc2626' }}>AI 위험도 서버에 연결할 수 없습니다.</p>
          ) : (
            <>
              <div className="simulation-risk-score">
                <strong>{simulationRisk?.prediction?.riskScore ?? 0}</strong><span>/ 100</span>
              </div>
              <div className="simulation-risk-factors">
                <span>최고 위험 {simulationRisk?.region ?? getDropdownText()}</span>
                <span>강우 {rainfall}mm/h</span>
                <span>최대 수위 {waterLevel}%</span>
                <span>예상 강우 {rainfall * forecastHours}mm</span>
              </div>
              <p className="simulation-risk-notice">시뮬레이션 입력값에 따른 OASIS 참고 위험도이며 공식 재난 경보가 아닙니다.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
