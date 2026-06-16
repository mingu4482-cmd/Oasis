import { mapLayers } from '../../features/flood-prediction/mockData';
import { KakaoMapPanel } from '../../features/kakao-map/KakaoMapPanel';
import { AppShell } from '../../shared/components/AppShell';

export function MapViewPage() {
  return (
    <AppShell>
      <div className="page-layout two-column">
        <KakaoMapPanel />
        <section className="panel layer-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">레이어</span>
              <h2>데이터 소스</h2>
            </div>
          </div>
          <div className="layer-table">
            {mapLayers.map((layer) => (
              <div key={layer.id} className="layer-row">
                <span>{layer.name}</span>
                <strong>{layer.source}</strong>
                <em>{layer.refresh}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
