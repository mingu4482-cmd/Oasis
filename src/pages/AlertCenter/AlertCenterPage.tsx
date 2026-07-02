import { useState } from 'react';
import { BellRing, CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';
import { IncidentTimeline } from '../../features/alert-system/IncidentTimeline';
import { broadcastEmergency, McpBroadcastResult } from '../../shared/api/mcpApi';
import { useDashboardStore } from '../../shared/store/dashboardStore';

const targetDistricts = [
  '강남구', '서초구', '관악구', '동작구', '영등포구',
  '구로구', '양천구', '마포구', '성동구', '광진구',
];

export function AlertCenterPage() {
  const [grade, setGrade] = useState<'WATCH' | 'WARNING' | 'DANGER'>('WARNING');
  const [regions, setRegions] = useState('강남구');
  const [message, setMessage] = useState('침수 위험이 높아지고 있습니다. 저지대 주차장과 하천변 접근을 피해주세요.');
  const [smsNumber, setSmsNumber] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<McpBroadcastResult | null>(null);
  const [error, setError] = useState('');
  const addActiveIncident = useDashboardStore((state) => state.addActiveIncident);

  const handleSend = async () => {
    const targets = regions.split(',').map((region) => region.trim()).filter(Boolean);
    if (targets.length === 0 || !message.trim()) {
      setError('대상 권역과 메시지를 입력해주세요.');
      return;
    }
    const normalizedSmsNumber = smsNumber.replace(/[^0-9]/g, '');
    if (normalizedSmsNumber && !/^01[016789][0-9]{7,8}$/.test(normalizedSmsNumber)) {
      setError('수신 전화번호를 정확히 입력해주세요. 예: 01012345678');
      return;
    }
    if (!window.confirm(`${targets.join(', ')}에 ${grade} 경보를 실제 발송할까요?`)) return;
    setSending(true); setError(''); setResult(null);
    try {
      const response = await broadcastEmergency({
        grade,
        regions: targets,
        message: message.trim(),
        sms_numbers: normalizedSmsNumber ? [normalizedSmsNumber] : undefined,
      });
      setResult(response);
      const now = new Date();
      targets.forEach((district, index) => addActiveIncident({
        id: `${response.incident_id}-${index}`,
        district,
        severity: grade === 'WATCH' ? 'WATCH' : grade,
        summary: message.trim(),
        reportedAt: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '경보 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-layout two-column">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">경보</span>
            <h2>다채널 알림 발송</h2>
          </div>
          <BellRing size={20} aria-hidden="true" />
        </div>
        <div className="form-grid">
          <label>
            발송 등급
            <select value={grade} onChange={(event) => setGrade(event.target.value as typeof grade)}>
              <option>WATCH</option>
              <option>WARNING</option>
              <option>DANGER</option>
            </select>
          </label>
          <label>
            대상 권역
            <select value={regions} onChange={(event) => setRegions(event.target.value)}>
              {targetDistricts.map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </label>
          <label className="full">
            메시지
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <label className="full">
            SMS 수신번호 (선택)
            <input
              type="tel"
              inputMode="numeric"
              placeholder="01012345678"
              value={smsNumber}
              onChange={(event) => setSmsNumber(event.target.value)}
            />
          </label>
          <button className="command-button" type="button" onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="spin-icon" size={16} /> : <Send size={16} aria-hidden="true" />}
            {sending ? '발송 중...' : '발송 준비'}
          </button>
        </div>
        {error && <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#fef2f2', color: '#991b1b', display: 'flex', gap: 8 }}><XCircle size={17} />{error}</div>}
        {result && <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: result.results.slack.success ? '#f0fdf4' : '#fff7ed', color: result.results.slack.success ? '#166534' : '#9a3412' }}>
          <strong style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CheckCircle2 size={17} /> 경보 처리 완료</strong>
          <div style={{ marginTop: 8, fontSize: 13 }}>대상: {result.location} · 등급: {result.risk_level}</div>
          <div style={{ fontSize: 13 }}>Slack: {result.results.slack.success ? '발송 성공' : `발송 실패 (${result.results.slack.message})`}</div>
          {result.results.sms && <div style={{ fontSize: 13 }}>SMS: {result.results.sms.sent}/{result.results.sms.total}건 성공 · {result.results.sms.failed}건 실패</div>}
          <div style={{ fontSize: 13 }}>사건 ID: {result.incident_id} · 보고서 ID: {result.report_id}</div>
        </div>}
      </section>
      <IncidentTimeline />
    </div>
  );
}
