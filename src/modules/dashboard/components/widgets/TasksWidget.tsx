import type { ResolvedWidget } from "../../types";

export function TasksWidget({ widget }: { widget: ResolvedWidget }) {
  return (
    <article className="reference-card widget-tasks">
      <div className="section-head">
        <div>
          <p className="eyebrow">Mi Trabajo</p>
          <h3>{widget.name}</h3>
        </div>
        <button className="secondary-button">Ver Todo</button>
      </div>
      
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Prioridad</th>
              <th>Tipo</th>
              <th>Detalle</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="badge badge--high">Alta</span></td>
              <td>Aprobación</td>
              <td>Folio REQ-0042 (Operador Camión)</td>
              <td>Pendiente de Revisión</td>
            </tr>
            <tr>
              <td><span className="badge badge--medium">Media</span></td>
              <td>Selección</td>
              <td>Entrevista con Candidato A.</td>
              <td>Agendada Hoy</td>
            </tr>
            <tr>
              <td><span className="badge badge--medium">Media</span></td>
              <td>Documentos</td>
              <td>Validar anexo de contrato</td>
              <td>En Revisión</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
