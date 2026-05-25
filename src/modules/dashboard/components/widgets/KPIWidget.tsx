import type { ResolvedWidget } from "../../types";

export function KPIWidget({ widget }: { widget: ResolvedWidget }) {
  return (
    <article className="reference-card widget-kpi">
      <div className="section-head">
        <div>
          <p className="eyebrow">Métricas</p>
          <h3>{widget.name}</h3>
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi-box">
          <span className="kpi-value">12</span>
          <span className="kpi-label">Vacantes Abiertas</span>
          <span className="kpi-trend kpi-trend--down">↓ 2 vs mes anterior</span>
        </div>
        <div className="kpi-box">
          <span className="kpi-value">85%</span>
          <span className="kpi-label">Cobertura de Turnos</span>
          <span className="kpi-trend kpi-trend--up">↑ 5% vs mes anterior</span>
        </div>
        <div className="kpi-box">
          <span className="kpi-value">4.2</span>
          <span className="kpi-label">Días SLA Aprobación</span>
          <span className="kpi-trend kpi-trend--warning">↑ 1.1 días de retraso</span>
        </div>
      </div>
    </article>
  );
}
