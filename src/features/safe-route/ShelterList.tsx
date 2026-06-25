import { useEffect, useRef } from 'react';
import { ArrowUp, Car, CheckCircle, CornerUpLeft, CornerUpRight, Flag, Footprints, LocateFixed, MapPin, Navigation, RotateCcw, Square, Users } from 'lucide-react';
import { Shelter } from '../../shared/types/domain';
import { RouteStep, useSafeRouteStore } from './safeRouteStore';

const statusColor: Record<Shelter['status'], string> = {
  '운영 중': '#0f766e',
  '대기': '#b45309',
  '만원': '#b91c1c',
};

function occupancyRate(shelter: Shelter) {
  return Math.round((shelter.currentOccupancy / shelter.capacity) * 100);
}

function formatDuration(sec: number) {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

function formatDistanceM(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}

function StepIcon({ type, guidance, color = '#0f766e' }: { type: number; guidance: string; color?: string }) {
  const style = { flexShrink: 0 as const, color };
  if (type === 12 || type === 16) return <CornerUpLeft size={14} style={style} />;
  if (type === 13 || type === 14) return <CornerUpRight size={14} style={style} />;
  if (type === 17) return <RotateCcw size={14} style={style} />;
  if (type === 200 || type === 106) return <MapPin size={14} style={style} />;
  if (type === 201 || type === 107 || type === 125) return <Flag size={14} style={style} />;
  if (guidance.includes('좌회전') || guidance.includes('좌측')) return <CornerUpLeft size={14} style={style} />;
  if (guidance.includes('우회전') || guidance.includes('우측')) return <CornerUpRight size={14} style={style} />;
  if (guidance.includes('유턴')) return <RotateCcw size={14} style={style} />;
  if (guidance.includes('출발지')) return <MapPin size={14} style={style} />;
  if (guidance.includes('목적지')) return <Flag size={14} style={style} />;
  return <ArrowUp size={14} style={style} />;
}

export function ShelterList() {
  const shelters = useSafeRouteStore((s) => s.shelters);
  const radiusFilter = useSafeRouteStore((s) => s.radiusFilter);
  const selectedId = useSafeRouteStore((s) => s.selectedShelterId);
  const activeRoute = useSafeRouteStore((s) => s.activeRoute);
  const isLoadingRoute = useSafeRouteStore((s) => s.isLoadingRoute);
  const routeError = useSafeRouteStore((s) => s.routeError);
  const travelMode = useSafeRouteStore((s) => s.travelMode);
  const isNavigating = useSafeRouteStore((s) => s.isNavigating);
  const currentStepIndex = useSafeRouteStore((s) => s.currentStepIndex);
  const autoSelectedId = useSafeRouteStore((s) => s.autoSelectedId);

  const displayedShelters = radiusFilter
    ? shelters.filter((s) => (s.distanceKm ?? Infinity) <= radiusFilter)
    : shelters;
  const selectShelter = useSafeRouteStore((s) => s.selectShelter);
  const requestRoute = useSafeRouteStore((s) => s.requestRoute);
  const setTravelMode = useSafeRouteStore((s) => s.setTravelMode);
  const startNavigation = useSafeRouteStore((s) => s.startNavigation);
  const stopNavigation = useSafeRouteStore((s) => s.stopNavigation);

  const activeStepRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isNavigating && activeStepRef.current) {
      activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStepIndex, isNavigating]);

  const steps = (activeRoute?.steps ?? []) as RouteStep[];
  const currentStep = steps[currentStepIndex];
  const isArrived = isNavigating && steps.length > 0 && currentStepIndex >= steps.length - 1;
  const progress = steps.length > 0 ? Math.round(((currentStepIndex + 1) / steps.length) * 100) : 0;

  const autoSelectedShelter = autoSelectedId ? shelters.find((s) => s.id === autoSelectedId) : null;

  return (
    <div className="shelter-list">
      {autoSelectedShelter && (
        <div className="auto-select-banner">
          <LocateFixed size={14} aria-hidden="true" />
          <span>가장 가까운 운영 중 대피소 <strong>{autoSelectedShelter.name}</strong>을 자동으로 선택했습니다.</span>
        </div>
      )}
      {displayedShelters.length === 0 && (
        <div className="shelter-empty-state">
          <MapPin size={28} strokeWidth={1.5} />
          {radiusFilter
            ? <><p>{radiusFilter}km 내 대피소가 없습니다.</p><span>반경을 늘리거나 출발지를 변경해 보세요.</span></>
            : <><p>등록된 대피소가 없습니다.</p><span>관리자가 대피소를 등록하면 여기에 표시됩니다.</span></>
          }
        </div>
      )}
      {displayedShelters.map((shelter) => {
        const isSelected = shelter.id === selectedId;
        const rate = occupancyRate(shelter);

        return (
          <article
            key={shelter.id}
            className={`shelter-item${isSelected ? ' selected' : ''}`}
            onClick={() => selectShelter(shelter.id)}
          >
            <div className="shelter-header">
              <strong>{shelter.name}</strong>
              <span className="shelter-status" style={{ color: statusColor[shelter.status] }}>
                {shelter.status}
              </span>
            </div>

            <p className="shelter-address">{shelter.address}</p>

            <div className="shelter-meta">
              <span className="shelter-type">{shelter.type}</span>
              <span className="shelter-distance">
                <LocateFixed size={13} aria-hidden="true" />
                {shelter.distanceKm}km
              </span>
              <span className="shelter-occupancy">
                <Users size={13} aria-hidden="true" />
                {shelter.currentOccupancy}/{shelter.capacity}명 ({rate}%)
              </span>
            </div>

            <div className="occupancy-bar">
              <div
                className="occupancy-fill"
                style={{
                  width: `${rate}%`,
                  background: rate >= 90 ? '#dc2626' : rate >= 60 ? '#f97316' : '#0f766e',
                }}
              />
            </div>

            {isSelected && (
              <div className="route-controls" onClick={(e) => e.stopPropagation()}>
                <div className="mode-toggle">
                  <button
                    type="button"
                    className={travelMode === 'WALK' ? 'mode-button active' : 'mode-button'}
                    onClick={() => setTravelMode('WALK')}
                  >
                    <Footprints size={14} aria-hidden="true" />
                    도보
                  </button>
                  <button
                    type="button"
                    className={travelMode === 'CAR' ? 'mode-button active' : 'mode-button'}
                    onClick={() => setTravelMode('CAR')}
                  >
                    <Car size={14} aria-hidden="true" />
                    자동차
                  </button>
                </div>

                <button
                  className="command-button route-button"
                  type="button"
                  disabled={isLoadingRoute || shelter.status === '만원'}
                  onClick={() => requestRoute(shelter.id)}
                >
                  <Navigation size={15} aria-hidden="true" />
                  {isLoadingRoute ? '경로 계산 중…' : '이 대피소로 경로 안내'}
                </button>
              </div>
            )}
          </article>
        );
      })}

      {routeError && <div className="form-error">{routeError}</div>}

      {activeRoute && (
        <div className="route-detail">
          <div className="route-detail-header">
            <strong>{travelMode === 'WALK' ? '도보' : '자동차'} 경로 안내</strong>
            <span>
              {(activeRoute.distanceM / 1000).toFixed(1)}km · {formatDuration(activeRoute.durationSec)}
            </span>
          </div>

          {/* 도착 */}
          {isArrived ? (
            <div className="nav-arrival">
              <CheckCircle size={28} color="#0f766e" />
              <h3>목적지 도착!</h3>
              <p>대피소에 안전하게 도착했습니다.</p>
              <button className="command-button secondary route-button" type="button" onClick={stopNavigation}>
                안내 종료
              </button>
            </div>
          ) : (
            <>
              {/* 내비게이션 중 — 현재 step 배너 */}
              {isNavigating && currentStep && (
                <div className="nav-current-step">
                  <StepIcon type={currentStep.type} guidance={currentStep.guidance} color="#ffffff" />
                  <div className="nav-step-info">
                    <div className="nav-step-text">{currentStep.guidance}</div>
                    {currentStep.distanceM > 0 && (
                      <div className="nav-step-distance">{formatDistanceM(currentStep.distanceM)}</div>
                    )}
                  </div>
                  <span className="nav-step-counter">{currentStepIndex + 1} / {steps.length}</span>
                  <div className="nav-progress-bar">
                    <div className="nav-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* 내비게이션 시작/종료 버튼 */}
              {isNavigating ? (
                <button
                  className="command-button secondary route-button"
                  type="button"
                  onClick={stopNavigation}
                  style={{ marginBottom: steps.length > 0 ? '12px' : 0 }}
                >
                  <Square size={14} aria-hidden="true" />
                  내비게이션 종료
                </button>
              ) : (
                <button
                  className="command-button route-button"
                  type="button"
                  onClick={startNavigation}
                  style={{ marginBottom: steps.length > 0 ? '12px' : 0 }}
                >
                  <Navigation size={15} aria-hidden="true" />
                  내비게이션 시작
                </button>
              )}
            </>
          )}

          {/* Step 목록 */}
          {steps.length > 0 && (
            <ol className="route-steps">
              {steps.map((step, i) => {
                const isDone = isNavigating && i < currentStepIndex;
                const isActive = isNavigating && i === currentStepIndex;
                return (
                  <li
                    key={i}
                    ref={isActive ? activeStepRef : null}
                    className={`route-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
                  >
                    <StepIcon type={step.type} guidance={step.guidance} />
                    <span>
                      {step.guidance}
                      {step.name && step.name !== step.guidance ? ` — ${step.name}` : ''}
                    </span>
                    {step.distanceM > 0 && <em>{formatDistanceM(step.distanceM)}</em>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
