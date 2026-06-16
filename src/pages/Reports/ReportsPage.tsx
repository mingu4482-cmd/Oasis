import { Download, FileCheck2 } from 'lucide-react';
import { AppShell } from '../../shared/components/AppShell';

const reports = ['침수 위험 예측 요약', '현장 대응 체크리스트', '센서 이상 탐지 로그', '시민 알림 발송 이력'];

export function ReportsPage() {
  return (
    <AppShell>
      <div className="page-layout">
        <section className="panel report-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">보고서</span>
              <h2>자동 생성 대기열</h2>
            </div>
            <button className="primary-icon-button" type="button" aria-label="보고서 다운로드">
              <Download size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="report-grid">
            {reports.map((report, index) => (
              <article key={report} className="report-item">
                <FileCheck2 size={20} aria-hidden="true" />
                <strong>{report}</strong>
                <span>{index < 2 ? '생성 가능' : '데이터 수집 중'}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
