import { Activity, AlertTriangle, Clock, Database, Droplets, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { IncidentTimeline } from '../../features/alert-system/IncidentTimeline';
import { KakaoMapPanel } from '../../features/kakao-map/KakaoMapPanel';
import { SensorStatusPanel } from '../../features/sensor-monitor/SensorStatusPanel';
import { fetchRegionalStatus, LiveStatusResponse, RegionalStatusResponse } from '../../shared/api/aiApi';
import { AppShell } from '../../shared/components/AppShell';
import { MetricTile } from '../../shared/components/MetricTile';
import { useDashboardStore } from '../../shared/store/dashboardStore';

type RankedRegion = LiveStatusResponse & {
  regionName: string;
  riskScore: number;
};

const formatTimestamp = (timestamp?: string | null) => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

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
  const highestRiskLabel = highestRiskRegion?.riskLabel ?? 'SAFE';
  const allStable = hasRegionalData && (highestRiskRegion?.riskScore ?? 0) < 40;
  const headlineTitle = hasRegionalData
    ? allStable
      ? '상대적 최고 지역'
      : '현재 최고 위험 지역'
    : '데이터 수집 중';
  const dataStatus = hasRegionalData ? '수집 중' : '데이터 수집 중';
  const lastUpdated = highestRiskRegion?.timestamp ?? regionalStatus?.timestamp;

  return (
    <AppShell>
      <div className="dashboard-layout">
        <section className="overview-strip">
          <MetricTile
            label="전체 위험 상태"
            value={hasRegionalData ? highestRiskLabel : '수집 중'}
            tone={highestRiskLabel === 'DANGER' ? 'danger' : highestRiskLabel === 'SAFE' ? 'neutral' : 'warning'}
            icon={<Activity size={18} />}
          />
          <MetricTile label="현재 선택 지역" value={selectedRegion} icon={<MapPin size={18} />} />
          <MetricTile label="활성 경보 수" value={`${incidents.length}건`} tone="danger" icon={<AlertTriangle size={18} />} />
          <MetricTile label="데이터 수집 상태" value={dataStatus} icon={<Database size={18} />} />
          <MetricTile label="마지막 업데이트" value={formatTimestamp(lastUpdated)} icon={<Clock size={18} />} />
        </section>

        <div className="main-grid">
          <div className="map-column">
            <KakaoMapPanel />
            <IncidentTimeline />
          </div>
          <aside className="right-rail">
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
              {allStable ? <p className="model-label">전체 지역 안정 상태입니다.</p> : null}
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

            <SensorStatusPanel />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
