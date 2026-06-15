import React, { useRef } from 'react';
import { CloudRain, KeyRound, MapPin, Hash, TrendingUp, Brackets } from 'lucide-react';
import styles from './TemplateEditor.module.css';

const TOKENS = ['{{맨홀ID}}', '{{위치}}', '{{수위}}', '{{속도}}', '{{날씨}}', '{{강수량}}', '{{5분후}}', '{{10분후}}', '{{시간}}'];

interface Props {
  manholeId: string;
  location: string;
  waterLevel: string;
  riseRate: string;
  kakaoMapKey: string;
  weatherApiKey: string;
  weatherStatus: string;
  rainfall: string;
  body: string;
  onManholeId: (v: string) => void;
  onLocation: (v: string) => void;
  onWaterLevel: (v: string) => void;
  onRiseRate: (v: string) => void;
  onKakaoMapKey: (v: string) => void;
  onWeatherApiKey: (v: string) => void;
  onWeatherStatus: (v: string) => void;
  onRainfall: (v: string) => void;
  onBody: (v: string) => void;
}

export default function TemplateEditor({
  manholeId, location, waterLevel, riseRate, kakaoMapKey, weatherApiKey, weatherStatus, rainfall, body,
  onManholeId, onLocation, onWaterLevel, onRiseRate, onKakaoMapKey, onWeatherApiKey, onWeatherStatus, onRainfall, onBody,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  function insertToken(token: string) {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const next = ta.value.slice(0, s) + token + ta.value.slice(e);
    onBody(next);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = s + token.length;
      ta.focus();
    }, 0);
  }

  return (
    <div className={styles.editor}>
      <p className={styles.sectionLabel}>템플릿 편집</p>

      <div className={styles.field}>
        <label className={styles.label}><Hash size={13} /> 맨홀 ID</label>
        <input value={manholeId} onChange={(e) => onManholeId(e.target.value)} className={styles.input} />
      </div>

      <div className={styles.field}>
        <label className={styles.label}><MapPin size={13} /> 위치</label>
        <input value={location} onChange={(e) => onLocation(e.target.value)} className={styles.input} />
      </div>

      <div className={styles.apiBox}>
        <p className={styles.groupTitle}>외부 API 설정</p>
        <div className={styles.field}>
          <label className={styles.label}><MapPin size={13} /> 카카오맵 API Key</label>
          <input
            value={kakaoMapKey}
            onChange={(e) => onKakaoMapKey(e.target.value)}
            className={styles.input}
            placeholder="Kakao JavaScript Key 또는 REST Key"
            type="password"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}><KeyRound size={13} /> 날씨 API Key</label>
          <input
            value={weatherApiKey}
            onChange={(e) => onWeatherApiKey(e.target.value)}
            className={styles.input}
            placeholder="기상청 API Key"
            type="password"
          />
        </div>
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label}>현재 수위 (%)</label>
          <input value={waterLevel} onChange={(e) => onWaterLevel(e.target.value)} className={styles.input} type="number" min="0" max="100" />
        </div>
        <div className={styles.field}>
          <label className={styles.label}><TrendingUp size={13} /> 상승 속도</label>
          <input value={riseRate} onChange={(e) => onRiseRate(e.target.value)} className={styles.input} type="number" min="0" step="0.1" />
        </div>
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label}><CloudRain size={13} /> 날씨 상태</label>
          <input value={weatherStatus} onChange={(e) => onWeatherStatus(e.target.value)} className={styles.input} placeholder="예: 강한 비" />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>강수량 (mm)</label>
          <input value={rainfall} onChange={(e) => onRainfall(e.target.value)} className={styles.input} type="number" min="0" step="0.1" />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>메시지 본문</label>
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => onBody(e.target.value)}
          className={styles.textarea}
          rows={9}
        />
      </div>

      <div className={styles.tokenSection}>
        <label className={styles.label}><Brackets size={13} /> 변수 삽입</label>
        <div className={styles.tokens}>
          {TOKENS.map((t) => (
            <button key={t} className={styles.token} onClick={() => insertToken(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
