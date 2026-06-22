import { ReactNode } from 'react';

interface MetricTileProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'watch' | 'warning' | 'danger';
  icon?: ReactNode;
}

export function MetricTile({ label, value, tone = 'neutral', icon }: MetricTileProps) {
  return (
    <div className={`metric-tile metric-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
