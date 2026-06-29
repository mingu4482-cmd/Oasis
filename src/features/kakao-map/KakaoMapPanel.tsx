import { RegionRiskMapPanel } from './RegionRiskMapPanel';
import type { ReactNode } from 'react';

interface KakaoMapPanelProps {
  layerVisibility?: {
    regionalRisk: boolean;
    waterLevel: boolean;
    rainfall: boolean;
    safeRoute?: boolean;
  };
  mapControls?: ReactNode;
}

export function KakaoMapPanel({ layerVisibility, mapControls }: KakaoMapPanelProps) {
  return <RegionRiskMapPanel layerVisibility={layerVisibility} mapControls={mapControls} />;
}
