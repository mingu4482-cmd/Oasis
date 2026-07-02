import { create } from 'zustand';
import { DashboardState } from '../types/domain';
import { mockDashboard } from '../../features/flood-prediction/mockData';

interface DashboardActions {
  setSelectedRegion: (selectedRegion: string) => void;
  simulationSensorLogs: SimulationSensorLog[];
  addSimulationSensorLog: (log: SimulationSensorLog) => void;
  clearSimulationSensorLogs: (region?: string) => void;
}

export interface SimulationSensorLog {
  id: string;
  region: string;
  sensorName: string;
  waterLevel: number;
  rainfall: number;
  detectedAt: string;
  message: string;
}

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  ...mockDashboard,
  selectedRegion: '강남구',
  setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
  simulationSensorLogs: [],
  addSimulationSensorLog: (log) => set((state) => ({
    simulationSensorLogs: [log, ...state.simulationSensorLogs].slice(0, 100),
  })),
  clearSimulationSensorLogs: (region) => set((state) => ({
    simulationSensorLogs: region
      ? state.simulationSensorLogs.filter((log) => log.region !== region)
      : [],
  })),
}));
