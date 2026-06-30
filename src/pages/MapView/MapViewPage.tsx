import { Activity, AlertTriangle, BarChart3, Bell, CheckSquare, ChevronLeft, ChevronRight, CloudRain, Droplets, FileText, Gauge, Layers, MapPin, PlayCircle, Route, Waves } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { KakaoMapPanel } from '../../features/kakao-map/KakaoMapPanel';
import { fetchRegionalStatus } from '../../shared/api/aiApi';
import { REGION_COORDINATES } from '../../shared/constants/regionCoordinates';
import { useDashboardStore } from '../../shared/store/dashboardStore';
import { useState } from 'react';

const CONTROL_LAYERS = [
  { id: 'regionalRisk', label: '지역별 위험도', icon: Activity },
  { id: 'waterLevel', label: '하수관로 수위', icon: Waves },
  { id: 'rainfall', label: '강우량 관측', icon: CloudRain },
  { id: 'safeRoute', label: '대피 경로', icon: Route },
] as const;

const MAP_NAV_LINKS = [
  { to: '/dashboard', label: '상황판', icon: Gauge },
  { to: '/risk-analysis', label: 'AI 분석', icon: Activity },
  { to: '/simulation', label: '시뮬레이션', icon: PlayCircle },
  { to: '/alerts', label: '경보', icon: AlertTriangle },
  { to: '/reports', label: '보고서', icon: FileText },
] as const;

type LayerId = (typeof CONTROL_LAYERS)[number]['id'];
type LayerVisibility = Record<LayerId, boolean>;

const RISK_STATUS_ROWS = [
  { id: 'weather', label: '기상청', valueKey: 'rainfall', unit: 'mm', icon: CloudRain },
  { id: 'drainage', label: '하수관로', valueKey: 'waterLevel', unit: '%', icon: Waves },
  { id: 'forecast', label: '예측 강수', valueKey: 'forecastRainfall1h', unit: 'mm', icon: Droplets },
  { id: 'warning', label: '현재 위기경보 단계', valueKey: 'riskScore', unit: '%', icon: Bell },
] as const;

const getSeverityLabel = (score = 0) => {
  if (score >= 80) return '심각';
  if (score >= 60) return '경계';
  if (score >= 40) return '주의';
  return '관심';
};

const getSeverityClassName = (score = 0) => {
  if (score >= 80) return 'danger';
  if (score >= 60) return 'warning';
  if (score >= 40) return 'watch';
  return 'normal';
};

const formatMetric = (value: number | undefined, unit: string) => (typeof value === 'number' ? `${value}${unit}` : '-');

