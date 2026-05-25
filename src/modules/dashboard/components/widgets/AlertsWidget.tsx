import type { ResolvedWidget } from "../../types";

export function AlertsWidget({ widget, dashboardData }: { widget: ResolvedWidget, dashboardData?: any }) {
  const alerts = dashboardData?.alertsData || [];

  return (
    <article className="widget-card widget-alert" style={{ width: '100%' }}>
      <div className="widget-header">
        <h3 className="widget-title">{widget.name}</h3>
        <button className="widget-menu-btn" title="Options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
      
      <div className="nx-alerts-grid">
        {alerts.length === 0 ? (
          <p className="helper-copy" style={{ padding: '16px' }}>No hay alertas activas en este momento.</p>
        ) : (
          alerts.map((alert: any) => (
            <div key={alert.id} className={`nx-alert-item ${alert.severity}`}>
              <p className="nx-alert-title">{alert.title}</p>
              <p className="nx-alert-desc">{alert.description}</p>
              <p className="nx-alert-meta">Generado: {new Date(alert.created_at).toLocaleDateString()} · {alert.source}</p>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
