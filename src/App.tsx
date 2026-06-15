import React, { useState, useCallback } from 'react';
import { Bell, CloudRain, Loader2, MapPin } from 'lucide-react';
import {
  STAGES, INITIAL_LOGS, StageKey, LogEntry,
  renderTemplate, buildVars,
} from './data';
import StageTab from './components/StageTab';
import TemplateEditor from './components/TemplateEditor';
import PreviewPanel from './components/PreviewPanel';
import SendLog from './components/SendLog';
import KakaoMapPanel, { Coordinates } from './components/KakaoMapPanel';
import './index.css';
import styles from './App.module.css';

let nextId = INITIAL_LOGS.length + 1;

interface WeatherRisk {
  latitude: number;
  longitude: number;
  stationId: number;
  stationName: string;
  observedAt: string | null;
  rainfall: number;
  temperature: number | null;
  humidity: number | null;
  riskLevel: StageKey;
  reason: string;
}

function stageLabel(key: StageKey) {
  return STAGES.find((stage) => stage.key === key)?.label ?? key;
}

export default function App() {
  const [activeKey, setActiveKey] = useState<StageKey>('caution');
  const [body, setBody] = useState(STAGES[0].template);
  const [manholeId, setManholeId] = useState('MH-001');
  const [location, setLocation] = useState('서울 시청 인근');
  const [waterLevel, setWaterLevel] = useState('91');
  const [riseRate, setRiseRate] = useState('3.2');
  const [weatherStatus, setWeatherStatus] = useState('기상청 조회 전');
  const [rainfall, setRainfall] = useState('0');
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | null>(null);
  const [risk, setRisk] = useState<WeatherRisk | null>(null);
  const [riskError, setRiskError] = useState('');
  const [isLoadingRisk, setIsLoadingRisk] = useState(false);

  const activeStage = STAGES.find((s) => s.key === activeKey)!;

  const vars = buildVars(
    manholeId,
    location,
    parseFloat(waterLevel) || 0,
    parseFloat(riseRate) || 0,
    weatherStatus,
    parseFloat(rainfall) || 0,
  );
  const preview = renderTemplate(body, vars);

  const handleStageChange = useCallback((key: StageKey) => {
    setActiveKey(key);
    const s = STAGES.find((st) => st.key === key)!;
    setBody(s.template);
  }, []);

  const handleSelectLocation = useCallback((coords: Coordinates, label: string) => {
    setSelectedCoords(coords);
    setLocation(label);
    setRisk(null);
    setRiskError('');
  }, []);

  const applyRiskStage = useCallback((key: StageKey) => {
    setActiveKey(key);
    const stage = STAGES.find((st) => st.key === key)!;
    setBody(stage.template);
  }, []);

  const handleFetchRisk = useCallback(async () => {
    if (!selectedCoords) {
      setRiskError('먼저 지도에서 위치를 클릭해 주세요.');
      return;
    }

    setIsLoadingRisk(true);
    setRiskError('');

    const params = new URLSearchParams({
      lat: String(selectedCoords.latitude),
      lng: String(selectedCoords.longitude),
      waterLevel: String(parseFloat(waterLevel) || 0),
      riseRate: String(parseFloat(riseRate) || 0),
    });

    try {
      const response = await fetch(`/api/weather/risk?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || '기상청 위험도 조회에 실패했습니다.');
      }

      const nextRisk = payload as WeatherRisk;
      setRisk(nextRisk);
      setRainfall(String(nextRisk.rainfall));
      setWeatherStatus(`${nextRisk.stationName} 관측 ${nextRisk.rainfall.toFixed(1)}mm`);
      applyRiskStage(nextRisk.riskLevel);
    } catch (error) {
      setRiskError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoadingRisk(false);
    }
  }, [applyRiskStage, riseRate, selectedCoords, waterLevel]);

  const handleSend = useCallback((channels: string[]) => {
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const entry: LogEntry = {
      id: nextId++,
      stage: activeKey,
      channel: channels.join('+'),
      preview: preview.split('\n')[0],
      time: now,
    };
    setLogs((prev) => [entry, ...prev]);
  }, [activeKey, preview]);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <Bell size={16} color="#1D9E75" />
          </div>
          <div>
            <p className={styles.title}>OASIS 침수 알림 메시지 관리</p>
            <p className={styles.sub}>지도에서 선택한 좌표로 기상청 강수량을 조회하고 위험도를 자동 판단합니다.</p>
          </div>
        </div>
        <div className={styles.liveTag}>
          <span className={styles.liveDot} />
          실시간 연동
        </div>
      </header>

      <StageTab stages={STAGES} active={activeKey} onChange={handleStageChange} />

      <KakaoMapPanel
        location={location}
        selectedCoords={selectedCoords}
        onSelectLocation={handleSelectLocation}
      />

      <section className={styles.riskPanel}>
        <div className={styles.riskInfo}>
          <p className={styles.sectionLabel}>기상청 위험도 조회</p>
          <div className={styles.riskMeta}>
            <span><MapPin size={14} /> {selectedCoords ? `${selectedCoords.latitude.toFixed(5)}, ${selectedCoords.longitude.toFixed(5)}` : '좌표 미선택'}</span>
            <span><CloudRain size={14} /> {risk ? `${risk.rainfall.toFixed(1)}mm / ${stageLabel(risk.riskLevel)}` : '조회 전'}</span>
          </div>
          {risk && (
            <p className={styles.riskReason}>
              {risk.stationName} 관측소 기준. {risk.reason}
            </p>
          )}
          {riskError && <p className={styles.riskError}>{riskError}</p>}
        </div>
        <button className={styles.riskButton} onClick={handleFetchRisk} disabled={isLoadingRisk}>
          {isLoadingRisk ? <Loader2 size={15} className={styles.spin} /> : <CloudRain size={15} />}
          위험도 조회
        </button>
      </section>

      <div className={styles.body}>
        <TemplateEditor
          manholeId={manholeId}
          location={location}
          waterLevel={waterLevel}
          riseRate={riseRate}
          weatherStatus={weatherStatus}
          rainfall={rainfall}
          body={body}
          onManholeId={setManholeId}
          onLocation={setLocation}
          onWaterLevel={setWaterLevel}
          onRiseRate={setRiseRate}
          onWeatherStatus={setWeatherStatus}
          onRainfall={setRainfall}
          onBody={setBody}
        />
        <PreviewPanel
          preview={preview}
          stage={activeStage}
          onSend={handleSend}
        />
      </div>

      <SendLog logs={logs} />
    </div>
  );
}
