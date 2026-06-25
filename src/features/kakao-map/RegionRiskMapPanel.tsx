import { Fragment, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CustomOverlayMap, Map as KakaoMap, Polygon, useKakaoLoader } from 'react-kakao-maps-sdk';
import { useNavigate } from 'react-router-dom';
import { fetchRegionalStatus, LiveStatusResponse, RiskForecastPoint, RiskLabel } from '../../shared/api/aiApi';
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

const RISK_LABEL_KO: Record<RiskLabel, string> = {
  SAFE: '안전',
  CAUTION: '관심',
  WARNING: '주의',
  DANGER: '위험',
};

const DATA_STATUS_LABEL: Record<string, string> = {
  REALTIME: '실시간',
  PARTIAL: '일부 수집',
  FALLBACK: 'fallback',
  UNAVAILABLE: '계산 불가',
};

const TIME_LABELS = ['현재', '+1시간', '+2시간', '+3시간'] as const;

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

interface TimeData {
  riskScore: number;
  riskLabel: RiskLabel;
  rainfall: number | undefined;
  waterLevel: number | undefined;
  hasForecast: boolean;
}

function getDataAtTime(status: LiveStatusResponse | undefined, index: number): TimeData {
  const base: TimeData = {
    riskScore: status?.riskScore ?? 0,
    riskLabel: toRiskLabel(status),
    rainfall: status?.rainfall,
    waterLevel: status?.waterLevel,
    hasForecast: index === 0,
  };
  if (!status || index === 0) return { ...base, hasForecast: true };
  const point: RiskForecastPoint | undefined = status.points?.[index - 1];
  if (!point) return base;
  return {
    riskScore: Math.round(point.risk),
    riskLabel: point.riskLabel,
    rainfall: point.rainfall,
    waterLevel: status.waterLevel,
    hasForecast: true,
  };
}

const formatNumber = (value: number | undefined, unit: string) => (typeof value === 'number' ? `${value}${unit}` : '-');
const DISTRICT_BOUNDARY_MAP = new Map(SEOUL_DISTRICT_BOUNDARIES.map((boundary) => [boundary.name, boundary.paths]));

const formatForecastRainfall = (status?: LiveStatusResponse) => {
  const values = [status?.forecastRainfall1h, status?.forecastRainfall2h, status?.forecastRainfall3h].filter(
    (value): value is number => typeof value === 'number',
  );
  if (!values.length) return '-';
  return `${Math.max(...values)}mm`;
};

interface RegionRiskMapPanelProps {
  className?: string;
  height?: string;
  layerVisibility?: {
    regionalRisk: boolean;
    waterLevel: boolean;
    rainfall: boolean;
  };
}

const defaultLayerVisibility = {
  regionalRisk: true,
  waterLevel: true,
  rainfall: true,
};

