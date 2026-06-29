import { Activity, AlertTriangle, Clock, Database, Droplets, MapPin, Route as RouteIcon, Waves } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { IncidentTimeline } from '../../features/alert-system/IncidentTimeline';
import { KakaoMapPanel } from '../../features/kakao-map/KakaoMapPanel';
import { ShelterList } from '../../features/safe-route/ShelterList';
import { useSafeRouteStore } from '../../features/safe-route/safeRouteStore';
import { fetchRegionalStatus, LiveStatusResponse, RegionalStatusResponse } from '../../shared/api/aiApi';
import { MetricTile } from '../../shared/components/MetricTile';
import { useDashboardStore } from '../../shared/store/dashboardStore';

type RankedRegion = LiveStatusResponse & {
  regionName: string;
  riskScore: number;
};

type DashboardMapMode = 'regionalRisk' | 'waterLevel' | 'safeRoute';

const DASHBOARD_MAP_MODES = [
  { id: 'regionalRisk', label: '위험도', icon: Activity },
  { id: 'waterLevel', label: '맨홀 위치', icon: Waves },
  { id: 'safeRoute', label: '안전경로', icon: RouteIcon },
] as const;

const formatTimestamp = (timestamp?: string | null) => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

function formatDuration(sec: number) {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

const getRankedRegions = (regionalStatus: RegionalStatusResponse | null): RankedRegion[] => {
  if (!regionalStatus?.hasData || !regionalStatus.regionStatusMap) {
    return [];
  }

  return Object.entries(regionalStatus.regionStatusMap)
    .filter(([, status]) => status.dataStatus !== 'FALLBACK' && status.dataStatus !== 'UNAVAILABLE')
    .map(([regionName, status]) => ({
      ...status,
      regionName: status.targetAreaName ?? regionName,
      riskScore: status.riskScore ?? 0,
    }))
    .sort((a, b) => b.riskScore - a.riskScore);
};

export function DashboardPage() {
  const incidents = useDashboardStore((state) => state.activeIncidents);
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const [mapMode, setMapMode] = useState<DashboardMapMode>('regionalRisk');
  const activeRoute = useSafeRouteStore((state) => state.activeRoute);
  const shelters = useSafeRouteStore((state) => state.shelters);
  const selectedShelterId = useSafeRouteStore((state) => state.selectedShelterId);
  const regionalStatusQuery = useQuery({
    queryKey: ['regional-status'],
    queryFn: fetchRegionalStatus,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const regionalStatus = regionalStatusQuery.data ?? null;

  const rankedRegions = useMemo(() => getRankedRegions(regionalStatus), [regionalStatus]);
  const highestRiskRegion = rankedRegions[0] ?? null;
  const top3Regions = rankedRegions.slice(0, 3);
  const hasRegionalData = rankedRegions.length > 0;
  const allStable = hasRegionalData && (highestRiskRegion?.riskScore ?? 0) < 40;
  const headlineTitle = hasRegionalData
    ? allStable
      ? '상대적 최고 지역'
      : '현재 최고 위험 지역'
    : '데이터 수집 중';
  const dataStatus = hasRegionalData ? '수집 중' : '데이터 수집 중';
  const lastUpdated = highestRiskRegion?.timestamp ?? regionalStatus?.timestamp;
  const selectedShelter = shelters.find((shelter) => shelter.id === selectedShelterId);

  const mapLayerVisibility = {
    regionalRisk: mapMode === 'regionalRisk',
    waterLevel: mapMode === 'waterLevel',
    safeRoute: mapMode === 'safeRoute',
    rainfall: true,
  };

  return (
    <div className="dashboard-layout">
      <section className="overview-strip">
        <MetricTile label="현재 선택 지역" value={selectedRegion} icon={<MapPin size={18} />} />
        <MetricTile label="활성 경보" value={`${incidents.length}건`} tone="danger" icon={<AlertTriangle size={18} />} />
        <MetricTile label="데이터 수집 상태" value={dataStatus} icon={<Database size={18} />} />
        <MetricTile label="마지막 업데이트" value={formatTimestamp(lastUpdated)} icon={<Clock size={18} />} />
      </section>

      <div className="main-grid">
        <div className="map-column">
          <KakaoMapPanel
            layerVisibility={mapLayerVisibility}
            mapControls={DASHBOARD_MAP_MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = mapMode === mode.id;

              return (
                <label
                  key={mode.id}
                  className={isActive ? 'dashboard-map-layer-chip active' : 'dashboard-map-layer-chip'}
                  title={`${mode.label} 보기`}
                >
                  <input
                    type="radio"
                    name="dashboard-map-mode"
                    checked={isActive}
                    onChange={() => setMapMode(mode.id)}
                  />
                  <Icon size={16} />
                  <span>{mode.label}</span>
                </label>
              );
            })}
          />
          <IncidentTimeline />
        </div>
        <aside className="right-rail">
          {mapMode === 'safeRoute' ? (
            <section className="panel dashboard-safe-route-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">안전 경로</span>
                  <h2>대피소 경로 안내</h2>
                </div>
                <RouteIcon size={20} />
              </div>
              <div className="route-summary">
                <div>
                  <MapPin size={18} aria-hidden="true" />
                  <span>선택 대피소</span>
                  <strong>{selectedShelter ? `${selectedShelter.name} · ${selectedShelter.distanceKm ?? '-'}km` : '대피소를 선택하세요'}</strong>
                </div>
                <div>
                  <RouteIcon size={18} aria-hidden="true" />
                  <span>경로 상태</span>
                  <strong>{activeRoute ? `예상 이동 ${formatDuration(activeRoute.durationSec)}` : '경로 안내 대기 중'}</strong>
                </div>
              </div>
              <ShelterList />
            </section>
          ) : null}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">AI 분석 요약</span>
                <h2>{headlineTitle}</h2>
              </div>
              <Droplets size={20} />
            </div>
            {highestRiskRegion ? (
              <div className="summary-stack">
                <div className="summary-row">
                  <span>지역</span>
                  <strong>{highestRiskRegion.regionName}</strong>
                </div>
                <div className="summary-row">
                  <span>위험 등급</span>
                  <strong>{highestRiskRegion.riskLabel ?? 'SAFE'}</strong>
                </div>
                <div className="summary-row">
                  <span>위험도</span>
                  <strong>{highestRiskRegion.riskScore}%</strong>
                </div>
              </div>
            ) : (
              <div className="summary-row">
                <span>상태</span>
                <strong>데이터 수집 중</strong>
              </div>
            )}
            {allStable ? <p className="model-label">전체 지역이 안정 상태입니다.</p> : null}
            <Link className="command-link dashboard-detail-link" to={`/risk-analysis?region=${encodeURIComponent(selectedRegion)}`}>
              자세히 보기
            </Link>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">우선 확인 대상</span>
                <h2>주요 위험 지역 TOP 3</h2>
              </div>
            </div>
            <div className="top-risk-list">
              {top3Regions.length > 0 ? (
                top3Regions.map((item) => (
                  <button
                    type="button"
                    className="summary-row top-risk-button"
                    key={item.regionName}
                    onClick={() => setSelectedRegion(item.regionName)}
                  >
                    <span>{item.regionName}</span>
                    <strong>
                      {item.riskLabel ?? 'SAFE'} · {item.riskScore}%
                    </strong>
                  </button>
                ))
              ) : (
                <div className="summary-row">
                  <span>상태</span>
                  <strong>데이터 수집 중</strong>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
