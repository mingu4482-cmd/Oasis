import { CSSProperties, ReactNode, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LiveStatusResponse, RiskLabel, fetchLiveStatus, fetchRegions } from '../../shared/api/aiApi';
import { useDashboardStore } from '../../shared/store/dashboardStore';

const riskMeta: Record<RiskLabel, { label: RiskLabel; className: string }> = {
  SAFE: { label: 'SAFE', className: 'ai-risk-normal' },
  CAUTION: { label: 'CAUTION', className: 'ai-risk-caution' },
  WARNING: { label: 'WARNING', className: 'ai-risk-warning' },
  DANGER: { label: 'DANGER', className: 'ai-risk-danger' },
};

const fallbackRegions = ['강남구', '서초구', '관악구', '동작구', '영등포구', '구로구', '양천구', '마포구', '성동구', '광진구'];

const DATA_STATUS_LABEL: Record<string, string> = {
  REALTIME: '실시간',
  PARTIAL: '일부 수집',
  FALLBACK: 'fallback',
  UNAVAILABLE: '계산 불가',
};

export const liveStatusQueryKey = (region: string) => ['live-status', region] as const;

const getRiskLabel = (score: number): RiskLabel => {
  if (score >= 75) return 'DANGER';
  if (score >= 50) return 'WARNING';
  if (score >= 25) return 'CAUTION';
  return 'SAFE';
};

const toRiskLabel = (label: string | undefined, score = 0): RiskLabel => {
  if (label === 'DANGER' || label === 'WARNING' || label === 'CAUTION' || label === 'SAFE') return label;
  return getRiskLabel(score);
};

