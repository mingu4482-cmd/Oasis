import { Fragment, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Circle, CustomOverlayMap, Map as KakaoMap, Polygon, Polyline, useKakaoLoader } from 'react-kakao-maps-sdk';
import { useNavigate } from 'react-router-dom';
import { useSafeRouteStore } from '../safe-route/safeRouteStore';
import { fetchRegionalStatus, LiveStatusResponse, RiskLabel } from '../../shared/api/aiApi';
import { EXTERNAL_SENSOR_API_BASE_URL } from '../../shared/api/externalApi';
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
const SENSOR_API_ERROR_MESSAGE = '외부 하수관로 센서 API에 연결할 수 없습니다.';

const RISK_LABEL_KO: Record<RiskLabel, string> = {
  SAFE: '안전',
  CAUTION: '관심',
  WARNING: '주의',
  DANGER: '위험',
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

interface Manhole {
  locationId: number;
  name: string;
  latitude: number;
  longitude: number;
  waterLevel: number;
}

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
  fallbackDescription?: string;
  fallbackTitle?: string;
  mapControls?: ReactNode;
  layerVisibility?: {
    regionalRisk: boolean;
    waterLevel: boolean;
    rainfall: boolean;
    safeRoute?: boolean;
  };
}

const defaultLayerVisibility = {
  regionalRisk: true,
  waterLevel: true,
  rainfall: true,
  safeRoute: false,
};

