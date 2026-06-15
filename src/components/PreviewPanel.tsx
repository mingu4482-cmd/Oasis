import React, { useState } from 'react';
import { Send, MessageSquare, Hash } from 'lucide-react';
import { Stage } from '../data';
import styles from './PreviewPanel.module.css';

interface Props {
  preview: string;
  stage: Stage;
  onSend: (channels: string[]) => void;
}

export default function PreviewPanel({ preview, stage, onSend }: Props) {
  const [sms, setSms] = useState(true);
  const [slack, setSlack] = useState(true);
  const [sent, setSent] = useState(false);

  function handleSend() {
    const ch: string[] = [];
    if (sms) ch.push('SMS');
    if (slack) ch.push('Slack');
    if (!ch.length) return;
    onSend(ch);
    setSent(true);
    setTimeout(() => setSent(false), 1800);
  }

  const charCount = preview.length;

  return (
    <div className={styles.panel}>
      <p className={styles.sectionLabel}>미리보기</p>

      <div className={styles.charRow}>
        <span className={styles.charLabel}>SMS 미리보기</span>
        <span className={`${styles.charCount} ${charCount > 90 ? styles.over : ''}`}>
          {charCount}자
        </span>
      </div>
      <pre className={styles.preview}>{preview}</pre>

      <p className={styles.sectionLabel} style={{ marginTop: 8 }}>발송 채널</p>
      <div className={styles.channels}>
        <button
          className={`${styles.ch} ${sms ? styles.chActive : ''}`}
          style={sms ? { borderColor: stage.borderColor, color: stage.color, background: stage.bg } : {}}
          onClick={() => setSms((v) => !v)}
        >
          <MessageSquare size={14} /> SMS
        </button>
        <button
          className={`${styles.ch} ${slack ? styles.chActive : ''}`}
          style={slack ? { borderColor: stage.borderColor, color: stage.color, background: stage.bg } : {}}
          onClick={() => setSlack((v) => !v)}
        >
          <Hash size={14} /> Slack
        </button>
      </div>

      <div className={styles.recipient}>
        <label className={styles.recipientLabel}>수신 대상</label>
        <input className={styles.recipientInput} defaultValue="010-0000-0000" />
      </div>

      <button
        className={styles.sendBtn}
        style={{ background: sent ? '#0f6e52' : stage.color }}
        onClick={handleSend}
        disabled={!sms && !slack}
      >
        <Send size={14} />
        {sent ? '발송 완료' : '발송'}
      </button>
    </div>
  );
}
