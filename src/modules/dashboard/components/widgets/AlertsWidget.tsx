import type { ResolvedWidget } from "../../types";

export function AlertsWidget({ widget }: { widget: ResolvedWidget }) {
  // In a real implementation, this would fetch specific alerts based on the user's role
  return (
    <article className="reference-card widget-alert">
      <div className="section-head">
        <div>
          <p className="eyebrow">Atención Requerida</p>
          <h3>{widget.name}</h3>
        </div>
      </div>
      <div className="alert-list">
        <div className="alert-item alert-item--critical">
          <span className="alert-dot"></span>
          <div>
            <strong>3 Conductores</strong>
            <p>Tienen la acreditación minera vencida o por vencer en 48 hrs.</p>
          </div>
          <button className="text-button">Ver Detalle</button>
        </div>
        <div className="alert-item alert-item--warning">
          <span className="alert-dot"></span>
          <div>
            <strong>Reclutamiento Atrasado</strong>
            <p>2 vacantes para Operador de Equipo Pesado superaron el SLA de 15 días.</p>
          </div>
          <button className="text-button">Revisar Casos</button>
        </div>
      </div>
    </article>
  );
}
