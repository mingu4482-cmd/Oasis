import { Gauge } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LiveStatusResponse, RiskLabel, fetchLiveStatus, fetchRegions } from '../../shared/api/aiApi';
import { useDashboardStore } from '../../shared/store/dashboardStore';

const riskMeta: Record<RiskLabel, { label: RiskLabel; className: string }> = {
  SAFE: { label: 'SAFE', className: 'ai-risk-normal' },
  CAUTION: { label: 'CAUTION', className: 'ai-risk-caution' },
  WARNING: { label: 'WARNING', className: 'ai-risk-warning' },
  DANGER: { label: 'DANGER', className: 'ai-risk-danger' },
};

const fallbackRegions = ['강남구', '서초구', '관악구', '동작구', '영등포구', '구로구', '양천구', '마포구', '성동구', '광진구'];

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

export function AiPredictionPanel() {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const [regions, setRegions] = useState<string[]>(fallbackRegions);
  const [liveData, setLiveData] = useState<LiveStatusResponse | null>(null);
  const [error, setError] = useState('');

  const loadLiveStatus = async (region = selectedRegion) => {
    try {
      const data = await fetchLiveStatus(region);
      setLiveData(data);

      if (!data.hasData) {
        setError('아직 수집된 실시간 데이터가 없습니다. 스케줄러 실행 상태를 확인하세요.');
        return;
      }

      setError('');
    } catch (fetchError) {
      console.error('Failed to fetch live status:', fetchError);
      setError('실시간 데이터를 조회하는 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchRegions()
      .then((data) => {
        setRegions(data.regions.length > 0 ? data.regions : fallbackRegions);
        if (!selectedRegion && data.defaultRegion) {
          setSelectedRegion(data.defaultRegion);
        }
      })
      .catch((regionsError) => {
        console.error('Failed to fetch regions:', regionsError);
        setRegions(fallbackRegions);
      });
  }, [selectedRegion, setSelectedRegion]);

  useEffect(() => {
    loadLiveStatus(selectedRegion);
    const interval = window.setInterval(() => loadLiveStatus(selectedRegion), 30000);

    return () => window.clearInterval(interval);
  }, [selectedRegion]);

  const riskScore = liveData?.riskScore ?? 0;
  const riskLabel = liveData?.hasData ? toRiskLabel(liveData.riskLabel, riskScore) : null;
  const risk = riskLabel ? riskMeta[riskLabel] : null;
  const liveWarnings = Array.from(
    new Set([...(liveData?.warnings ?? []), liveData?.fallbackReason].filter(Boolean) as string[]),
  );

  return (
    <section className="panel ai-prediction-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">실시간 지역 모니터링</span>
          <h2>AI 침수 위험도 결과</h2>
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
            <strong>강수량 {liveData?.hasData ? formatValue(liveData.rainfall, 'mm') : '-'}</strong>
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
            <strong>{riskScore}%</strong>
            {risk ? (
              <strong className={`ai-risk-badge ${risk.className}`}>{risk.label}</strong>
            ) : (
              <strong className="ai-risk-placeholder">대기 중</strong>
            )}
          </div>
        </div>

        <div className="ai-result-box risk-analysis-card data-basis-card">
          <span>데이터 기준 정보</span>
          <div>
            <div>분석 기준 위치: {liveData?.targetAreaName ?? selectedRegion}</div>
            <div>강우량 기준: {liveData?.rainfallStation ?? '-'} / {liveData?.rainfallObservedAt ?? '-'}</div>
            <div>하수관로 기준: {liveData?.drainpipeStation ?? '-'} / {liveData?.drainpipeMeasuredAt ?? '-'}</div>
            <div>
              예보 기준: 기상청 격자 nx {liveData?.forecastGrid?.nx ?? '-'}, ny {liveData?.forecastGrid?.ny ?? '-'}
            </div>
            <div>데이터 출처: {liveData?.source ?? 'realtime api waiting'}</div>
            <div>마지막 업데이트: {formatTimestamp(liveData?.timestamp)}</div>
          </div>
        </div>
      </div>

      {error ? <div className="ai-prediction-error">{error}</div> : null}
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