function useRegionalStatus() {
  return useQuery({
    queryKey: ['regional-status'],
    queryFn: fetchRegionalStatus,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

function useManholes(enabled: boolean) {
  return useQuery({
    queryKey: ['external-manholes'],
    queryFn: async () => {
      const response = await fetch(`${EXTERNAL_SENSOR_API_BASE_URL}/api/manholes`);
      if (!response.ok) throw new Error(SENSOR_API_ERROR_MESSAGE);
      const data = (await response.json()) as Manhole[];

      return data.filter((manhole) => (
        typeof manhole.latitude === 'number'
        && typeof manhole.longitude === 'number'
        && manhole.latitude !== 0
        && manhole.longitude !== 0
      ));
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
  });
}

const getManholeColor = (waterLevel: number) => {
  if (waterLevel >= 90) return '#dc2626';
  if (waterLevel >= 60) return '#f97316';
  if (waterLevel >= 30) return '#eab308';
  return '#16a34a';
};

const getManholeLevelLabel = (waterLevel: number) => {
  if (waterLevel >= 90) return '심각';
  if (waterLevel >= 60) return '경계';
  if (waterLevel >= 30) return '주의';
  return '정상';
};

const SHELTER_STATUS_COLOR: Record<string, string> = {
  '운영 중': '#0f766e',
  '대기': '#b45309',
  '만원': '#dc2626',
};

const RADIUS_OPTIONS = [0.5, 1, 2] as const;
const RADIUS_LABEL: Record<number, string> = { 0.5: '500m', 1: '1km', 2: '2km' };
const MAP_DISPLAY_RADIUS_KM = 10;
const SELECTED_REGION_LAYER_RADIUS_KM = 4;
const FALLBACK_MAP_BOUNDS = {
  minLat: 37.46,
  maxLat: 37.58,
  minLng: 126.84,
  maxLng: 127.1,
};
const OSM_FALLBACK_ZOOM = 12;

function latLngToTilePoint(lat: number, lng: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  const scale = 2 ** zoom;

  return {
    x: ((lng + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  };
}

function buildFallbackTiles(lat: number, lng: number) {
  const center = latLngToTilePoint(lat, lng, OSM_FALLBACK_ZOOM);
  const centerX = Math.floor(center.x);
  const centerY = Math.floor(center.y);
  const tiles = [];

  for (let y = -4; y <= 4; y += 1) {
    for (let x = -5; x <= 5; x += 1) {
      const tileX = centerX + x;
      const tileY = centerY + y;
      tiles.push({
        key: `${OSM_FALLBACK_ZOOM}-${tileX}-${tileY}`,
        src: `https://tile.openstreetmap.org/${OSM_FALLBACK_ZOOM}/${tileX}/${tileY}.png`,
        left: `calc(50% + ${(tileX - center.x) * 256}px)`,
        top: `calc(50% + ${(tileY - center.y) * 256}px)`,
      });
    }
  }

  return tiles;
}

function calcDistKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function RegionRiskMapContent({ className = '', height, isKakaoReady, layerVisibility, mapControls }: RegionRiskMapPanelProps & { isKakaoReady: boolean }) {
  const navigate = useNavigate();
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const [activeInfoRegion, setActiveInfoRegion] = useState<string | null>(null);
  const [selectedManholeId, setSelectedManholeId] = useState<number | null>(null);
  const { data: regionalStatus, isFetching, isError } = useRegionalStatus();
  const layers = { ...defaultLayerVisibility, ...layerVisibility };
  const { data: manholes = [], isError: isManholeError } = useManholes(layers.waterLevel);
  const shelters = useSafeRouteStore((state) => state.shelters);
  const selectedShelterId = useSafeRouteStore((state) => state.selectedShelterId);
  const activeRoute = useSafeRouteStore((state) => state.activeRoute);
  const currentLocation = useSafeRouteStore((state) => state.currentLocation);
  const radiusFilter = useSafeRouteStore((state) => state.radiusFilter);
  const isLocating = useSafeRouteStore((state) => state.isLocating);
  const selectShelter = useSafeRouteStore((state) => state.selectShelter);
  const fetchCurrentLocation = useSafeRouteStore((state) => state.fetchCurrentLocation);
  const fetchShelters = useSafeRouteStore((state) => state.fetchShelters);
  const setRadiusFilter = useSafeRouteStore((state) => state.setRadiusFilter);

  useEffect(() => {
    if (!layers.safeRoute) return;
    fetchShelters().catch(() => {});
    if (!currentLocation) {
      fetchCurrentLocation().catch(() => {});
    }
  }, [currentLocation, fetchCurrentLocation, fetchShelters, layers.safeRoute]);

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
          markerColor: status?.dataStatus === 'FALLBACK' || status?.dataStatus === 'UNAVAILABLE'
            ? DATA_UNAVAILABLE_COLOR
            : RISK_MARKER_COLOR[riskLabel],
        };
      }),
    [regionalStatus],
  );

  const selectedRegionCenter = findRegionCoordinate(selectedRegion);
  const center = selectedRegionCenter;
  const activeItemName = activeInfoRegion ?? selectedRegion;
  const activeItem = regionItems.find((item) => item.name === activeItemName) ?? null;
  const visibleManholes = useMemo(() => {
    if (!layers.waterLevel) return [];
    return manholes.filter((manhole) => (
      calcDistKm(selectedRegionCenter.lat, selectedRegionCenter.lng, manhole.latitude, manhole.longitude) <= SELECTED_REGION_LAYER_RADIUS_KM
    ));
  }, [layers.waterLevel, manholes, selectedRegionCenter.lat, selectedRegionCenter.lng]);
  const selectedManhole = layers.waterLevel
    ? visibleManholes.find((manhole) => manhole.locationId === selectedManholeId) ?? null
    : null;
  const visibleShelters = useMemo(() => {
    if (!layers.safeRoute) return [];
    return shelters.filter((shelter) => {
      const regionDistance = calcDistKm(selectedRegionCenter.lat, selectedRegionCenter.lng, shelter.lat, shelter.lng);
      if (regionDistance > SELECTED_REGION_LAYER_RADIUS_KM) return false;
      if (shelter.id === selectedShelterId) return true;
      if (!currentLocation) return true;
      const locationDistance = calcDistKm(currentLocation.lat, currentLocation.lng, shelter.lat, shelter.lng);
      return locationDistance <= (radiusFilter ?? MAP_DISPLAY_RADIUS_KM);
    });
  }, [currentLocation, layers.safeRoute, radiusFilter, selectedRegionCenter.lat, selectedRegionCenter.lng, selectedShelterId, shelters]);
  const inRangeCount = layers.safeRoute && radiusFilter && currentLocation
    ? visibleShelters.filter((shelter) => calcDistKm(currentLocation.lat, currentLocation.lng, shelter.lat, shelter.lng) <= radiusFilter).length
    : null;

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
                <strong>{item.status?.riskScore ?? 0}%</strong>
              </button>
            </CustomOverlayMap>
          </Fragment>
        )) : null}
        {layers.waterLevel ? visibleManholes
          .filter((manhole) => manhole.waterLevel >= 30)
          .map((manhole) => {
            const markerColor = getManholeColor(manhole.waterLevel);

            return (
              <Circle
                key={`manhole-zone-${manhole.locationId}`}
                center={{ lat: manhole.latitude, lng: manhole.longitude }}
                radius={360}
                strokeWeight={1}
                strokeColor={markerColor}
                strokeOpacity={0.25}
                fillColor={markerColor}
                fillOpacity={0.15}
                zIndex={1}
              />
            );
          }) : null}
        {layers.waterLevel ? visibleManholes.map((manhole) => {
          const markerColor = getManholeColor(manhole.waterLevel);

          return (
            <CustomOverlayMap
              key={`manhole-marker-${manhole.locationId}`}
              position={{ lat: manhole.latitude, lng: manhole.longitude }}
              clickable
              yAnchor={0.5}
              zIndex={6}
            >
              <button
                type="button"
                className="manhole-map-marker"
                style={{ '--manhole-color': markerColor } as CSSProperties}
                title={`${manhole.name} / 현재 수위: ${manhole.waterLevel}cm`}
                onClick={() => setSelectedManholeId((current) => (current === manhole.locationId ? null : manhole.locationId))}
              >
                <span className="sr-only">{manhole.name}</span>
              </button>
            </CustomOverlayMap>
          );
        }) : null}
        {layers.safeRoute && currentLocation && radiusFilter ? (
          <Circle
            center={{ lat: currentLocation.lat, lng: currentLocation.lng }}
            radius={radiusFilter * 1000}
            strokeWeight={2}
            strokeColor="#0f766e"
            strokeOpacity={0.65}
            strokeStyle="dashed"
            fillColor="#0f766e"
            fillOpacity={0.06}
            zIndex={2}
          />
        ) : null}
        {layers.safeRoute && activeRoute?.path.length ? (
          <Polyline
            path={activeRoute.path}
            strokeWeight={5}
            strokeColor={activeRoute.mode === 'CAR' ? '#0f766e' : '#2563eb'}
            strokeOpacity={0.86}
            strokeStyle="solid"
            zIndex={7}
          />
        ) : null}
        {layers.safeRoute && currentLocation ? (
          <CustomOverlayMap position={{ lat: currentLocation.lat, lng: currentLocation.lng }} clickable yAnchor={1.3} zIndex={8}>
            <div className="safe-route-current-marker">현재 위치</div>
          </CustomOverlayMap>
        ) : null}
        {layers.safeRoute ? visibleShelters.map((shelter) => {
          const isSelected = shelter.id === selectedShelterId;
          const markerColor = SHELTER_STATUS_COLOR[shelter.status] ?? '#64748b';

          return (
            <CustomOverlayMap
              key={`shelter-${shelter.id}`}
              position={{ lat: shelter.lat, lng: shelter.lng }}
              clickable
              yAnchor={1}
              zIndex={isSelected ? 9 : 5}
            >
              <button
                type="button"
                className={isSelected ? 'safe-route-shelter-marker active' : 'safe-route-shelter-marker'}
                style={{ '--shelter-color': markerColor } as CSSProperties}
                onClick={() => selectShelter(shelter.id)}
                title={`${shelter.name} / ${shelter.status}`}
              >
                <span className="safe-route-shelter-dot" />
                {isSelected ? <span>{shelter.name}</span> : <span className="sr-only">{shelter.name}</span>}
              </button>
            </CustomOverlayMap>
          );
        }) : null}
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
          </div>
          <div className="region-info-grid">
            <span>위험도 점수</span>
            <strong>{activeItem.status?.riskScore ?? 0}%</strong>
            <span>위험도 등급</span>
            <strong>{activeItem.riskLabel}</strong>
            {layers.rainfall ? (
              <>
                <span>강우량</span>
                <strong>{formatNumber(activeItem.status?.rainfall, 'mm')}</strong>
              </>
            ) : null}
            {layers.waterLevel ? (
              <>
                <span>하수관로 수위</span>
                <strong>{formatNumber(activeItem.status?.waterLevel, '%')}</strong>
              </>
            ) : null}
            <span>예보 강수량</span>
            <strong>{formatForecastRainfall(activeItem.status)}</strong>
          </div>
          <div className="region-info-actions">
            <button type="button" className="region-info-action" onClick={() => openRiskAnalysis(activeItem.name)}>
              AI 상세 분석 보기
            </button>
          </div>
        </div>
      ) : null}

      {selectedManhole ? (
        <div className="region-info-window manhole-info-floating">
          <div className="region-info-heading">
            <strong>{selectedManhole.name}</strong>
            <span style={{ background: getManholeColor(selectedManhole.waterLevel) }}>
              {getManholeLevelLabel(selectedManhole.waterLevel)}
            </span>
          </div>
          <div className="region-info-grid">
            <span>현재 수위</span>
            <strong>{selectedManhole.waterLevel}cm</strong>
            <span>맨홀 ID</span>
            <strong>{selectedManhole.locationId}</strong>
            <span>위도</span>
            <strong>{selectedManhole.latitude.toFixed(6)}</strong>
            <span>경도</span>
            <strong>{selectedManhole.longitude.toFixed(6)}</strong>
          </div>
          <div className="region-info-actions">
            <button type="button" className="region-info-action secondary" onClick={() => setSelectedManholeId(null)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {layers.safeRoute ? (
        <div className="safe-route-map-controls">
          <div className="radius-filter-row">
            <span className="radius-label">반경</span>
            {RADIUS_OPTIONS.map((km) => (
              <button
                key={km}
                type="button"
                className={radiusFilter === km ? 'radius-button active' : 'radius-button'}
                onClick={() => setRadiusFilter(radiusFilter === km ? null : km)}
              >
                {RADIUS_LABEL[km]}
              </button>
            ))}
            {inRangeCount !== null ? <span className="radius-count">{inRangeCount}개</span> : null}
          </div>
          <button
            type="button"
            className="safe-route-location-button"
            disabled={isLocating}
            onClick={() => fetchCurrentLocation().catch(() => {})}
          >
            {isLocating ? '위치 조회 중' : '현재 위치'}
          </button>
        </div>
      ) : null}

      {mapControls ? <div className="dashboard-map-layer-toggle">{mapControls}</div> : null}

      <div className="map-legend region-risk-legend">
        {layers.regionalRisk ? (
          <>
            <strong>위험도</strong>
            <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.SAFE }} />안전</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.CAUTION }} />관심</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.WARNING }} />주의</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.DANGER }} />위험</span>
          </>
        ) : null}
        {layers.waterLevel ? (
          <>
            <strong>맨홀</strong>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#16a34a' }} />정상</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#eab308' }} />주의</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#f97316' }} />경계</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#dc2626' }} />심각</span>
            <span className="legend-item"><span className="legend-dot manhole-legend-dot" />{visibleManholes.length}개</span>
          </>
        ) : null}
        {layers.safeRoute ? (
          <>
            <strong>대피소</strong>
            <span className="legend-item"><span className="legend-dot" style={{ background: SHELTER_STATUS_COLOR['운영 중'] }} />운영 중</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: SHELTER_STATUS_COLOR['대기'] }} />대기</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: SHELTER_STATUS_COLOR['만원'] }} />만원</span>
          </>
        ) : null}
      </div>
      {isFetching ? <div className="region-map-error">데이터 갱신 중</div> : null}
      {isError ? <div className="region-map-error">지역별 위험도 데이터를 불러오지 못했습니다.</div> : null}
      {isManholeError ? <div className="region-map-error manhole-map-error">{SENSOR_API_ERROR_MESSAGE}</div> : null}
    </section>
  );
}

