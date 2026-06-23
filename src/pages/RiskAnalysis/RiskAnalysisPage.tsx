import { useCallback, useEffect, useRef, useState } from 'react';
import { AiPredictionPanel } from '../../features/flood-prediction/AiPredictionPanel';
import { RiskPredictionChart } from '../../features/flood-prediction/RiskPredictionChart';
import { fetchLiveStatus, generateAlert, GenerateAlertResponse, LiveStatusResponse } from '../../shared/api/aiApi';
import { AppShell } from '../../shared/components/AppShell';
import { useDashboardStore } from '../../shared/store/dashboardStore';

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

function buildAlertKey(status: LiveStatusResponse, region: string) {
  return [
    region,
    status.timestamp ?? '',
    status.riskScore ?? 0,
    status.riskLabel ?? '',
    status.rainfall ?? 0,
    status.waterLevel ?? 0,
    status.waterLevelRiseRate ?? 0,
    status.forecastRainfall1h ?? 0,
  ].join('|');
}

function SituationAlertCard() {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const [alert, setAlert] = useState<GenerateAlertResponse | null>(null);
  const [status, setStatus] = useState<LiveStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const lastAlertKeyRef = useRef('');

  const loadAlert = useCallback(async () => {
    setIsLoading(true);
    try {
      const liveStatus = await fetchLiveStatus(selectedRegion);
      setStatus(liveStatus);

      if (!liveStatus.hasData) {
        setAlert(null);
        setError('아직 알림을 생성할 실시간 위험도 데이터가 없습니다.');
        lastAlertKeyRef.current = '';
        return;
      }

      const nextKey = buildAlertKey(liveStatus, selectedRegion);
      if (nextKey === lastAlertKeyRef.current) {
        setError('');
        return;
      }

      const generated = await generateAlert({
        region: liveStatus.targetAreaName ?? selectedRegion,
        riskScore: liveStatus.riskScore ?? 0,
        riskLabel: liveStatus.riskLabel ?? 'SAFE',
        rainfall: liveStatus.rainfall ?? 0,
        waterLevel: liveStatus.waterLevel ?? 0,
        waterLevelRiseRate: liveStatus.waterLevelRiseRate ?? 0,
        forecastRainfall1h: liveStatus.forecastRainfall1h ?? 0,
        source: liveStatus.source,
      });

      lastAlertKeyRef.current = nextKey;
      setAlert(generated);
      setError('');
    } catch (alertError) {
      console.error('Failed to generate situation alert:', alertError);
      setError('상황별 알림 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRegion]);

  useEffect(() => {
    lastAlertKeyRef.current = '';
    loadAlert();
    const interval = window.setInterval(loadAlert, 30000);

    return () => window.clearInterval(interval);
  }, [loadAlert]);

  const isEmphasis = status?.riskLabel === 'WARNING' || status?.riskLabel === 'DANGER';

  return (
    <section className={isEmphasis ? 'panel situation-alert-card alert-emphasis' : 'panel situation-alert-card'}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">상황별 알림</span>
          <h2>{alert?.title ?? '알림 생성 대기'}</h2>
        </div>
        <span className="alert-source-badge">{alert?.source ?? '대기 중'}</span>
      </div>

      {isLoading && !alert ? <div className="alert-empty-state">알림 문구를 생성하는 중입니다.</div> : null}
      {error ? <div className="ai-prediction-error">{error}</div> : null}

      {alert ? (
        <div className="situation-alert-grid">
          <div className="summary-row">
            <span>알림 단계</span>
            <strong>{alert.alertLevel}</strong>
          </div>
          <div className="summary-row">
            <span>알림 대상</span>
            <strong>{alert.targetGroup.length ? alert.targetGroup.join(', ') : '대상 없음'}</strong>
          </div>
          <div className="alert-message-box">
            <span>알림 메시지</span>
            <p>{alert.message}</p>
          </div>
          <div className="alert-action-list">
            <span>권장 대응 조치</span>
            <ul>
              {alert.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
          <div className="summary-row">
            <span>생성 시각</span>
            <strong>{formatTimestamp(alert.createdAt)}</strong>
          </div>
          <div className="summary-row">
            <span>생성 방식</span>
            <strong>{alert.source ?? '-'}</strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function RiskAnalysisPage() {
  return (
    <AppShell>
      <div className="page-layout risk-analysis-page">
        <section className="panel page-hero-panel">
          <span className="eyebrow">공공 API 기반 예측</span>
          <h1>AI 위험도 분석</h1>
          <p>실시간 공공 API 기반 지역별 침수 위험도 예측</p>
        </section>

        <div className="risk-analysis-layout">
          <AiPredictionPanel />
          <RiskPredictionChart />
          <SituationAlertCard />
        </div>
      </div>
    </AppShell>
  );
}
