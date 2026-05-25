import type { ResolvedWidget } from "../../types";

export function KPIWidget({ widget }: { widget: ResolvedWidget }) {
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
            <span className="nx-kpi-value">142</span>
            <span className="nx-kpi-label">Vacantes</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Norte</span>
            <div className="nx-bar-track"><div className="nx-bar-fill blue" style={{ width: '85%' }}></div></div>
            <span className="nx-bar-value">85</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Sur</span>
            <div className="nx-bar-track"><div className="nx-bar-fill purple" style={{ width: '40%' }}></div></div>
            <span className="nx-bar-value">40</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Centro</span>
            <div className="nx-bar-track"><div className="nx-bar-fill yellow" style={{ width: '17%' }}></div></div>
            <span className="nx-bar-value">17</span>
          </div>
        </div>

        <div className="nx-kpi-box">
          <div className="nx-kpi-main">
            <span className="nx-kpi-value">98%</span>
            <span className="nx-kpi-label">Cobertura SLAs</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Reclut.</span>
            <div className="nx-bar-track"><div className="nx-bar-fill green" style={{ width: '92%', background: '#10B981' }}></div></div>
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
