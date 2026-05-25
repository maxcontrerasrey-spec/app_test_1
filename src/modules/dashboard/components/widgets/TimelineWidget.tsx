import type { ResolvedWidget } from "../../types";

export function TimelineWidget({ widget }: { widget: ResolvedWidget }) {
  return (
    <article className="widget-card widget-timeline" style={{ height: '100%' }}>
      <div className="widget-header">
        <h3 className="widget-title">{widget.name}</h3>
        <button className="widget-menu-btn" title="Options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
      
      <div className="nx-timeline">
        <div className="nx-time-item">
          <div className="nx-time-dot" style={{ background: 'var(--color-success)' }}></div>
          <div className="nx-time-content">
            <p className="nx-time-date">Hace 15 min</p>
            <p className="nx-time-text"><strong>Folio REQ-0041</strong> fue aprobado por Operaciones.</p>
          </div>
        </div>
        <div className="nx-time-item">
          <div className="nx-time-dot" style={{ background: 'var(--accent)' }}></div>
          <div className="nx-time-content">
            <p className="nx-time-date">Hace 2 horas</p>
            <p className="nx-time-text">Sistema generó <strong>45 pases de ingreso</strong> automáticamente.</p>
          </div>
        </div>
        <div className="nx-time-item">
          <div className="nx-time-dot" style={{ background: 'var(--color-warning)' }}></div>
          <div className="nx-time-content">
            <p className="nx-time-date">Ayer, 16:30</p>
            <p className="nx-time-text"><strong>Alerta SLA:</strong> Proceso de firmas superó el umbral de 48h.</p>
          </div>
        </div>
      </div>
    </article>
  );
}
