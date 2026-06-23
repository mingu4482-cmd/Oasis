import { create } from 'zustand';
import { DashboardState } from '../types/domain';
import { mockDashboard } from '../../features/flood-prediction/mockData';

interface DashboardActions {
  setSelectedRegion: (selectedRegion: string) => void;
}

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  ...mockDashboard,
  selectedRegion: '강남구',
  setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
}));
