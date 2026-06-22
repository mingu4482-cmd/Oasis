import { LocateFixed, Navigation } from 'lucide-react';

function formatDuration(sec: number) {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}
import { AppShell } from '../../shared/components/AppShell';
import { ShelterMapPanel } from '../../features/safe-route/ShelterMapPanel';
import { ShelterList } from '../../features/safe-route/ShelterList';
import { useSafeRouteStore } from '../../features/safe-route/safeRouteStore';

export function SafeRoutePage() {
  const activeRoute = useSafeRouteStore((s) => s.activeRoute);
  const shelters = useSafeRouteStore((s) => s.shelters);
  const selectedId = useSafeRouteStore((s) => s.selectedShelterId);

  const selectedShelter = shelters.find((s) => s.id === selectedId);

  return (
    <AppShell>
      <div className="page-layout two-column">
        {/* 왼쪽: 지도 (기존 route-map 구조 유지 + 대피소 마커 추가) */}
        <ShelterMapPanel />

        {/* 오른쪽: 기존 패널 구조 유지 + 대피소 목록 */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">시민 안내</span>
              <h2>안전 경로 산출</h2>
            </div>
            <Navigation size={20} aria-hidden="true" />
          </div>

          {/* 경로 요약 — 선택된 대피소 or 기본값 표시 */}
          <div className="route-summary">
            <div>
              <LocateFixed size={18} aria-hidden="true" />
              <span>현재 위치 기준</span>
              <strong>
                {selectedShelter
                  ? `${selectedShelter.name}까지 ${selectedShelter.distanceKm}km`
                  : '대피소를 선택하세요'}
              </strong>
            </div>
            <div>
              <Navigation size={18} aria-hidden="true" />
              <span>침수 위험 회피</span>
              <strong>
                {activeRoute
                  ? `예상 이동 ${formatDuration(activeRoute.durationSec)}`
                  : '경로 안내 대기 중'}
              </strong>
            </div>
          </div>

          {/* 대피소 목록 */}
          <ShelterList />
        </section>
      </div>
    </AppShell>
  );
}