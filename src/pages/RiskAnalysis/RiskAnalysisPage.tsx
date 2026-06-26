import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AiPredictionPanel, useLiveStatusQuery } from '../../features/flood-prediction/AiPredictionPanel';
import { RiskPredictionChart } from '../../features/flood-prediction/RiskPredictionChart';
import { generateAlert, GenerateAlertResponse, LiveStatusResponse } from '../../shared/api/aiApi';
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
  const liveStatusQuery = useLiveStatusQuery(selectedRegion);
  const status = liveStatusQuery.data ?? null;
  const isUnavailable = status?.dataStatus === 'UNAVAILABLE';
  const isFallback = status?.dataStatus === 'FALLBACK';

  const alertQuery = useQuery<GenerateAlertResponse>({
    queryKey: ['generated-alert', status ? buildAlertKey(status, selectedRegion) : selectedRegion],
    queryFn: () =>
      generateAlert({
        region: status?.targetAreaName ?? selectedRegion,
        riskScore: status?.riskScore ?? 0,
        riskLabel: status?.riskLabel ?? 'SAFE',
        rainfall: status?.rainfall ?? 0,
        waterLevel: status?.waterLevel ?? 0,
        waterLevelRiseRate: status?.waterLevelRiseRate ?? 0,
        forecastRainfall1h: status?.forecastRainfall1h ?? 0,
        source: status?.source,
        dataStatus: status?.dataStatus,
      }),
    enabled: Boolean(status?.hasData) && !isUnavailable && !isFallback,
    staleTime: 30_000,
  });

  const alert = alertQuery.data ?? null;
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

      {liveStatusQuery.isFetching || alertQuery.isFetching ? <div className="alert-empty-state">데이터 갱신 중</div> : null}
      {!status?.hasData && !liveStatusQuery.isFetching ? (
        <div className="ai-prediction-error">아직 알림을 생성할 실시간 위험도 데이터가 없습니다.</div>
      ) : null}
      {status?.dataStatus === 'PARTIAL' || status?.dataStatus === 'FALLBACK' ? (
        <div className="ai-prediction-error">일부 데이터가 수집되지 않아 분석 신뢰도가 낮습니다.</div>
      ) : null}
      {isUnavailable ? (
        <div className="ai-prediction-error">해당 지역은 현재 실시간 데이터가 부족하여 AI 위험도 분석을 제공할 수 없습니다.</div>
      ) : null}
      {alertQuery.isError ? <div className="ai-prediction-error">상황별 알림 생성 중 오류가 발생했습니다.</div> : null}

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
            <span>데이터 상태</span>
            <strong>{status?.dataStatus ?? '-'}</strong>
          </div>
          <div className="summary-row">
            <span>데이터 출처</span>
            <strong>{status?.source ?? '-'}</strong>
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
  const [searchParams] = useSearchParams();
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const regionFromQuery = searchParams.get('region');

  useEffect(() => {
    if (regionFromQuery) {
      setSelectedRegion(regionFromQuery);
    }
  }, [regionFromQuery, setSelectedRegion]);

  return (
    <div className="page-layout risk-analysis-page">
      <div className="risk-analysis-layout">
        <AiPredictionPanel>
          <RiskPredictionChart embedded />
        </AiPredictionPanel>
        <SituationAlertCard />
      </div>
    </div>
  );
}
