import { create } from 'zustand';
import { Shelter } from '../../shared/types/domain';
import { mockShelters } from './mockData';

interface Location {
  lat: number;
  lng: number;
}

export type TravelMode = 'WALK' | 'CAR';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteStep {
  guidance: string;
  name: string;
  distanceM: number;
  type: number;
  lat?: number;
  lng?: number;
}

export interface RouteResult {
  mode: TravelMode;
  distanceM: number;
  durationSec: number;
  path: RoutePoint[];
  steps?: RouteStep[];
}

interface SafeRouteState {
  shelters: Shelter[];
  selectedShelterId: string | null;
  activeRoute: RouteResult | null;
  travelMode: TravelMode;
  isLoadingRoute: boolean;
  routeError: string | null;
  currentLocation: Location | null;
  isLocating: boolean;
  isNavigating: boolean;
  currentStepIndex: number;

  selectShelter: (id: string) => void;
  clearSelection: () => void;
  setTravelMode: (mode: TravelMode) => void;
  requestRoute: (shelterId: string) => Promise<void>;
  fetchCurrentLocation: () => Promise<void>;
  startNavigation: () => void;
  stopNavigation: () => void;
}

let navWatchId: number | null = null;

export const useSafeRouteStore = create<SafeRouteState>((set, get) => ({
  shelters: mockShelters,
  selectedShelterId: null,
  activeRoute: null,
  travelMode: 'WALK',
  isLoadingRoute: false,
  routeError: null,
  currentLocation: null,
  isLocating: false,
  isNavigating: false,
  currentStepIndex: 0,

  selectShelter: (id) => {
    if (navWatchId !== null) {
      navigator.geolocation.clearWatch(navWatchId);
      navWatchId = null;
    }
    set({ selectedShelterId: id, activeRoute: null, routeError: null, isNavigating: false, currentStepIndex: 0 });
  },

  clearSelection: () => {
    if (navWatchId !== null) {
      navigator.geolocation.clearWatch(navWatchId);
      navWatchId = null;
    }
    set({ selectedShelterId: null, activeRoute: null, routeError: null, isNavigating: false, currentStepIndex: 0 });
  },

  setTravelMode: (mode) => {
    set({ travelMode: mode, activeRoute: null, routeError: null, isNavigating: false, currentStepIndex: 0 });
    const { selectedShelterId } = get();
    if (selectedShelterId) {
      get().requestRoute(selectedShelterId);
    }
  },

  startNavigation: () => {
    const { activeRoute, currentLocation } = get();
    if (!activeRoute || !currentLocation) return;

    set({ isNavigating: true, currentStepIndex: 0 });

    navWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        set({ currentLocation: loc });

        const { activeRoute: route, currentStepIndex: idx } = get();
        if (!route) return;

        const steps = route.steps ?? [];
        const next = steps[idx + 1];
        if (!next?.lat || !next?.lng) return;

        const distM = calcDistanceKm(loc.lat, loc.lng, next.lat, next.lng) * 1000;
        if (distM < 40) {
          set({ currentStepIndex: idx + 1 });
        }
      },
      (err) => console.error('[nav] GPS 오류:', err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
  },

  stopNavigation: () => {
    if (navWatchId !== null) {
      navigator.geolocation.clearWatch(navWatchId);
      navWatchId = null;
    }
    set({ isNavigating: false, currentStepIndex: 0 });
  },

  fetchCurrentLocation: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation을 지원하지 않는 브라우저입니다.'));
        return;
      }

      set({ isLocating: true });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          const shelters = get().shelters.map((shelter) => {
            const distanceKm = calcDistanceKm(location.lat, location.lng, shelter.lat, shelter.lng);
            return { ...shelter, distanceKm: Math.round(distanceKm * 10) / 10 };
          });
          shelters.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

          set({ currentLocation: location, shelters, isLocating: false });
          resolve();
        },
        (error) => {
          console.error('[safeRouteStore] 위치 오류:', error.message);
          set({ isLocating: false });
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  },

  requestRoute: async (shelterId) => {
    const { currentLocation, shelters, travelMode } = get();

    if (!currentLocation) {
      set({ routeError: '현재 위치를 먼저 확인해주세요.' });
      return;
    }

    const shelter = shelters.find((s) => s.id === shelterId);
    if (!shelter) return;

    set({ isLoadingRoute: true, routeError: null });

    try {
      if (travelMode === 'WALK') {
        const data = await fetchTmapWalk(currentLocation, shelter);
        set({ activeRoute: data, isLoadingRoute: false });
        return;
      }

      const params = new URLSearchParams({
        originLat: String(currentLocation.lat),
        originLng: String(currentLocation.lng),
        destLat: String(shelter.lat),
        destLng: String(shelter.lng),
      });

      const res = await fetch(`/api/route/car?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message ?? '경로 조회에 실패했습니다.');

      set({
        activeRoute: {
          mode: data.mode,
          distanceM: data.distanceM,
          durationSec: data.durationSec,
          path: data.path,
          steps: data.steps ?? [],
        },
        isLoadingRoute: false,
      });
    } catch (err) {
      console.error('[safeRouteStore] 경로 요청 실패:', err);
      set({
        isLoadingRoute: false,
        routeError: err instanceof Error ? err.message : '경로 조회 중 오류가 발생했습니다.',
      });
    }
  },
}));

async function fetchTmapWalk(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number; name: string },
): Promise<RouteResult> {
  const url =
    `https://router.project-osrm.org/route/v1/foot/` +
    `${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
    `?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('도보 경로를 찾을 수 없습니다.');
  }

  const route = data.routes[0];

  const path: RoutePoint[] = route.geometry.coordinates.map(
    (c: [number, number]) => ({ lng: c[0], lat: c[1] }),
  );

  const steps: RouteStep[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const { maneuver, name, distance } = step;
      const mod: string = maneuver.modifier ?? '';

      let type = 11;
      let guidance = name || '직진';

      if (maneuver.type === 'depart') { type = 200; guidance = '출발지'; }
      else if (maneuver.type === 'arrive') { type = 201; guidance = '목적지 도착'; }
      else if (mod.includes('left')) { type = 12; guidance = `좌회전${name ? ` — ${name}` : ''}`; }
      else if (mod.includes('right')) { type = 13; guidance = `우회전${name ? ` — ${name}` : ''}`; }
      else if (mod.includes('uturn')) { type = 17; guidance = 'U턴'; }
      else if (name) { guidance = name; }

      steps.push({
        guidance,
        name: name ?? '',
        distanceM: Math.round(distance),
        type,
        lat: maneuver.location[1],
        lng: maneuver.location[0],
      });
    }
  }

  const distanceM = Math.round(route.distance);
  // 한국 도심 도보 실효 속도 4 km/h (신호 대기·횡단보도 포함)
  const durationSec = Math.round(distanceM / (4000 / 3600));

  return {
    mode: 'WALK',
    distanceM,
    durationSec,
    path,
    steps,
  };
}

function calcDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}