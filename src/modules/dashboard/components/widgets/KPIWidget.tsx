import type { ResolvedWidget } from "../../types";

export function KPIWidget({ widget, dashboardData }: { widget: ResolvedWidget, dashboardData?: any }) {
  const kpis = dashboardData?.kpisData || {
    total_vacancies: 0,
    active_cases: 0,
    pending_approvals: 0
  };

  return (
    <article className="widget-card widget-kpi">
      <div className="widget-header">
        <h3 className="widget-title">{widget.name}</h3>
        <button className="widget-menu-btn" title="Options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
      
      <div className="nx-kpi-grid">
        <div className="nx-kpi-box">
          <div className="nx-kpi-main">
            <span className="nx-kpi-value">{kpis.total_vacancies}</span>
            <span className="nx-kpi-label">Vacantes Activas</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Casos Activos</span>
            <div className="nx-bar-track"><div className="nx-bar-fill blue" style={{ width: '100%' }}></div></div>
            <span className="nx-bar-value">{kpis.active_cases}</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Pendientes Aprob.</span>
            <div className="nx-bar-track"><div className="nx-bar-fill yellow" style={{ width: kpis.pending_approvals > 0 ? '50%' : '0%' }}></div></div>
            <span className="nx-bar-value">{kpis.pending_approvals}</span>
          </div>
        </div>

        {/* Keeping the coverage one static for now as example of multi-box KPI, 
            unless we write a complex SQL to calculate SLA coverage */}
        <div className="nx-kpi-box">
          <div className="nx-kpi-main">
            <span className="nx-kpi-value">98%</span>
            <span className="nx-kpi-label">Cobertura SLAs</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Reclut.</span>
            <div className="nx-bar-track"><div className="nx-bar-fill green" style={{ width: '92%' }}></div></div>
            <span className="nx-bar-value">92%</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Contratos</span>
            <div className="nx-bar-track"><div className="nx-bar-fill blue" style={{ width: '100%' }}></div></div>
            <span className="nx-bar-value">100%</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Certificados</span>
            <div className="nx-bar-track"><div className="nx-bar-fill red" style={{ width: '65%' }}></div></div>
            <span className="nx-bar-value">65%</span>
          </div>
        </div>
      </div>
    </article>
  );
}
