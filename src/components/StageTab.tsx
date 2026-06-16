import React from 'react';
import { Stage, StageKey } from '../data';
import styles from './StageTab.module.css';

interface Props {
  stages: Stage[];
  active: StageKey;
  onChange: (key: StageKey) => void;
}

export default function StageTab({ stages, active, onChange }: Props) {
  return (
    <div className={styles.tabs}>
      {stages.map((s) => (
        <button
          key={s.key}
          className={`${styles.tab} ${active === s.key ? styles.active : ''}`}
          style={active === s.key ? {
            background: s.bg,
            borderColor: s.borderColor,
            color: s.color,
          } : {}}
          onClick={() => onChange(s.key)}
        >
          <span
            className={styles.dot}
            style={{ background: s.color }}
          />
          {s.label}
        </button>
      ))}
    </div>
  );
}