const formatTimestamp = (timestamp?: string | null) => {
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

const formatValue = (value: number | undefined, unit: string) => (typeof value === 'number' ? `${value}${unit}` : '-');

const toMetricPercent = (value: number | undefined, max: number) => {
  if (typeof value !== 'number') return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
};

export function useLiveStatusQuery(region: string) {
  return useQuery<LiveStatusResponse>({
    queryKey: liveStatusQueryKey(region),
    queryFn: () => fetchLiveStatus(region),
    staleTime: 30_000,
  });
}

interface AiPredictionPanelProps {
  children?: ReactNode;
}

export function AiPredictionPanel({ children }: AiPredictionPanelProps) {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);

  const regionsQuery = useQuery({
    queryKey: ['regions'],
    queryFn: fetchRegions,
    staleTime: 60_000,
  });
  const liveStatusQuery = useLiveStatusQuery(selectedRegion);
  const liveData = liveStatusQuery.data ?? null;

  useEffect(() => {
    if (!selectedRegion && regionsQuery.data?.defaultRegion) {
      setSelectedRegion(regionsQuery.data.defaultRegion);
    }
  }, [regionsQuery.data?.defaultRegion, selectedRegion, setSelectedRegion]);

  const regions = regionsQuery.data?.regions?.length ? regionsQuery.data.regions : fallbackRegions;
  const riskScore = liveData?.riskScore ?? 0;
  const riskLabel = liveData?.hasData ? toRiskLabel(liveData.riskLabel, riskScore) : null;
  const risk = riskLabel ? riskMeta[riskLabel] : null;
  const isUnavailable = liveData?.dataStatus === 'FALLBACK' || liveData?.dataStatus === 'UNAVAILABLE';
  const displayRiskScore = isUnavailable ? 0 : riskScore;
  const riskGaugeStyle = { '--risk-score': `${displayRiskScore}%` } as CSSProperties;
  const liveWarnings = Array.from(
    new Set([...(liveData?.warnings ?? []), liveData?.fallbackReason].filter(Boolean) as string[]),
  );
  const monitoringMetrics = [
    { label: '10분 강우량', value: liveData?.rainfall, unit: 'mm', percent: toMetricPercent(liveData?.rainfall, 12) },
    { label: '하수관로 수위', value: liveData?.waterLevel, unit: '%', percent: toMetricPercent(liveData?.waterLevel, 100) },
    { label: '배수 상태', value: liveData?.drainageLevel, unit: '%', percent: toMetricPercent(liveData?.drainageLevel, 100) },
    { label: '상승 속도', value: liveData?.waterLevelRiseRate, unit: 'm/h', percent: toMetricPercent(liveData?.waterLevelRiseRate, 2) },
  ];
  const forecastBars = [
    { label: '+1h', value: liveData?.forecastStatus === 'FAILED' ? undefined : liveData?.forecastRainfall1h },
    { label: '+2h', value: liveData?.forecastStatus === 'FAILED' ? undefined : liveData?.forecastRainfall2h },
    { label: '+3h', value: liveData?.forecastStatus === 'FAILED' ? undefined : liveData?.forecastRainfall3h },
  ];
  const forecastMax = Math.max(10, ...forecastBars.map((bar) => (typeof bar.value === 'number' ? bar.value : 0)));
  return (
    <section className="panel ai-prediction-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">실시간 지역 모니터링</span>
          <h2>AI 침수 위험 결과</h2>
        </div>
        <div className="panel-updated-at">
          <span>마지막 업데이트</span>
          <strong>{formatTimestamp(liveData?.timestamp)}</strong>
        </div>
      </div>

      <label className="region-select-field">
        분석 지역 선택
        <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)}>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </label>

      <div className="monitoring-overview">
        <div className="risk-hero-card">
          <div className="risk-hero-copy">
            <span>AI 예측 결과</span>
            <strong>{isUnavailable ? '-' : `${riskScore}%`}</strong>
            {risk && !isUnavailable ? (
              <em className={`risk-status-pill ${risk.className}`}>{risk.label}</em>
            ) : (
              <em className="risk-status-pill muted">데이터 부족</em>
            )}
          </div>
          <div className="risk-hero-rail" aria-hidden="true">
            <span style={riskGaugeStyle} />
          </div>
          <div className="risk-hero-scale">
            <span>안정</span>
            <span>주의</span>
            <span>경계</span>
            <span>위험</span>
          </div>
          {liveData?.message ? <p>{liveData.message}</p> : null}
        </div>

        <div className="monitoring-metric-grid">
          {monitoringMetrics.map((metric) => (
            <div key={metric.label} className="monitoring-metric-card">
              <span>{metric.label}</span>
              <strong>{liveData?.hasData ? formatValue(metric.value, metric.unit) : '-'}</strong>
              <div className="monitoring-meter" aria-hidden="true">
                <i style={{ width: `${liveData?.hasData ? metric.percent : 0}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="forecast-summary-card">
          <div className="forecast-summary-heading">
            <span>예보 강수량</span>
            <strong>향후 3시간</strong>
          </div>
          <div className="forecast-summary-bars">
            {forecastBars.map((bar) => {
              const value = typeof bar.value === 'number' ? bar.value : 0;
              const width = liveData?.hasData ? Math.max(4, Math.round((value / forecastMax) * 100)) : 0;
              return (
                <div key={bar.label} className="forecast-summary-row">
                  <span>{bar.label}</span>
                  <div aria-hidden="true">
                    <i style={{ width: `${width}%` }} />
                  </div>
                  <strong>{liveData?.hasData ? formatValue(bar.value, 'mm') : '-'}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {liveStatusQuery.isFetching ? <div className="ai-prediction-error">데이터 갱신 중</div> : null}
      {!liveData?.hasData && !liveStatusQuery.isFetching ? (
        <div className="ai-prediction-error">아직 수집된 실시간 위험도 데이터가 없습니다.</div>
      ) : null}
      {liveData?.dataStatus === 'PARTIAL' ? (
        <div className="ai-prediction-error">일부 데이터가 수집되지 않아 분석 신뢰도가 낮습니다.</div>
      ) : null}
      {isUnavailable ? (
        <div className="ai-prediction-error">해당 지역은 현재 실시간 데이터가 부족하여 AI 위험도 분석을 제공할 수 없습니다.</div>
      ) : null}
      {liveWarnings.length ? (
        <div className="ai-prediction-error">
          {liveWarnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}
      {children}
    </section>
  );
}
