import React from 'react';
import { LogEntry, STAGES } from '../data';
import styles from './SendLog.module.css';

interface Props {
  logs: LogEntry[];
}

export default function SendLog({ logs }: Props) {
  return (
    <div className={styles.wrap}>
      <p className={styles.sectionLabel}>전송 로그</p>
      <div className={styles.list}>
        {logs.map((log) => {
          const stage = STAGES.find((s) => s.key === log.stage);
          return (
            <div key={log.id} className={styles.item}>
              <span className={styles.stage} style={{ color: stage?.color }}>
                {stage?.label}
              </span>
              <span className={styles.ch}>{log.channel}</span>
              <span className={styles.msg}>{log.preview}</span>
              <span className={styles.time}>{log.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
