// ─── 공통 ───────────────────────────────────────────────────────────────────

export type AlertLevel = 'NORMAL' | 'WATCH' | 'WARNING' | 'DANGER';
export type UserRole = 'USER' | 'ADMIN';
export type SeverityLevel = 'WATCH' | 'WARNING' | 'DANGER';

// ─── 인증 ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization?: string;
  department?: string;
}

export interface RegisteredUser {
  id?: string;
  role: UserRole;
  name: string;
  email: string;
  phone: string;
  organization: string;
  department: string;
  address: string;
  emergencyContact: string;
  memo: string;
}

// ─── 대시보드 ─────────────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  district: string;
  severity: SeverityLevel;
  summary: string;
  reportedAt: string;
}

export interface SensorSummary {
  total: number;
  online: number;
  warning: number;
  offline: number;
}

export interface PredictionPoint {
  time: string;
  risk: number;
  rainfall: number;
  riskLabel?: string;
}

export interface PredictionResult {
  modelVersion: string;
  confidence: number;
  points: PredictionPoint[];
  dataSource?: string;
  source?: string;
  timestamp?: string;
  fallbackUsed?: boolean;
}

export interface DashboardState {
  alertLevel: AlertLevel;
  sensorSummary: SensorSummary;
  activeIncidents: Incident[];
  selectedRegion: string;
}

// ─── 지도 레이어 ──────────────────────────────────────────────────────────────

export interface MapLayer {
  id: string;
  name: string;
  source: string;
  refresh: string;
  enabled: boolean;
}

// ─── 안전 경로 / 대피소 ────────────────────────────────────────────────────────

export type ShelterType = '주민센터' | '학교' | '체육관' | '복지관' | '공원' | '운동장' | '대피소';
export type ShelterStatus = '운영 중' | '대기' | '만원';

export interface Shelter {
  id: string;
  name: string;
  address: string;
  type: ShelterType;
  status: ShelterStatus;
  capacity: number;
  currentOccupancy: number;
  lat: number;
  lng: number;
  distanceKm?: number;
}

export interface RouteStep {
  instruction: string;
  distanceM: number;
}

export interface SafeRoute {
  shelterId: string;
  totalDistanceKm: number;
  estimatedMinutes: number;
  steps: RouteStep[];
  floodRiskLevel: SeverityLevel;
}

// ─── 경보 ───────────────────────────────────────────────────────────────────

export type AlertChannel = 'SMS' | '앱 푸시' | '사이렌' | '재난문자';

export interface AlertMessage {
  id: string;
  level: AlertLevel;
  targetDistrict: string;
  message: string;
  channels: AlertChannel[];
  sentAt: string;
  sentBy: string;
}
