import type { ResolvedWidget } from "../../types";

export function AlertsWidget({ widget }: { widget: ResolvedWidget }) {
  return (
    <article className="widget-card widget-alert" style={{ width: '100%' }}>
      <div className="widget-header">
        <h3 className="widget-title">{widget.name}</h3>
        <button className="widget-menu-btn" title="Options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
      
      <div className="nx-alerts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        
        <div className="nx-alert-item warning">
          <p className="nx-alert-title">SLA Atrasado: 3 Candidatos</p>
          <p className="nx-alert-desc">Operador Equipo Pesado superó los 15 días límite en revisión técnica.</p>
          <p className="nx-alert-meta">Hace 2 hrs · reclutamiento</p>
        </div>

        <div className="nx-alert-item critical">
          <p className="nx-alert-title">Acreditaciones Críticas</p>
          <p className="nx-alert-desc">5 conductores vencerán pase minero en menos de 48 horas.</p>
          <p className="nx-alert-meta">Hace 4 hrs · operaciones</p>
        </div>

        <div className="nx-alert-item info">
          <p className="nx-alert-title">Nuevo Turno Asignado</p>
          <p className="nx-alert-desc">Se generó exitosamente la rotativa 7x7 para Faena Norte.</p>
          <p className="nx-alert-meta">Hace 6 hrs · sistema</p>
        </div>

      </div>
    </article>
  );
}
