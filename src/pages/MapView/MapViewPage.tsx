import { MapPin } from 'lucide-react';
import { RegionRiskMapPanel } from '../../features/kakao-map/RegionRiskMapPanel';
import { AppShell } from '../../shared/components/AppShell';
import { useDashboardStore } from '../../shared/store/dashboardStore';

export const MapViewPage = () => {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);

  return (
    <AppShell>
      <div className="page-layout map-view-page">
        <section className="panel page-hero-panel map-view-hero">
          <div>
            <span className="eyebrow">지역별 위험도 지도</span>
            <h1>통합 침수 위험도 지도</h1>
            <p>지역 마커를 선택하면 AI 위험도 분석 기준 지역이 함께 변경됩니다.</p>
          </div>
          <div className="map-view-selected-region">
            <MapPin size={18} />
            <strong>{selectedRegion}</strong>
          </div>
        </section>

        <RegionRiskMapPanel className="full-region-risk-map" height="calc(100vh - 210px)" />
      </div>
    </AppShell>
  );
};
