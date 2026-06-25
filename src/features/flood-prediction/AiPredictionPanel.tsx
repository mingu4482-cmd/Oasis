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

type AssessmentTone = 'low' | 'medium' | 'high';

interface AssessmentItem {
  label: string;
  value: string;
  assessment: string;
  tone: AssessmentTone;
}

interface ContributionItem {
  label: string;
  value: number;
  rawValue: string;
  metricLabel: string;
}

const valueOrZero = (value: number | undefined) => (typeof value === 'number' ? value : 0);
const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function scaleByBreakpoints(value: number, points: Array<[number, number]>) {
  for (let index = 1; index < points.length; index += 1) {
    const [currentValue, currentScore] = points[index];
    const [previousValue, previousScore] = points[index - 1];
    if (value <= currentValue) {
      const ratio = (value - previousValue) / Math.max(currentValue - previousValue, 1);
      return clampPercent(previousScore + (currentScore - previousScore) * ratio);
    }
  }
  return points[points.length - 1][1];
}

const assessRainfall = (value: number): Pick<AssessmentItem, 'assessment' | 'tone'> => {
  if (value >= 30) return { assessment: '위험', tone: 'high' };
  if (value >= 10) return { assessment: '주의', tone: 'medium' };
  return { assessment: '낮음', tone: 'low' };
};

const assessWaterLevel = (value: number): Pick<AssessmentItem, 'assessment' | 'tone'> => {
  if (value >= 80) return { assessment: '위험', tone: 'high' };
  if (value >= 60) return { assessment: '주의', tone: 'medium' };
  if (value >= 40) return { assessment: '보통', tone: 'medium' };
  return { assessment: '낮음', tone: 'low' };
};

const assessRiseRate = (value: number): Pick<AssessmentItem, 'assessment' | 'tone'> => {
  if (value >= 3) return { assessment: '급상승', tone: 'high' };
  if (value >= 1) return { assessment: '상승 중', tone: 'medium' };
  return { assessment: '안정', tone: 'low' };
};

function buildAssessmentItems(liveData: LiveStatusResponse | null): AssessmentItem[] {
  const rainfall = valueOrZero(liveData?.rainfall);
  const waterLevel = valueOrZero(liveData?.waterLevel);
  const riseRate = valueOrZero(liveData?.waterLevelRiseRate);
  const forecast1h = valueOrZero(liveData?.forecastRainfall1h);
  const forecast2h = valueOrZero(liveData?.forecastRainfall2h);
  const forecast3h = valueOrZero(liveData?.forecastRainfall3h);

  return [
    { label: '현재 강우량 평가', value: `${rainfall}mm`, ...assessRainfall(rainfall) },
    { label: '하수관로 수위 평가', value: `${waterLevel}%`, ...assessWaterLevel(waterLevel) },
    { label: '수위 상승 속도 평가', value: `${riseRate}m/h`, ...assessRiseRate(riseRate) },
    { label: '1시간 예보 강수량 평가', value: `${forecast1h}mm`, ...assessRainfall(forecast1h) },
    { label: '2시간 예보 강수량 평가', value: `${forecast2h}mm`, ...assessRainfall(forecast2h) },
    { label: '3시간 예보 강수량 평가', value: `${forecast3h}mm`, ...assessRainfall(forecast3h) },
  ];
}

function buildFinalJudgment(liveData: LiveStatusResponse | null) {
  const rainfall = valueOrZero(liveData?.rainfall);
  const waterLevel = valueOrZero(liveData?.waterLevel);
  const riseRate = valueOrZero(liveData?.waterLevelRiseRate);
  const maxForecast = Math.max(
    valueOrZero(liveData?.forecastRainfall1h),
    valueOrZero(liveData?.forecastRainfall2h),
    valueOrZero(liveData?.forecastRainfall3h),
  );

  if (waterLevel >= 60 && riseRate >= 3) {
    return '하수관로 수위가 높고 상승 속도가 빨라 침수 위험이 증가하고 있습니다.';
  }
  if (rainfall < 10 && maxForecast >= 30) {
    return '현재 강우량은 낮지만, 예보 강수량이 높아 위험도가 상승했습니다.';
  }
  if (rainfall >= 30 || maxForecast >= 30) {
    return '강우량 또는 예보 강수량이 높아 배수 여건을 지속 확인해야 합니다.';
  }
  if (waterLevel >= 60) {
    return '강우량은 크지 않지만 하수관로 수위가 높아 주의가 필요합니다.';
  }
  return '현재 강우량과 수위가 낮아 침수 위험은 낮은 상태입니다.';
}

