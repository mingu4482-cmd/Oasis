import { AlertTriangle, Droplets, RadioTower, Route } from 'lucide-react';
import { IncidentTimeline } from '../../features/alert-system/IncidentTimeline';
import { RiskPredictionChart } from '../../features/flood-prediction/RiskPredictionChart';
import { KakaoMapPanel } from '../../features/kakao-map/KakaoMapPanel';
import { McpAutomationPanel } from '../../features/mcp-automation/McpAutomationPanel';
import { SensorStatusPanel } from '../../features/sensor-monitor/SensorStatusPanel';
import { AppShell } from '../../shared/components/AppShell';
import { MetricTile } from '../../shared/components/MetricTile';
import { useDashboardStore } from '../../shared/store/dashboardStore';

export function DashboardPage() {
  const incidents = useDashboardStore((state) => state.activeIncidents);

  return (
    <>
      <div className="dashboard-layout">
        <section className="overview-strip">
          <MetricTile label="활성 사고" value={`${incidents.length}건`} tone="danger" icon={<AlertTriangle size={18} />} />
          <MetricTile label="예측 최고 위험" value="81%" tone="warning" icon={<Droplets size={18} />} />
          <MetricTile label="센서 가동률" value="92%" icon={<RadioTower size={18} />} />
          <MetricTile label="안전 경로" value="12개" icon={<Route size={18} />} />
        </section>
        <div className="main-grid">
          <div className="map-column">
            <KakaoMapPanel />
            <IncidentTimeline />
          </div>
          <aside className="right-rail">
            <RiskPredictionChart />
            <SensorStatusPanel />
            <McpAutomationPanel />
          </aside>
        </div>
      </div>
    </>
  );
}
