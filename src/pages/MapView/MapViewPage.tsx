import { Activity, AlertTriangle, CloudRain, MapPin, Waves } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Map, Circle } from 'react-kakao-maps-sdk'; // 🌟 카카오맵 SDK 추가
import { EXTERNAL_SENSOR_API_BASE_URL } from '../../shared/api/externalApi';
import { REGION_COORDINATES } from '../../shared/constants/regionCoordinates';
import { useDashboardStore } from '../../shared/store/dashboardStore';

const CONTROL_LAYERS = [
  { id: 'regionalRisk', label: '지역별 위험도', icon: Activity },
  { id: 'waterLevel', label: '하수관로 수위', icon: Waves },
  { id: 'rainfall', label: '강우량 관측', icon: CloudRain },
] as const;

type LayerId = (typeof CONTROL_LAYERS)[number]['id'];
type LayerVisibility = Record<LayerId, boolean>;

// 🌟 백엔드 데이터용 인터페이스
interface Manhole {
    locationId: number;
    name: string;
    latitude: number;
    longitude: number;
    waterLevel: number;
}

const SENSOR_API_ERROR_MESSAGE = '외부 하수관로 센서 API에 연결할 수 없습니다. 현재는 서울시 공공 API 기반 위험도만 표시됩니다.';

export const MapViewPage = () => {
  const selectedRegion = useDashboardStore((state) => state.selectedRegion);
  const setSelectedRegion = useDashboardStore((state) => state.setSelectedRegion);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    regionalRisk: true,
    waterLevel: true,
    rainfall: true,
  });

  // 🌟 동생이 만든 실시간 벡엔드 연동 로직
  const [manholes, setManholes] = useState<Manhole[]>([]);
  const [sensorApiError, setSensorApiError] = useState('');
  useEffect(() => {
      const fetchData = async () => {
          try {
              const response = await fetch(`${EXTERNAL_SENSOR_API_BASE_URL}/api/manholes`);
              if (!response.ok) throw new Error('API 서버 연결 안 됨');
              const data: Manhole[] = await response.json();
              const validData = data.filter(m => m.latitude !== 0 && m.latitude !== null);
              setManholes(validData);
              setSensorApiError('');
          } catch (e) {
              console.error("🚨 백엔드 연결 실패!", e);
              setManholes([]);
              setSensorApiError(SENSOR_API_ERROR_MESSAGE);
          }
      };
      fetchData();
      const interval = setInterval(fetchData, 60000);
      return () => clearInterval(interval);
  }, []);

  const getHeatmapColor = (waterLevel: number) => {
      if (waterLevel >= 90) return '#ef4444';
      if (waterLevel >= 60) return '#f59e0b';
      return '#10b981';
  };

  const toggleLayer = (layerId: LayerId) => {
    setLayerVisibility((current) => ({
      ...current,
      [layerId]: !current[layerId],
    }));
  };

  return (
    // 🌟 중복되던 AppShell 제거 (Router에서 관리함)
    <>
      <div className="page-layout map-view-page">
        <section className="panel page-hero-panel map-view-hero">
          <div>
            <span className="eyebrow">지역별 위험도 지도</span>
            <h1>지도 기반 침수 위험도 모니터링</h1>
            <p>서울 주요 지역의 실시간 침수 위험도를 지도에서 확인하고, 지역을 선택해 AI 상세 분석으로 이동할 수 있습니다.</p>
          </div>
          <div className="map-view-selected-region">
            <MapPin size={18} />
            <strong>{selectedRegion}</strong>
          </div>
        </section>

        <div className="control-map-layout">
          <aside className="control-layer-panel" aria-label="지도 레이어 제어">
            <div className="control-panel-heading">
              <span className="eyebrow">통합 관제 레이어</span>
              <h2>지도 표시 항목</h2>
            </div>

            <label className="control-region-select">
              분석 지역
              <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)}>
                {REGION_COORDINATES.map((region) => (
                  <option key={region.name} value={region.name}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="control-layer-list">
              {CONTROL_LAYERS.map((layer) => {
                const Icon = layer.icon;
                return (
                  <button
                    type="button"
                    key={layer.label}
                    className={layerVisibility[layer.id] ? 'control-layer-row active' : 'control-layer-row'}
                    aria-pressed={layerVisibility[layer.id]}
                    onClick={() => toggleLayer(layer.id)}
                  >
                    <span className="control-layer-icon">
                      <Icon size={17} />
                    </span>
                    <span>{layer.label}</span>
                    <strong>{layerVisibility[layer.id] ? 'ON' : 'OFF'}</strong>
                  </button>
                );
              })}
            </div>

            <div className="control-panel-note">
              <AlertTriangle size={16} />
              <span>서울시 강우량, 서울시 하수관로, 기상청 단기예보 데이터를 기반으로 표시됩니다.</span>
            </div>
            <div className="control-panel-note map-coordinate-note">
              <MapPin size={16} />
              <span>※ 지도 마커는 자치구별 위험도를 표시하기 위한 대표 위치 기준이며, 실제 침수 발생 지점을 의미하지 않습니다.</span>
            </div>
            {sensorApiError ? (
              <div className="control-panel-note map-coordinate-note">
                <AlertTriangle size={16} />
                <span>{sensorApiError}</span>
              </div>
            ) : null}
          </aside>

          {/* 🌟 동생의 실시간 카카오 히트맵을 팀원 UI 공간에 렌더링! */}
          <div className="full-region-risk-map control-map-surface" style={{ width: '100%', height: 'calc(100vh - 238px)', borderRadius: '12px', overflow: 'hidden' }}>
              <Map center={{ lat: 37.5665, lng: 126.9780 }} style={{ width: "100%", height: "100%" }} level={8}>
                  {/* 좌측 패널의 '하수관로 수위' 버튼이 켜져있을 때만 히트맵 표시 연동! */}
                  {layerVisibility.waterLevel && manholes
                      .filter((m) => m.waterLevel >= 30)
                      .map((m) => {
                          const zoneColor = getHeatmapColor(m.waterLevel);
                          return (
                              <Circle
                                  key={`zone-${m.locationId}`}
                                  center={{ lat: m.latitude, lng: m.longitude }}
                                  radius={400}
                                  strokeWeight={1}
                                  strokeColor={zoneColor}
                                  strokeOpacity={0.2}
                                  fillColor={zoneColor}
                                  fillOpacity={0.15}
                              />
                          );
                      })}
              </Map>
              {sensorApiError ? <div className="region-map-error">{sensorApiError}</div> : null}
          </div>

        </div>
      </div>
    </>
  );
};

export default MapViewPage;
