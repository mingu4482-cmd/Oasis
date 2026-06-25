import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchRiskForecast } from '../../shared/api/aiApi';
import { useDashboardStore } from '../../shared/store/dashboardStore';
import { PredictionResult } from '../../shared/types/domain';
import { useLiveStatusQuery } from './AiPredictionPanel';

const waitingPrediction: PredictionResult = {
  modelVersion: 'OASIS-FloodNet v1.0',
  confidence: 0,
  points: [],
  source: 'realtime api waiting',
};

const normalizePoints = (points: PredictionResult['points']) =>
  points.map((point, index) => ({
    ...point,
    time: index === 0 && point.time === 'Now' ? '현재' : point.time,
  }));

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

interface RiskPredictionChartProps {
  embedded?: boolean;
}

export function RiskPredictionChart({ embedded = false }: RiskPredictionChartProps) {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const liveStatusQuery = useLiveStatusQuery(selectedRegion);
  const liveStatus = liveStatusQuery.data;
  const isUnavailable = liveStatus?.dataStatus === 'UNAVAILABLE';
  const forecastQuery = useQuery({
    queryKey: ['risk-forecast', selectedRegion],
    queryFn: () => fetchRiskForecast(selectedRegion),
    staleTime: 30_000,
    enabled: liveStatusQuery.isSuccess && !isUnavailable,
  });

  const activePrediction = useMemo<PredictionResult>(() => {
    const forecast = forecastQuery.data;
    if (!forecast?.hasData) return waitingPrediction;

    return {
      modelVersion: forecast.modelVersion,
      confidence: forecast.confidence,
      riskScore: forecast.riskScore,
      points: normalizePoints(forecast.points),
      source: forecast.source,
      dataStatus: forecast.dataStatus,
      timestamp: forecast.timestamp,
    };
  }, [forecastQuery.data]);

  const displayRisk = activePrediction.riskScore ?? liveStatus?.riskScore ?? 0;

  const chartContent = (
    <>
      <div className="panel-heading">
        <div>
          <h2>1~3시간 침수 위험도</h2>
        </div>
        <div className="chart-risk-summary">
          <span>선택 지역 위험도</span>
          <strong>{isUnavailable ? '-' : `${displayRisk}%`}</strong>
        </div>
      </div>
      <div className="chart-box">
        {isUnavailable ? (
          <div style={{ display: 'grid', height: '100%', placeItems: 'center', color: '#60706c', fontWeight: 800, textAlign: 'center', padding: 16 }}>
            해당 지역은 현재 실시간 데이터가 부족하여 AI 위험도 분석을 제공할 수 없습니다.
          </div>
        ) : activePrediction.points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activePrediction.points} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="riskGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#d8dee7" strokeDasharray="3 3" />
              <XAxis dataKey="time" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="risk" stroke="#dc2626" fill="url(#riskGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: 'grid', height: '100%', placeItems: 'center', color: '#60706c', fontWeight: 800 }}>
            대기 중
          </div>
        )}
      </div>
      {forecastQuery.isFetching || liveStatusQuery.isFetching ? <p className="model-label">데이터 갱신 중</p> : null}
      <p className="model-label">
        분석 지역 {selectedRegion} · 종합 위험도 기준 · {activePrediction.modelVersion} · 데이터 출처: {activePrediction.source ?? liveStatus?.source ?? '대기 중'} · 마지막 업데이트:{' '}
        {formatTimestamp(activePrediction.timestamp)}
      </p>
    </>
  );

  if (embedded) {
    return <div className="embedded-risk-chart">{chartContent}</div>;
  }

  return (
    <section className="panel">
      {chartContent}
    </section>
  );
}
