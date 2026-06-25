import { Fragment, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CustomOverlayMap, Map as KakaoMap, Polygon, useKakaoLoader } from 'react-kakao-maps-sdk';
import { useNavigate } from 'react-router-dom';
import { fetchRegionalStatus, LiveStatusResponse, RegionalStatusResponse, RiskLabel } from '../../shared/api/aiApi';
import { REGION_COORDINATES, findRegionCoordinate } from '../../shared/constants/regionCoordinates';
import { SEOUL_DISTRICT_BOUNDARIES } from '../../shared/constants/seoulDistrictBoundaries';
import { useDashboardStore } from '../../shared/store/dashboardStore';

declare global {
  interface Window {
    kakao: any;
  }
}

const RISK_MARKER_COLOR: Record<RiskLabel, string> = {
  SAFE: '#16a34a',
  CAUTION: '#eab308',
  WARNING: '#f97316',
  DANGER: '#dc2626',
};
const DATA_UNAVAILABLE_COLOR = '#94a3b8';

const DATA_STATUS_LABEL: Record<string, string> = {
  REALTIME: '실시간',
  PARTIAL: '일부 수집',
  FALLBACK: 'fallback',
  UNAVAILABLE: '계산 불가',
};

const toRiskLabel = (status?: LiveStatusResponse): RiskLabel => {
  if (status?.riskLabel === 'SAFE' || status?.riskLabel === 'CAUTION' || status?.riskLabel === 'WARNING' || status?.riskLabel === 'DANGER') {
    return status.riskLabel;
  }

  const score = status?.riskScore ?? 0;
  if (score >= 80) return 'DANGER';
  if (score >= 60) return 'WARNING';
  if (score >= 40) return 'CAUTION';
  return 'SAFE';
};

const formatNumber = (value: number | undefined, unit: string) => (typeof value === 'number' ? `${value}${unit}` : '-');
const DISTRICT_BOUNDARY_MAP = new Map(SEOUL_DISTRICT_BOUNDARIES.map((boundary) => [boundary.name, boundary.paths]));

interface RegionRiskMapPanelProps {
  className?: string;
  height?: string;
}

