import { LocateFixed, Navigation } from 'lucide-react';
import { AppShell } from '../../shared/components/AppShell';

export function SafeRoutePage() {
  return (
    <AppShell>
      <div className="page-layout two-column">
        <section className="route-map">
          <div className="route-line" />
          <span className="route-pin start">현재</span>
          <span className="route-pin end">대피소</span>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">시민 안내</span>
              <h2>안전 경로 산출</h2>
            </div>
            <Navigation size={20} aria-hidden="true" />
          </div>
          <div className="route-summary">
            <div>
              <LocateFixed size={18} aria-hidden="true" />
              <span>현재 위치 기준</span>
              <strong>양재천 대피소까지 1.8km</strong>
            </div>
            <div>
              <Navigation size={18} aria-hidden="true" />
              <span>침수 위험 회피</span>
              <strong>예상 이동 17분</strong>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
