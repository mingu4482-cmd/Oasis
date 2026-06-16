import { CheckCircle2, FileText, Megaphone, Play } from 'lucide-react';

const actions = [
  { label: '경보 메시지 발송', status: '대기', icon: Megaphone },
  { label: '현장 체크리스트 실행', status: '진행 가능', icon: CheckCircle2 },
  { label: '상황 보고서 생성', status: '초안 준비', icon: FileText },
];

export function McpAutomationPanel() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">MCP</span>
          <h2>대응 자동화</h2>
        </div>
        <button className="primary-icon-button" type="button" aria-label="자동화 실행">
          <Play size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="action-list">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <div key={action.label} className="action-row">
              <Icon size={18} aria-hidden="true" />
              <span>{action.label}</span>
              <strong>{action.status}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