function buildContributionItems(liveData: LiveStatusResponse | null): ContributionItem[] {
  const rainfall = valueOrZero(liveData?.rainfall);
  const waterLevel = valueOrZero(liveData?.waterLevel);
  const riseRate = valueOrZero(liveData?.waterLevelRiseRate);
  const forecastMax = Math.max(
    valueOrZero(liveData?.forecastRainfall1h),
    valueOrZero(liveData?.forecastRainfall2h),
    valueOrZero(liveData?.forecastRainfall3h),
  );
  const uncertaintyScore = {
    REALTIME: 0,
    PARTIAL: 30,
    FALLBACK: 60,
    UNAVAILABLE: 100,
  }[liveData?.dataStatus ?? 'UNAVAILABLE'];

  return [
    {
      label: '현재 강우량',
      rawValue: `${rainfall}mm`,
      metricLabel: '위험 수준',
      value: scaleByBreakpoints(rainfall, [[0, 0], [10, 30], [30, 70], [50, 100]]),
    },
    {
      label: '하수관로 수위',
      rawValue: `${waterLevel}%`,
      metricLabel: '위험 수준',
      value: clampPercent(waterLevel),
    },
    {
      label: '수위 상승 속도',
      rawValue: `${riseRate}m/h`,
      metricLabel: '위험 수준',
      value: scaleByBreakpoints(riseRate, [[0, 0], [1, 30], [3, 70], [5, 100]]),
    },
    {
      label: '예보 강수량',
      rawValue: `${forecastMax}mm`,
      metricLabel: '위험 수준',
      value: scaleByBreakpoints(forecastMax, [[0, 0], [10, 30], [30, 70], [50, 100]]),
    },
    {
      label: '데이터 상태',
      rawValue: liveData?.dataStatus ?? 'UNAVAILABLE',
      metricLabel: '분석 불확실성',
      value: uncertaintyScore,
    },
  ];
}

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
  const isLowConfidence = liveData?.dataStatus === 'PARTIAL' || liveData?.dataStatus === 'FALLBACK' || liveData?.source?.toLowerCase().includes('fallback');
  const assessmentItems = buildAssessmentItems(liveData);
  const contributionItems = buildContributionItems(liveData);
  const finalJudgment = liveData?.message ?? buildFinalJudgment(liveData);
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
          {isLowConfidence ? <p className="model-label">일부 데이터가 보정되어 분석 신뢰도가 낮을 수 있습니다.</p> : null}
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

      <div className="risk-explain-grid">
        <div className="ai-result-box risk-analysis-card risk-evidence-card">
          <span>위험도 산정 근거</span>
          <div className="risk-evidence-list">
            {assessmentItems.map((item) => (
              <div className="risk-evidence-row" key={item.label}>
                <span>{item.label}</span>
                <strong>
                  {item.value} → <em className={`risk-evidence-tone ${item.tone}`}>{item.assessment}</em>
                </strong>
              </div>
            ))}
          </div>
          <div className="risk-judgment-box">
            <span>최종 판단</span>
            <p>{finalJudgment}</p>
          </div>
          {isLowConfidence ? (
            <div className="risk-confidence-note">일부 데이터가 보정되어 산정 근거의 정확도가 낮을 수 있습니다.</div>
          ) : null}
        </div>

        <div className="ai-result-box risk-analysis-card risk-contribution-card">
          <span>입력값별 위험 수준</span>
          <div className="risk-contribution-list">
            {contributionItems.map((item) => (
              <div className="risk-contribution-row" key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.rawValue} / {item.metricLabel} {item.value}%</strong>
                </div>
                <div className="risk-contribution-track" aria-hidden="true">
                  <div className="risk-contribution-fill" style={{ width: `${Math.min(item.value, 100)}%` }} />
                </div>
              </div>
            ))}
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
