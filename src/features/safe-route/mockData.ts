import { SafeRoute, Shelter } from '../../shared/types/domain';

export const mockShelters: Shelter[] = [];

export const mockRoute: SafeRoute = {
  shelterId: 'SHL-001',
  totalDistanceKm: 1.8,
  estimatedMinutes: 17,
  floodRiskLevel: 'WARNING',
  steps: [
    { instruction: '현재 위치에서 북쪽으로 200m 이동', distanceM: 200 },
    { instruction: '양재대로 방향으로 우회전', distanceM: 450 },
    { instruction: '침수 구간 우회 — 도곡로 경유', distanceM: 680 },
    { instruction: '양재천로 진입 후 직진', distanceM: 470 },
    { instruction: '양재천 대피소 도착', distanceM: 0 },
  ],
};