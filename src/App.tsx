import React, { useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import {
  STAGES, INITIAL_LOGS, StageKey, LogEntry,
  renderTemplate, buildVars,
} from './data';
import StageTab from './components/StageTab';
import TemplateEditor from './components/TemplateEditor';
import PreviewPanel from './components/PreviewPanel';
import SendLog from './components/SendLog';
import KakaoMapPanel from './components/KakaoMapPanel';
import './index.css';
import styles from './App.module.css';

let nextId = INITIAL_LOGS.length + 1;

export default function App() {
  const [activeKey, setActiveKey] = useState<StageKey>('caution');
  const [body, setBody] = useState(STAGES[0].template);
  const [manholeId, setManholeId] = useState('MH-001');
  const [location, setLocation]   = useState('강남역 1번 출구 인근');
  const [waterLevel, setWaterLevel] = useState('91');
  const [riseRate, setRiseRate]   = useState('3.2');
  const [kakaoMapKey, setKakaoMapKey] = useState('');
  const [weatherApiKey, setWeatherApiKey] = useState('');
  const [weatherStatus, setWeatherStatus] = useState('강한 비');
  const [rainfall, setRainfall] = useState('38');
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);

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
            <p className={styles.title}>MCP 알림 메시지 관리</p>
            <p className={styles.sub}>단계별 SMS · Slack 템플릿 편집 및 발송</p>
          </div>
        </div>
        <div className={styles.liveTag}>
          <span className={styles.liveDot} />
          실시간 연동
        </div>
      </header>

      <StageTab stages={STAGES} active={activeKey} onChange={handleStageChange} />

      <KakaoMapPanel
        apiKey={kakaoMapKey}
        location={location}
      />

      <div className={styles.body}>
        <TemplateEditor
          manholeId={manholeId}
          location={location}
          waterLevel={waterLevel}
          riseRate={riseRate}
          kakaoMapKey={kakaoMapKey}
          weatherApiKey={weatherApiKey}
          weatherStatus={weatherStatus}
          rainfall={rainfall}
          body={body}
          onManholeId={setManholeId}
          onLocation={setLocation}
          onWaterLevel={setWaterLevel}
          onRiseRate={setRiseRate}
          onKakaoMapKey={setKakaoMapKey}
          onWeatherApiKey={setWeatherApiKey}
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
