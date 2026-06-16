import { AppShell } from '../../shared/components/AppShell';

export function DigitalTwinPage() {
  return (
    <AppShell>
      <div className="page-layout">
        <section className="digital-twin-scene">
          <div className="skyline skyline-back" />
          <div className="skyline skyline-mid" />
          <div className="water-plane" />
          <div className="twin-overlay">
            <span className="eyebrow">CesiumJS 디지털 트윈</span>
            <h1>도시 침수 시뮬레이션</h1>
            <p>침수심, 배수 지연, 대피 동선을 같은 좌표계에서 비교합니다.</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
