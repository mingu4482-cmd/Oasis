import { BellRing, Send } from 'lucide-react';
import { IncidentTimeline } from '../../features/alert-system/IncidentTimeline';
import { AppShell } from '../../shared/components/AppShell';

export function AlertCenterPage() {
  return (
    <AppShell>
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
              <select defaultValue="WARNING">
                <option>WATCH</option>
                <option>WARNING</option>
                <option>DANGER</option>
              </select>
            </label>
            <label>
              대상 권역
              <input defaultValue="강남구, 서초구" />
            </label>
            <label className="full">
              메시지
              <textarea defaultValue="침수 위험이 높아지고 있습니다. 저지대 주차장과 하천변 접근을 피해주세요." />
            </label>
            <button className="command-button" type="button">
              <Send size={16} aria-hidden="true" />
              발송 준비
            </button>
          </div>
        </section>
        <IncidentTimeline />
      </div>
    </AppShell>
  );
}
