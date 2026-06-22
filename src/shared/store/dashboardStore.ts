import { create } from 'zustand';
import { AlertLevel, DashboardState, MapCenter } from '../types/domain';
import { mockDashboard } from '../../features/flood-prediction/mockData';

interface DashboardActions {
  setAlertLevel: (alertLevel: AlertLevel) => void;
  setMapCenter: (mapCenter: MapCenter) => void;
}

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  ...mockDashboard,
  setAlertLevel: (alertLevel) => set({ alertLevel }),
  setMapCenter: (mapCenter) => set({ mapCenter }),
}));
