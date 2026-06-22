import { useDashboardStore } from '../../shared/store/dashboardStore';

export function IncidentTimeline() {
  const incidents = useDashboardStore((state) => state.activeIncidents);

  return (
    <section className="timeline-band">
      <div className="timeline-heading">
        <h2>최근 이벤트 타임라인</h2>
        <span>{incidents.length}건 진행 중</span>
      </div>
      <div className="timeline-list">
        {incidents.map((incident) => (
          <article key={incident.id} className="timeline-item">
            <time>{incident.reportedAt}</time>
            <span className={`severity-dot severity-${incident.severity.toLowerCase()}`} />
            <div>
              <strong>{incident.district}</strong>
              <p>{incident.summary}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
