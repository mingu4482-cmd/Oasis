import { RegionRiskMapPanel } from './RegionRiskMapPanel';
import type { ReactNode } from 'react';

interface KakaoMapPanelProps {
  className?: string;
  height?: string;
  layerVisibility?: {
    regionalRisk: boolean;
    waterLevel: boolean;
    rainfall: boolean;
    safeRoute?: boolean;
  };
  mapControls?: ReactNode;
}

export function KakaoMapPanel({ className, height, layerVisibility, mapControls }: KakaoMapPanelProps) {
  return <RegionRiskMapPanel className={className} height={height} layerVisibility={layerVisibility} mapControls={mapControls} />;
}
