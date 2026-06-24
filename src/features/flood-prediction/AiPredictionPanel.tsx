import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
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
  if (score >= 80) return 'DANGER';
  if (score >= 60) return 'WARNING';
  if (score >= 40) return 'CAUTION';
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

export function useLiveStatusQuery(region: string) {
  return useQuery<LiveStatusResponse>({
    queryKey: liveStatusQueryKey(region),
    queryFn: () => fetchLiveStatus(region),
    staleTime: 30_000,
  });
}

export function AiPredictionPanel() {
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
  const liveWarnings = Array.from(
    new Set([...(liveData?.warnings ?? []), liveData?.fallbackReason].filter(Boolean) as string[]),
  );

  return (
    <section className="panel ai-prediction-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">실시간 지역 모니터링</span>
          <h2>AI 침수 위험 결과</h2>
        </div>
        <Gauge size={22} />
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

      <div className="risk-analysis-grid">
        <div className="ai-result-box risk-analysis-card">
          <span>실시간 수집값</span>
          <div className="live-metric-grid">
            <strong>강우량 {liveData?.hasData ? formatValue(liveData.rainfall, 'mm') : '-'}</strong>
            <strong>하수관로 수위 {liveData?.hasData ? formatValue(liveData.waterLevel, '%') : '-'}</strong>
            <strong>배수 상태 {liveData?.hasData ? formatValue(liveData.drainageLevel, '%') : '-'}</strong>
            <strong>상승 속도 {liveData?.hasData ? formatValue(liveData.waterLevelRiseRate, 'm/h') : '-'}</strong>
            <strong>+1h {liveData?.hasData ? formatValue(liveData.forecastRainfall1h, 'mm') : '-'}</strong>
            <strong>+2h {liveData?.hasData ? formatValue(liveData.forecastRainfall2h, 'mm') : '-'}</strong>
            <strong>+3h {liveData?.hasData ? formatValue(liveData.forecastRainfall3h, 'mm') : '-'}</strong>
          </div>
        </div>

        <div className="ai-result-box risk-analysis-card">
          <span>AI 예측 결과</span>
          <div className="risk-score-row">
            <strong>{isUnavailable ? '-' : `${riskScore}%`}</strong>
            {risk && !isUnavailable ? (
              <strong className={`ai-risk-badge ${risk.className}`}>{risk.label}</strong>
            ) : (
              <strong className="ai-risk-placeholder">데이터 부족</strong>
            )}
          </div>
          {liveData?.message ? <p className="model-label">{liveData.message}</p> : null}
        </div>

        <div className="ai-result-box risk-analysis-card data-basis-card">
          <span>데이터 기준 정보</span>
          <div>
            <div>분석 기준 위치: {liveData?.targetAreaName ?? selectedRegion}</div>
            <div>강우 관측: {liveData?.rainfallStation ?? '-'} / {liveData?.rainfallObservedAt ?? '-'}</div>
            <div>하수관로 관측: {liveData?.drainpipeStation ?? '-'} / {liveData?.drainpipeMeasuredAt ?? '-'}</div>
            <div>
              예보 격자: nx {liveData?.forecastGrid?.nx ?? '-'}, ny {liveData?.forecastGrid?.ny ?? '-'}
            </div>
            <div>데이터 상태: {DATA_STATUS_LABEL[liveData?.dataStatus ?? 'UNAVAILABLE'] ?? '-'}</div>
            <div>데이터 출처: {liveData?.source ?? 'realtime api waiting'}</div>
            <div>마지막 업데이트: {formatTimestamp(liveData?.timestamp)}</div>
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
      {liveData?.dataStatus === 'REALTIME' ? <div className="model-label">실시간 API 기반 분석</div> : null}
      {liveWarnings.length ? (
        <div className="ai-prediction-error">
          {liveWarnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
