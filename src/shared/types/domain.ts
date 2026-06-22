export type AlertLevel = 'NORMAL' | 'WATCH' | 'WARNING' | 'DANGER';

export interface Incident {
  id: string;
  district: string;
  severity: AlertLevel;
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

export interface MapCenter {
  lat: number;
  lng: number;
}

export interface DashboardState {
  alertLevel: AlertLevel;
  activeIncidents: Incident[];
  sensorSummary: SensorSummary;
  aiPrediction: PredictionResult;
  simulationPrediction: PredictionResult | null;
  selectedRegion: string;
  mapCenter: MapCenter;
}

export interface MapLayer {
  id: string;
  name: string;
  source: string;
  refresh: string;
  enabled: boolean;
}

export type UserRole = 'ADMIN' | 'USER';

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
