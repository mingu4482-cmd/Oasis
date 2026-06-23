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
  autoSelectedId: string | null;
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
  autoSelectedId: null,
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

          // 아직 선택된 대피소가 없으면 가장 가까운 운영 중 대피소 자동 선택
          const { selectedShelterId } = get();
          const nearest = shelters.find((s) => s.status !== '만원');
          const shouldAutoSelect = !selectedShelterId && nearest;

          set({
            currentLocation: location,
            shelters,
            isLocating: false,
            ...(shouldAutoSelect ? { selectedShelterId: nearest.id, autoSelectedId: nearest.id } : {}),
          });

          if (shouldAutoSelect) {
            get().requestRoute(nearest.id).catch(() => {});
          }

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
      const data = await fetchTmapRoute(travelMode, currentLocation, shelter);
      set({ activeRoute: data, isLoadingRoute: false });
    } catch (err) {
      console.error('[safeRouteStore] 경로 요청 실패:', err);
      set({
        isLoadingRoute: false,
        routeError: err instanceof Error ? err.message : '경로 조회 중 오류가 발생했습니다.',
      });
    }
  },
}));

async function fetchTmapRoute(
  mode: TravelMode,
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<RouteResult> {
  const endpoint = mode === 'WALK' ? '/api/route/walk' : '/api/route/car';
  const url = `${endpoint}?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${dest.lat}&destLng=${dest.lng}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `경로 조회 실패 (${res.status})`);
  }

  return res.json() as Promise<RouteResult>;
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