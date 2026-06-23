import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchRiskForecast } from '../../shared/api/aiApi';
import { useDashboardStore } from '../../shared/store/dashboardStore';
import { PredictionResult } from '../../shared/types/domain';

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

export function RiskPredictionChart() {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const [livePrediction, setLivePrediction] = useState<PredictionResult>(waitingPrediction);
  const [hasLiveData, setHasLiveData] = useState(false);
  const activePrediction = livePrediction;
  const chartMode = hasLiveData ? '실시간 지역 모니터링 모드' : '실시간 대기 모드';

  const displayRisk = useMemo(() => {
    if (activePrediction.points.length === 0) return 0;
    return Math.round(activePrediction.points[0]?.risk ?? Math.max(...activePrediction.points.map((point) => point.risk)));
  }, [activePrediction.points]);

  useEffect(() => {
    let isMounted = true;
    setLivePrediction(waitingPrediction);
    setHasLiveData(false);

    const loadRiskForecast = async () => {
      try {
        const forecast = await fetchRiskForecast(selectedRegion);
        if (!isMounted) return;

        if (!forecast.hasData) {
          setLivePrediction(waitingPrediction);
          setHasLiveData(false);
          return;
        }

        setLivePrediction({
          modelVersion: forecast.modelVersion,
          confidence: forecast.confidence,
          points: normalizePoints(forecast.points),
          source: forecast.source,
          timestamp: forecast.timestamp,
        });
        setHasLiveData(true);
      } catch (error) {
        console.error('Failed to fetch risk forecast:', error);
        setLivePrediction(waitingPrediction);
        setHasLiveData(false);
      }
    };

    loadRiskForecast();
    const interval = window.setInterval(loadRiskForecast, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [selectedRegion]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{chartMode}</span>
          <h2>1~3시간 침수 위험도</h2>
        </div>
        <div className="chart-risk-summary">
          <span>선택 지역 위험도</span>
          <strong>{displayRisk}%</strong>
        </div>
      </div>
      <div className="chart-box">
        {activePrediction.points.length > 0 ? (
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
      <p className="model-label">
        분석 지역: {selectedRegion} · {activePrediction.modelVersion} · 데이터 출처: {activePrediction.source ?? '대기 중'} · 마지막 업데이트:{' '}
        {formatTimestamp(activePrediction.timestamp)}
      </p>
    </section>
  );
}
