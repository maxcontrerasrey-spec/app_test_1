import type { ResolvedWidget } from "../../types";

export function QuickActionsWidget({ widget }: { widget: ResolvedWidget }) {
  return (
    <article className="reference-card widget-actions">
      <div className="section-head">
        <div>
          <p className="eyebrow">Productividad</p>
          <h3>{widget.name}</h3>
        </div>
      </div>
      <div className="actions-grid">
        <button className="primary-button">Nuevo Reclutamiento</button>
        <button className="secondary-button">Ingresar Candidato</button>
        <button className="secondary-button">Generar Certificado</button>
        <button className="secondary-button">Planificar Turno</button>
      </div>
    </article>
  );
}
