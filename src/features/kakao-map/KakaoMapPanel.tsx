import { mapLayers } from '../flood-prediction/mockData';

export function KakaoMapPanel() {
  return (
    <section className="map-surface" aria-label="카카오맵 통합 모니터링">
      <div className="map-grid" />
      <div className="risk-zone zone-danger">강남 저지대</div>
      <div className="risk-zone zone-warning">서초 배수 지연</div>
      <div className="risk-zone zone-watch">마포 강수 증가</div>
      <div className="sensor-dot dot-a" />
      <div className="sensor-dot dot-b" />
      <div className="sensor-dot dot-c" />
      <div className="map-toolbar">
        {mapLayers.slice(0, 4).map((layer) => (
          <button key={layer.id} className={layer.enabled ? 'layer active' : 'layer'} type="button">
            {layer.name}
          </button>
        ))}
      </div>
    </section>
  );
}
