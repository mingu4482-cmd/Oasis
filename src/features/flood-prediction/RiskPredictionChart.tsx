import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboardStore } from '../../shared/store/dashboardStore';

export function RiskPredictionChart() {
  const prediction = useDashboardStore((state) => state.aiPrediction);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">AI 예측</span>
          <h2>1~3시간 침수 위험도</h2>
        </div>
        <strong>{Math.round(prediction.confidence * 100)}%</strong>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={prediction.points} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
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
      </div>
      <p className="model-label">{prediction.modelVersion}</p>
    </section>
  );
}
