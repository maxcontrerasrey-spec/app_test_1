import type { ResolvedWidget } from "../../types";

export function TimelineWidget({ widget }: { widget: ResolvedWidget }) {
  return (
    <article className="reference-card widget-timeline">
      <div className="section-head">
        <div>
          <p className="eyebrow">Trazabilidad</p>
          <h3>{widget.name}</h3>
        </div>
      </div>
      <div className="timeline-container">
        <div className="timeline-item">
          <div className="timeline-marker"></div>
          <div className="timeline-content">
            <p className="timeline-time">Hace 15 min</p>
            <p className="timeline-desc"><strong>Juan Pérez</strong> aprobó el folio REQ-0041.</p>
          </div>
        </div>
        <div className="timeline-item">
          <div className="timeline-marker"></div>
          <div className="timeline-content">
            <p className="timeline-time">Hace 2 horas</p>
            <p className="timeline-desc">Sistema generó 45 nuevos pases de ingreso.</p>
          </div>
        </div>
        <div className="timeline-item">
          <div className="timeline-marker"></div>
          <div className="timeline-content">
            <p className="timeline-time">Ayer, 16:30</p>
            <p className="timeline-desc"><strong>María López</strong> creó 2 nuevos casos de reclutamiento.</p>
          </div>
        </div>
      </div>
    </article>
  );
}
