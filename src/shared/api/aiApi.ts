import { apiClient } from './client';
import { PredictionResult } from '../types/domain';

export interface RiskPredictionPayload {
  current_level: number;
  level_velocity: number;
  current_rainfall: number;
  forecast_rainfall: number;
}

export type RiskLabel = 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
export type DataStatus = 'REALTIME' | 'PARTIAL' | 'FALLBACK' | 'UNAVAILABLE';

export interface RiskPredictionResponse {
  riskLevel: number;
  riskLabel: RiskLabel;
  riskScore?: number;
}

export async function fetchRiskPrediction(payload: RiskPredictionPayload) {
  const response = await apiClient.post<RiskPredictionResponse>('/predict-risk', payload);
  return response.data;
}

export type RiskForecastResponse =
  | (PredictionResult & {
      hasData: true;
      timestamp?: string;
      source?: string;
      dataStatus?: DataStatus;
      dataStatusMessage?: string;
      message?: string | null;
      reasons?: string[];
      forecastStatus?: 'OK' | 'FAILED' | string | null;
      targetAreaName?: string;
      region?: string;
      riskScore?: number;
      riskLabel?: RiskLabel;
    })
  | { hasData: false; message: string; source: string; timestamp: null; dataStatus?: DataStatus; points?: [] };

export async function fetchRiskForecast(region?: string) {
  const response = await apiClient.get<RiskForecastResponse>('/risk-forecast', {
    params: region ? { region } : undefined,
  });
  return response.data;
}

export interface RiskForecastPoint {
  time: string;
  risk: number;
  rainfall: number;
  riskLabel: RiskLabel;
}

export interface LiveStatusResponse {
  hasData: boolean;
  targetAreaName?: string;
  rainfall?: number;
  rainfallUnit?: string;
  waterLevel?: number;
  drainageLevel?: number;
  waterLevelRiseRate?: number;
  forecastRainfall1h?: number;
  forecastRainfall2h?: number;
  forecastRainfall3h?: number;
  forecastStatus?: 'OK' | 'FAILED' | string | null;
  riskScore?: number;
  riskLabel?: RiskLabel;
  confidence?: number;
  points?: RiskForecastPoint[];
  source?: string;
  dataStatus?: DataStatus;
  dataStatusMessage?: string;
  message?: string | null;
  reasons?: string[];
  timestamp?: string;
  rainfallStation?: string;
  rainfallObservedAt?: string;
  drainpipeStation?: string;
  drainpipeMeasuredAt?: string;
  drainpipePosition?: string;
  rawWaterLevel?: number | null;
  forecastGrid?: { nx: number; ny: number };
  fallbackReason?: string | null;
  warnings?: string[];
  current_level?: number;
  level_velocity?: number;
  current_rainfall?: number;
  forecast_rainfall?: number;
}

export interface GenerateAlertRequest {
  region: string;
  riskScore: number;
  riskLabel: RiskLabel | string;
  rainfall: number;
  waterLevel: number;
  waterLevelRiseRate: number;
  forecastRainfall1h: number;
  source?: string;
  dataStatus?: DataStatus;
}

export interface GenerateAlertResponse {
  alertLevel: string;
  targetGroup: string[];
  title: string;
  message: string;
  actions: string[];
  createdAt: string;
  source?: 'openai' | 'fallback' | string;
}

export interface RegionsResponse {
  hasData: boolean;
  defaultRegion: string;
  regions: string[];
  timestamp: string | null;
}

export interface RegionalStatusResponse {
  hasData: boolean;
  mode: 'regional';
  defaultRegion: string;
  regions: string[];
  regionStatusMap: Record<string, LiveStatusResponse>;
  timestamp: string | null;
}

export async function fetchRegions() {
  const response = await apiClient.get<RegionsResponse>('/regions');
  return response.data;
}

export async function fetchRegionalStatus() {
  const response = await apiClient.get<RegionalStatusResponse>('/regional-status');
  return response.data;
}

export async function fetchLiveStatus(region?: string) {
  const response = await apiClient.get<LiveStatusResponse>('/live-status', {
    params: region ? { region } : undefined,
  });
  return response.data;
}

export async function generateAlert(payload: GenerateAlertRequest): Promise<GenerateAlertResponse> {
  const response = await apiClient.post<GenerateAlertResponse>('/generate-alert', payload);
  return response.data;
}