export function MapViewPage() {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const incidents = useDashboardStore((state) => state.activeIncidents);
  const regionalStatusQuery = useQuery({
    queryKey: ['regional-status'],
    queryFn: fetchRegionalStatus,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const selectedStatus = regionalStatusQuery.data?.regionStatusMap?.[selectedRegion];
  const riskScore = selectedStatus?.riskScore ?? 0;
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    regionalRisk: true,
    waterLevel: true,
    rainfall: true,
    safeRoute: false,
  });

  const toggleLayer = (layerId: LayerId) => {
    setLayerVisibility((current) => ({
      ...current,
      [layerId]: !current[layerId],
    }));
  };

  return (
    <div className="map-view-page">
      <KakaoMapPanel
        className="map-view-fullscreen-map"
        height="calc(100vh - 60px)"
        layerVisibility={layerVisibility}
      />

      <nav className={isNavCollapsed ? 'map-view-app-nav collapsed' : 'map-view-app-nav'} aria-label="페이지 이동">
        <div className="map-view-app-brand">
          <strong>OASIS</strong>
          <span>지도 관제</span>
        </div>
        <div className="map-view-nav-links">
          {MAP_NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const target = item.to === '/risk-analysis' ? `${item.to}?region=${encodeURIComponent(selectedRegion)}` : item.to;

            return (
              <Link key={item.to} to={target} title={item.label}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          className="map-view-nav-toggle"
          aria-label={isNavCollapsed ? '페이지 메뉴 펼치기' : '페이지 메뉴 접기'}
          aria-expanded={!isNavCollapsed}
          onClick={() => setIsNavCollapsed((current) => !current)}
        >
          {isNavCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </nav>

      <aside className={isSidePanelCollapsed ? 'map-view-side-panel collapsed' : 'map-view-side-panel'} aria-label="종합 상황 목록">
        <button
          type="button"
          className="map-view-panel-toggle"
          aria-label={isSidePanelCollapsed ? '상황 패널 펼치기' : '상황 패널 접기'}
          aria-expanded={!isSidePanelCollapsed}
          onClick={() => setIsSidePanelCollapsed((current) => !current)}
        >
          {isSidePanelCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className="map-view-side-heading">
          <span>종합 상황 모니터링</span>
          <strong>{selectedRegion}</strong>
        </div>

        <section className="map-view-side-section">
          <div className="map-view-section-title">
            <Activity size={16} />
            <strong>위험도 현황</strong>
          </div>
          <div className="map-view-risk-score">
            <span>현재 위험도</span>
            <strong>{riskScore}%</strong>
            <em className={`map-view-severity ${getSeverityClassName(riskScore)}`}>{getSeverityLabel(riskScore)}</em>
          </div>
          <div className="map-view-status-list">
            {RISK_STATUS_ROWS.map((row) => {
              const Icon = row.icon;
              const value = selectedStatus?.[row.valueKey];
              const score = typeof value === 'number' ? value : riskScore;

              return (
                <div className="map-view-status-row" key={row.id}>
                  <span>
                    <Icon size={15} />
                    {row.label}
                  </span>
                  <strong>{formatMetric(value, row.unit)}</strong>
                  <em className={`map-view-severity ${getSeverityClassName(score)}`}>{getSeverityLabel(score)}</em>
                </div>
              );
            })}
          </div>
          <Link className="map-view-decision-link" to={`/risk-analysis?region=${encodeURIComponent(selectedRegion)}`}>
            <CheckSquare size={15} />
            의사결정 바로가기
          </Link>
        </section>

        <section className="map-view-side-section">
          <div className="map-view-section-title">
            <CloudRain size={16} />
            <strong>단기예보</strong>
          </div>
          <div className="map-view-forecast-box">
            <div><span>예보 시간</span><strong>{selectedStatus?.timestamp ? new Date(selectedStatus.timestamp).toLocaleString('ko-KR') : '-'}</strong></div>
            <div><span>강수량</span><strong>{formatMetric(selectedStatus?.rainfall, 'mm')}</strong></div>
            <div><span>1시간 예측</span><strong>{formatMetric(selectedStatus?.forecastRainfall1h, 'mm')}</strong></div>
            <div><span>관측소</span><strong>{selectedStatus?.rainfallStation ?? '-'}</strong></div>
          </div>
        </section>

        <section className="map-view-side-section">
          <div className="map-view-section-title">
            <AlertTriangle size={16} />
            <strong>주요 경보</strong>
          </div>
          <div className="map-view-incident-list">
            {incidents.map((incident) => (
              <div className="map-view-incident-row" key={incident.id}>
                <span>{incident.district}</span>
                <strong>{incident.summary}</strong>
                <em>{incident.reportedAt}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="map-view-side-section">
          <div className="map-view-section-title">
            <Layers size={16} />
            <strong>표시 레이어</strong>
          </div>
          <div className="map-view-layer-list">
            {CONTROL_LAYERS.map((layer) => {
              const Icon = layer.icon;
              return (
                <button
                  type="button"
                  key={`panel-${layer.id}`}
                  className={layerVisibility[layer.id] ? 'map-view-layer-row active' : 'map-view-layer-row'}
                  onClick={() => toggleLayer(layer.id)}
                >
                  <Icon size={15} />
                  <span>{layer.label}</span>
                  <strong>{layerVisibility[layer.id] ? 'ON' : 'OFF'}</strong>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      <div className="map-view-floating-topbar" aria-label="지도 도구">
        <div className="map-view-title-chip">
          <MapPin size={17} />
          <strong>{selectedRegion}</strong>
        </div>

        <label className="map-view-region-select">
          <span>지역</span>
          <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)}>
            {REGION_COORDINATES.map((region) => (
              <option key={region.name} value={region.name}>
                {region.name}
              </option>
            ))}
          </select>
        </label>

        <div className="map-view-layer-toolbar" aria-label="레이어 표시 항목">
          {CONTROL_LAYERS.map((layer) => {
            const Icon = layer.icon;
            return (
              <button
                type="button"
                key={layer.id}
                className={layerVisibility[layer.id] ? 'map-view-tool-button active' : 'map-view-tool-button'}
                aria-pressed={layerVisibility[layer.id]}
                title={layer.label}
                onClick={() => toggleLayer(layer.id)}
              >
                <Icon size={17} />
                <span>{layer.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="map-view-floating-actions" aria-label="지도 바로가기">
        <Link to={`/risk-analysis?region=${encodeURIComponent(selectedRegion)}`} title="실시간 예측 정보">
          <BarChart3 size={18} />
          <span>예측</span>
        </Link>
        <Link to="/simulation" title="침수 시나리오">
          <PlayCircle size={18} />
          <span>시나리오</span>
        </Link>
        <Link to="/alerts" title="운영 지원">
          <AlertTriangle size={18} />
          <span>운영</span>
        </Link>
      </div>

    </div>
  );
}

export default MapViewPage;