function useRegionalStatus() {
  return useQuery({
    queryKey: ['regional-status'],
    queryFn: fetchRegionalStatus,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

function RegionRiskMapContent({ className = '', height, isKakaoReady }: RegionRiskMapPanelProps & { isKakaoReady: boolean }) {
  const navigate = useNavigate();
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const [activeInfoRegion, setActiveInfoRegion] = useState<string | null>(null);
  const { data: regionalStatus, isFetching, isError } = useRegionalStatus();

  const regionItems = useMemo(
    () =>
      REGION_COORDINATES.map((coordinate) => {
        const status = regionalStatus?.regionStatusMap?.[coordinate.name];
        const riskLabel = toRiskLabel(status);
        return {
          ...coordinate,
          boundaryPaths: DISTRICT_BOUNDARY_MAP.get(coordinate.name) ?? [],
          status,
          riskLabel,
          markerColor: status?.dataStatus === 'FALLBACK' || status?.dataStatus === 'UNAVAILABLE' ? DATA_UNAVAILABLE_COLOR : RISK_MARKER_COLOR[riskLabel],
        };
      }),
    [regionalStatus],
  );

  const center = findRegionCoordinate(selectedRegion);
  const activeItem = activeInfoRegion ? regionItems.find((item) => item.name === activeInfoRegion) : null;

  const selectRegion = (regionName: string) => {
    setSelectedRegion(regionName);
  };

  const openRiskAnalysis = (regionName: string) => {
    selectRegion(regionName);
    navigate(`/risk-analysis?region=${encodeURIComponent(regionName)}`);
  };

  if (!isKakaoReady) {
    return (
      <section className={`map-surface region-risk-map ${className}`} style={height ? { height } : undefined}>
        <div className="region-map-fallback">
          <strong>지도 SDK를 불러오는 중입니다.</strong>
          <span>지역별 위험도 데이터는 아래 목록에서 먼저 확인할 수 있습니다.</span>
          <div className="region-fallback-list">
            {regionItems.map((item) => (
              <button
                type="button"
                key={item.name}
                className={item.name === selectedRegion ? 'region-fallback-button active' : 'region-fallback-button'}
                onClick={() => selectRegion(item.name)}
              >
                <span className="region-risk-dot" style={{ background: item.markerColor }} />
                {item.name}
                <strong>{item.riskLabel}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`map-surface region-risk-map ${className}`} style={height ? { height } : undefined} aria-label="지역별 침수 위험도 지도">
      <KakaoMap center={{ lat: center.lat, lng: center.lng }} isPanto level={8} style={{ width: '100%', height: '100%' }}>
        {regionItems.map((item) => (
          <Fragment key={item.name}>
            {item.boundaryPaths.map((path, pathIndex) => (
              <Polygon
                key={`${item.name}-${pathIndex}`}
                path={path}
                strokeWeight={item.name === activeInfoRegion || item.name === selectedRegion ? 3 : 2}
                strokeColor={item.markerColor}
                strokeOpacity={item.name === activeInfoRegion ? 0.95 : 0}
                fillColor={item.markerColor}
                fillOpacity={item.name === activeInfoRegion ? 0.24 : 0}
                zIndex={item.name === activeInfoRegion || item.name === selectedRegion ? 5 : 1}
                onMouseover={() => setActiveInfoRegion(item.name)}
                onMouseout={() => setActiveInfoRegion(null)}
                onClick={() => selectRegion(item.name)}
              />
            ))}
            <CustomOverlayMap position={{ lat: item.lat, lng: item.lng }} clickable yAnchor={0.9} zIndex={item.name === selectedRegion ? 4 : 2}>
              <button
                type="button"
                className={item.name === activeInfoRegion || item.name === selectedRegion ? 'region-risk-marker active' : 'region-risk-marker'}
                style={{ '--marker-color': item.markerColor } as CSSProperties}
                onMouseEnter={() => setActiveInfoRegion(item.name)}
                onMouseLeave={() => setActiveInfoRegion(null)}
                onClick={() => selectRegion(item.name)}
              >
                <span>{item.name}</span>
                <strong>{item.status?.riskScore ?? 0}%</strong>
              </button>
            </CustomOverlayMap>
          </Fragment>
        ))}

        {activeItem ? (
          <CustomOverlayMap position={{ lat: activeItem.lat, lng: activeItem.lng }} clickable yAnchor={1.15} zIndex={10}>
            <div
              className="region-info-window"
              onMouseEnter={() => setActiveInfoRegion(activeItem.name)}
              onMouseLeave={() => setActiveInfoRegion(null)}
            >
              <div className="region-info-heading">
                <strong>{activeItem.name}</strong>
                <span style={{ background: activeItem.markerColor }}>{activeItem.riskLabel}</span>
              </div>
              <div className="region-info-grid">
                <span>위험 점수</span>
                <strong>{activeItem.status?.riskScore ?? 0}%</strong>
                <span>강우량</span>
                <strong>{formatNumber(activeItem.status?.rainfall, 'mm')}</strong>
                <span>하수관로 수위</span>
                <strong>{formatNumber(activeItem.status?.waterLevel, '%')}</strong>
              </div>
              {activeItem.status?.dataStatus === 'PARTIAL' ? (
                <p className="model-label">일부 데이터가 수집되지 않아 분석 신뢰도가 낮습니다.</p>
              ) : null}
              {activeItem.status?.dataStatus === 'FALLBACK' || activeItem.status?.dataStatus === 'UNAVAILABLE' ? (
                <p className="model-label">해당 지역은 현재 실시간 데이터가 부족하여 AI 위험도 분석을 제공할 수 없습니다.</p>
              ) : null}
              {activeItem.status?.dataStatus === 'REALTIME' ? <p className="model-label">실시간 API 기반 분석</p> : null}
              <button type="button" className="region-info-action" onClick={() => openRiskAnalysis(activeItem.name)}>
                상세 분석 보기
              </button>
            </div>
          </CustomOverlayMap>
        ) : null}
      </KakaoMap>

      <div className="map-legend region-risk-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.SAFE }} />SAFE</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.CAUTION }} />CAUTION</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.WARNING }} />WARNING</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.DANGER }} />DANGER</span>
      </div>
      {isFetching ? <div className="region-map-error">데이터 갱신 중</div> : null}
      {isError ? <div className="region-map-error">지역별 위험도 데이터를 불러오지 못했습니다.</div> : null}
    </section>
  );
}

function RegionRiskMapWithLoader(props: RegionRiskMapPanelProps) {
  const kakaoMapKey = import.meta.env.VITE_KAKAO_MAP_KEY ?? '';
  const [kakaoLoading, kakaoError] = useKakaoLoader({
    appkey: kakaoMapKey,
    libraries: ['services', 'clusterer'],
  });

  if (!kakaoMapKey) {
    return (
      <section className={`map-surface region-risk-map ${props.className ?? ''}`} style={props.height ? { height: props.height } : undefined}>
        <div className="region-map-fallback">
          <strong>카카오 지도 키가 설정되지 않았습니다.</strong>
          <span>.env.local의 VITE_KAKAO_MAP_KEY를 확인하세요.</span>
        </div>
      </section>
    );
  }

  if (kakaoError) {
    return (
      <section className={`map-surface region-risk-map ${props.className ?? ''}`} style={props.height ? { height: props.height } : undefined}>
        <div className="region-map-fallback">
          <strong>카카오 지도를 불러오지 못했습니다.</strong>
          <span>지도 SDK 설정을 확인하세요.</span>
        </div>
      </section>
    );
  }

  return <RegionRiskMapContent {...props} isKakaoReady={!kakaoLoading} />;
}

export function RegionRiskMapPanel(props: RegionRiskMapPanelProps) {
  if (typeof window !== 'undefined' && window.kakao?.maps) {
    return <RegionRiskMapContent {...props} isKakaoReady />;
  }

  return <RegionRiskMapWithLoader {...props} />;
}
