import { AiPredictionPanel } from '../../features/flood-prediction/AiPredictionPanel';
import { RiskPredictionChart } from '../../features/flood-prediction/RiskPredictionChart';
import { AppShell } from '../../shared/components/AppShell';

export function RiskAnalysisPage() {
  return (
    <AppShell>
      <div className="page-layout risk-analysis-page">
        <section className="panel page-hero-panel">
          <span className="eyebrow">공공 API 기반 예측</span>
          <h1>AI 위험도 분석</h1>
          <p>실시간 공공 API 기반 지역별 침수 위험도 예측</p>
        </section>

        <div className="risk-analysis-layout">
          <AiPredictionPanel />
          <RiskPredictionChart />
        </div>
      </div>
    </AppShell>
  );
}
