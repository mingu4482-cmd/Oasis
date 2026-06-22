import { create } from 'zustand';
import { AlertLevel, DashboardState, MapCenter, PredictionResult } from '../types/domain';
import { mockDashboard } from '../../features/flood-prediction/mockData';

interface DashboardActions {
  setAlertLevel: (alertLevel: AlertLevel) => void;
  setMapCenter: (mapCenter: MapCenter) => void;
  setSimulationPrediction: (prediction: PredictionResult | null) => void;
  setSelectedRegion: (selectedRegion: string) => void;
}

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  ...mockDashboard,
  simulationPrediction: null,
  selectedRegion: '강남구',
  setAlertLevel: (alertLevel) => set({ alertLevel }),
  setMapCenter: (mapCenter) => set({ mapCenter }),
  setSimulationPrediction: (simulationPrediction) => set({ simulationPrediction }),
  setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
}));
