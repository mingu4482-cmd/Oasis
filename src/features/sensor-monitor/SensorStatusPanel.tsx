import { Activity, AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';
import { useDashboardStore } from '../../shared/store/dashboardStore';
import { MetricTile } from '../../shared/components/MetricTile';

export function SensorStatusPanel() {
  const sensor = useDashboardStore((state) => state.sensorSummary);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">센서</span>
          <h2>실시간 현황</h2>
        </div>
        <Activity size={19} aria-hidden="true" />
      </div>
      <div className="metric-grid">
        <MetricTile label="전체" value={`${sensor.total}`} icon={<Activity size={17} />} />
        <MetricTile label="정상" value={`${sensor.online}`} tone="neutral" icon={<CheckCircle2 size={17} />} />
        <MetricTile label="주의" value={`${sensor.warning}`} tone="warning" icon={<AlertCircle size={17} />} />
        <MetricTile label="오프라인" value={`${sensor.offline}`} tone="danger" icon={<WifiOff size={17} />} />
      </div>
    </section>
  );
}