function RegionRiskMapFallback(props: RegionRiskMapPanelProps) {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const { data: regionalStatus } = useRegionalStatus();
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const selectedRegionCenter = findRegionCoordinate(selectedRegion);
  const fallbackTiles = buildFallbackTiles(selectedRegionCenter.lat, selectedRegionCenter.lng);

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
        <strong>{props.fallbackTitle ?? '카카오 지도 키가 설정되지 않아 지도 화면을 표시할 수 없습니다.'}</strong>
        <span>
          {props.fallbackDescription ?? '지역 목록에서 분석 기준 지역을 선택할 수 있습니다.'}
          {currentOrigin ? ` 현재 접속 주소: ${currentOrigin}` : ''}
        </span>
        {currentOrigin ? (
          <div className="map-view-sdk-error">
            <strong>카카오 지도 SDK 차단</strong>
            <span>OSM 지도 타일로 임시 표시 중 · 카카오 Web 플랫폼 등록 주소: {currentOrigin}</span>
          </div>
        ) : null}
        <div className="region-fallback-map" aria-label="대체 지역 지도">
          <div className="region-fallback-tile-layer" aria-hidden="true">
            {fallbackTiles.map((tile) => (
              <img
                key={tile.key}
                alt=""
                className="region-fallback-tile"
                draggable={false}
                src={tile.src}
                style={{ left: tile.left, top: tile.top }}
              />
            ))}
          </div>
          {regionItems.map((item) => {
            const left = ((item.lng - FALLBACK_MAP_BOUNDS.minLng) / (FALLBACK_MAP_BOUNDS.maxLng - FALLBACK_MAP_BOUNDS.minLng)) * 100;
            const top = ((FALLBACK_MAP_BOUNDS.maxLat - item.lat) / (FALLBACK_MAP_BOUNDS.maxLat - FALLBACK_MAP_BOUNDS.minLat)) * 100;

            return (
              <button
                type="button"
                key={`fallback-map-${item.name}`}
                className={item.name === selectedRegion ? 'region-fallback-map-marker active' : 'region-fallback-map-marker'}
                style={{ left: `${left}%`, top: `${top}%`, '--marker-color': item.markerColor } as CSSProperties}
                onClick={() => setSelectedRegion(item.name)}
              >
                <span>{item.name}</span>
                <strong>{item.status?.riskScore ?? 0}%</strong>
              </button>
            );
          })}
        </div>
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
    url: 'https://dapi.kakao.com/v2/maps/sdk.js',
  });

  if (kakaoError) {
    return (
      <RegionRiskMapFallback
        {...props}
        fallbackTitle="카카오 지도 SDK를 불러오지 못했습니다."
        fallbackDescription="카카오 개발자 콘솔의 JavaScript 키 플랫폼(Web)에 현재 접속 도메인을 등록해야 합니다."
      />
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
  return <RegionRiskMapWithLoader {...props} />;
}
