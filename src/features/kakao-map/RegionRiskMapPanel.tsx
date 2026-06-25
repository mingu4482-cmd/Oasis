import { Fragment, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Circle, CustomOverlayMap, Map, useKakaoLoader } from 'react-kakao-maps-sdk';
import { useNavigate } from 'react-router-dom';
import { fetchRegionalStatus, LiveStatusResponse, RegionalStatusResponse, RiskForecastPoint, RiskLabel } from '../../shared/api/aiApi';
import { REGION_COORDINATES, findRegionCoordinate } from '../../shared/constants/regionCoordinates';
import { useDashboardStore } from '../../shared/store/dashboardStore';

const RISK_MARKER_COLOR: Record<RiskLabel, string> = {
  SAFE: '#16a34a',
  CAUTION: '#eab308',
  WARNING: '#f97316',
  DANGER: '#dc2626',
};

const RISK_RADIUS: Record<RiskLabel, number> = {
  SAFE: 160,
  CAUTION: 240,
  WARNING: 320,
  DANGER: 420,
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

interface RegionRiskMapPanelProps {
  className?: string;
  height?: string;
}

export function RegionRiskMapPanel({ className = '', height }: RegionRiskMapPanelProps) {
  const navigate = useNavigate();
  const kakaoMapKey = import.meta.env.VITE_KAKAO_MAP_KEY ?? '';
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const [regionalStatus, setRegionalStatus] = useState<RegionalStatusResponse | null>(null);
  const [activeInfoRegion, setActiveInfoRegion] = useState(selectedRegion);
  const [dataError, setDataError] = useState('');
  const [timeIndex, setTimeIndex] = useState(0);
  const [kakaoLoading, kakaoError] = useKakaoLoader({
    appkey: kakaoMapKey,
    libraries: ['services', 'clusterer'],
  });

  useEffect(() => {
    let isMounted = true;

    const loadRegionalStatus = async () => {
      try {
        const data = await fetchRegionalStatus();
        if (isMounted) {
          setRegionalStatus(data);
          setDataError('');
        }
      } catch (error) {
        console.error('Failed to fetch regional map status:', error);
        if (isMounted) {
          setDataError('지역별 위험도 데이터를 불러오지 못했습니다.');
        }
      }
    };

    loadRegionalStatus();
    const interval = window.setInterval(loadRegionalStatus, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setActiveInfoRegion(selectedRegion);
  }, [selectedRegion]);

  const regionItems = useMemo(
    () =>
      REGION_COORDINATES.map((coordinate) => {
        const status = regionalStatus?.regionStatusMap?.[coordinate.name];
        const timeData = getDataAtTime(status, timeIndex);
        return {
          ...coordinate,
          status,
          timeData,
          riskLabel: timeData.riskLabel,
          markerColor: RISK_MARKER_COLOR[timeData.riskLabel],
          radius: RISK_RADIUS[timeData.riskLabel],
        };
      }),
    [regionalStatus, timeIndex],
  );

  const center = findRegionCoordinate(selectedRegion);
  const activeItem = regionItems.find((item) => item.name === activeInfoRegion) ?? regionItems[0];
  const hasMapKey = Boolean(kakaoMapKey);

  const selectRegion = (regionName: string) => {
    setSelectedRegion(regionName);
    setActiveInfoRegion(regionName);
  };

  const openRiskAnalysis = (regionName: string) => {
    selectRegion(regionName);
    navigate(`/risk-analysis?region=${encodeURIComponent(regionName)}`);
  };

  if (!hasMapKey) {
    return (
      <section className={`map-surface region-risk-map ${className}`} style={height ? { height } : undefined}>
        <div className="region-map-fallback">
          <strong>카카오 지도 키가 설정되지 않았습니다</strong>
          <span>.env.local에 VITE_KAKAO_MAP_KEY를 설정하면 지역별 위험도 지도가 표시됩니다.</span>
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

  if (kakaoLoading) {
    return (
      <section className={`map-surface region-risk-map ${className}`} style={height ? { height } : undefined}>
        <div className="region-map-fallback">
          <strong>지도 로딩 중입니다.</strong>
        </div>
      </section>
    );
  }

  if (kakaoError) {
    return (
      <section className={`map-surface region-risk-map ${className}`} style={height ? { height } : undefined}>
        <div className="region-map-fallback">
          <strong>카카오 지도 키가 설정되지 않았습니다</strong>
          <span>지도 SDK를 불러오지 못했습니다. 키와 도메인 설정을 확인하세요.</span>
        </div>
      </section>
    );
  }

  return (
    <section className={`map-surface region-risk-map ${className}`} style={height ? { height } : undefined} aria-label="지역별 침수 위험도 지도">
      <Map center={{ lat: center.lat, lng: center.lng }} isPanto level={8} style={{ width: '100%', height: '100%' }}>
        {regionItems.map((item) => (
          <Fragment key={item.name}>
            <Circle
              center={{ lat: item.lat, lng: item.lng }}
              radius={item.radius}
              strokeWeight={1}
              strokeColor={item.markerColor}
              strokeOpacity={0.55}
              fillColor={item.markerColor}
              fillOpacity={item.name === selectedRegion ? 0.22 : 0.12}
            />
            <CustomOverlayMap position={{ lat: item.lat, lng: item.lng }} clickable yAnchor={0.9} zIndex={item.name === selectedRegion ? 4 : 2}>
              <button
                type="button"
                className={item.name === selectedRegion ? 'region-risk-marker active' : 'region-risk-marker'}
                style={{ '--marker-color': item.markerColor } as CSSProperties}
                onClick={() => selectRegion(item.name)}
              >
                <span>{item.name}</span>
                <strong>{item.timeData.riskScore}%</strong>
              </button>
            </CustomOverlayMap>
          </Fragment>
        ))}

        {activeItem ? (
          <CustomOverlayMap position={{ lat: activeItem.lat, lng: activeItem.lng }} clickable yAnchor={1.15} zIndex={10}>
            <div className="region-info-window">
              <div className="region-info-heading">
                <strong>{activeItem.name}</strong>
                <span style={{ background: activeItem.markerColor }}>{activeItem.riskLabel}</span>
                {timeIndex > 0 && (
                  <span className="region-info-time-badge">{TIME_LABELS[timeIndex]} 예측</span>
                )}
              </div>
              <div className="region-info-grid">
                <span>위험도 점수</span>
                <strong>{activeItem.timeData.riskScore}%</strong>
                <span>강우량</span>
                <strong>{formatNumber(activeItem.timeData.rainfall, 'mm')}</strong>
                <span>하수관로 수위</span>
                <strong>{formatNumber(activeItem.timeData.waterLevel, '%')}</strong>
                {timeIndex === 0 && (
                  <>
                    <span>데이터 출처</span>
                    <strong>{activeItem.status?.source ?? (regionalStatus?.hasData ? 'regional api' : 'fallback')}</strong>
                  </>
                )}
                {!activeItem.timeData.hasForecast && (
                  <>
                    <span>예측 데이터</span>
                    <strong style={{ color: '#b45309' }}>미수신</strong>
                  </>
                )}
              </div>
              <button type="button" className="region-info-action" onClick={() => openRiskAnalysis(activeItem.name)}>
                상세 분석 보기
              </button>
            </div>
          </CustomOverlayMap>
        ) : null}
      </Map>

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
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.SAFE }} />SAFE</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.CAUTION }} />CAUTION</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.WARNING }} />WARNING</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: RISK_MARKER_COLOR.DANGER }} />DANGER</span>
      </div>
      {dataError ? <div className="region-map-error">{dataError}</div> : null}
    </section>
  );
}