function useRegionalStatus() {
  return useQuery({
    queryKey: ['regional-status'],
    queryFn: fetchRegionalStatus,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

function RegionRiskMapContent({ className = '', height, isKakaoReady, layerVisibility }: RegionRiskMapPanelProps & { isKakaoReady: boolean }) {
  const navigate = useNavigate();
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const [activeInfoRegion, setActiveInfoRegion] = useState<string | null>(null);
  const [timeIndex, setTimeIndex] = useState(0);
  const { data: regionalStatus, isFetching, isError } = useRegionalStatus();
  const layers = { ...defaultLayerVisibility, ...layerVisibility };

  const regionItems = useMemo(
    () =>
      REGION_COORDINATES.map((coordinate) => {
        const status = regionalStatus?.regionStatusMap?.[coordinate.name];
        const timeData = getDataAtTime(status, timeIndex);
        return {
          ...coordinate,
          boundaryPaths: DISTRICT_BOUNDARY_MAP.get(coordinate.name) ?? [],
          status,
          timeData,
          riskLabel: timeData.riskLabel,
          markerColor: status?.dataStatus === 'FALLBACK' || status?.dataStatus === 'UNAVAILABLE'
            ? DATA_UNAVAILABLE_COLOR
            : RISK_MARKER_COLOR[timeData.riskLabel],
        };
      }),
    [regionalStatus, timeIndex],
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

  const openSafeRoute = (regionName: string) => {
    selectRegion(regionName);
    navigate(`/safe-route?region=${encodeURIComponent(regionName)}`);
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
        {layers.regionalRisk ? regionItems.map((item) => (
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
                <strong>{item.timeData.riskScore}%</strong>
              </button>
            </CustomOverlayMap>
          </Fragment>
        )) : null}
      </KakaoMap>

      {activeItem && layers.regionalRisk ? (
        <div
          className="region-info-window region-info-floating"
          onMouseEnter={() => setActiveInfoRegion(activeItem.name)}
          onMouseLeave={() => setActiveInfoRegion(null)}
        >
          <div className="region-info-heading">
            <strong>{activeItem.name}</strong>
            <span style={{ background: activeItem.markerColor }}>{RISK_LABEL_KO[activeItem.riskLabel]}</span>
            {timeIndex > 0 && <span className="region-info-time-badge">{TIME_LABELS[timeIndex]} 예측</span>}
          </div>
          <div className="region-info-grid">
            <span>위험도 점수</span>
            <strong>{activeItem.timeData.riskScore}%</strong>
            <span>강우량</span>
            <strong>{formatNumber(activeItem.timeData.rainfall, 'mm')}</strong>
            <span>하수관로 수위</span>
            <strong>{formatNumber(activeItem.timeData.waterLevel, '%')}</strong>
            <span>예보 강수량</span>
            <strong>{formatForecastRainfall(activeItem.status)}</strong>
            <span>데이터 출처</span>
            <strong>{activeItem.status?.source ?? DATA_STATUS_LABEL[activeItem.status?.dataStatus ?? 'UNAVAILABLE'] ?? '-'}</strong>
          </div>
          <div className="region-info-actions">
            <button type="button" className="region-info-action" onClick={() => openRiskAnalysis(activeItem.name)}>
              AI 상세 분석 보기
            </button>
            <button type="button" className="region-info-action secondary" onClick={() => openSafeRoute(activeItem.name)}>
              주변 대피소/안전 경로 보기
            </button>
          </div>
        </div>
      ) : null}

      {/* 시간대 슬라이더 */}
      <div className="time-slider-panel">
        <span className="time-slider-heading">
          예측 시간대
          {timeIndex > 0 && <em className="time-slider-forecast-badge">AI 예측</em>}
        </span>
        <div className="time-step-buttons">
          {TIME_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`time-step-button${timeIndex === i ? ' active' : ''}`}
              onClick={() => setTimeIndex(i)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="map-legend region-risk-legend">
        <strong>위험도</strong>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.SAFE }} />안전</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.CAUTION }} />관심</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.WARNING }} />주의</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.DANGER }} />위험</span>
      </div>
      {!layers.regionalRisk ? <div className="region-map-layer-notice">지역별 위험도 레이어가 꺼져 있습니다.</div> : null}
      {isFetching ? <div className="region-map-error">데이터 갱신 중</div> : null}
      {isError ? <div className="region-map-error">지역별 위험도 데이터를 불러오지 못했습니다.</div> : null}
    </section>
  );
}

function RegionRiskMapFallback(props: RegionRiskMapPanelProps) {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const { data: regionalStatus } = useRegionalStatus();

  const regionItems = REGION_COORDINATES.map((coordinate) => {
    const status = regionalStatus?.regionStatusMap?.[coordinate.name];
    const riskLabel = toRiskLabel(status);
    return {
      ...coordinate,
      status,
      riskLabel,
      markerColor: status?.dataStatus === 'FALLBACK' || status?.dataStatus === 'UNAVAILABLE' ? DATA_UNAVAILABLE_COLOR : RISK_MARKER_COLOR[riskLabel],
    };
  });

  return (
    <section className={`map-surface region-risk-map ${props.className ?? ''}`} style={props.height ? { height: props.height } : undefined}>
      <div className="region-map-fallback">
        <strong>카카오 지도 키가 설정되지 않아 지도 화면을 표시할 수 없습니다.</strong>
        <span>지역 목록에서 분석 기준 지역을 선택할 수 있습니다.</span>
        <div className="region-fallback-list">
          {regionItems.map((item) => (
            <button
              type="button"
              key={item.name}
              className={item.name === selectedRegion ? 'region-fallback-button active' : 'region-fallback-button'}
              onClick={() => setSelectedRegion(item.name)}
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

function RegionRiskMapLoaderContent(props: RegionRiskMapPanelProps & { kakaoMapKey: string }) {
  const [kakaoLoading, kakaoError] = useKakaoLoader({
    appkey: props.kakaoMapKey,
    libraries: ['services', 'clusterer'],
  });

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

function RegionRiskMapWithLoader(props: RegionRiskMapPanelProps) {
  const kakaoMapKey = import.meta.env.VITE_KAKAO_MAP_KEY ?? '';

  if (!kakaoMapKey) {
    return <RegionRiskMapFallback {...props} />;
  }

  return <RegionRiskMapLoaderContent {...props} kakaoMapKey={kakaoMapKey} />;
}

export function RegionRiskMapPanel(props: RegionRiskMapPanelProps) {
  if (typeof window !== 'undefined' && window.kakao?.maps) {
    return <RegionRiskMapContent {...props} isKakaoReady />;
  }

  return <RegionRiskMapWithLoader {...props} />;
}
