import type { ResolvedWidget } from "../../types";

export function TasksWidget({ widget }: { widget: ResolvedWidget }) {
  return (
    <article className="widget-card widget-tasks" style={{ height: '100%' }}>
      <div className="widget-header">
        <h3 className="widget-title">{widget.name}</h3>
        <button className="widget-menu-btn" title="Options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
      
      <div className="nx-table-wrapper">
        <table className="nx-table">
          <thead>
            <tr>
              <th>Folio / Elemento</th>
              <th>Estado</th>
              <th className="nx-td-numeric">Prioridad</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="nx-td-primary">REQ-0042 (Operador Camión)</td>
              <td>
                <span className="nx-status">
                  <span className="nx-dot pending"></span> En Revisión
                </span>
              </td>
              <td className="nx-td-numeric" style={{ color: 'var(--color-warning)' }}>Alta</td>
            </tr>
            <tr>
              <td className="nx-td-primary">Anexo Contrato (J. Pérez)</td>
              <td>
                <span className="nx-status">
                  <span className="nx-dot healthy"></span> Aprobado
                </span>
              </td>
              <td className="nx-td-numeric">Normal</td>
            </tr>
            <tr>
              <td className="nx-td-primary">Certificado Antigüedad</td>
              <td>
                <span className="nx-status">
                  <span className="nx-dot error"></span> Bloqueado
                </span>
              </td>
              <td className="nx-td-numeric" style={{ color: 'var(--color-danger)' }}>Crítica</td>
            </tr>
            <tr>
              <td className="nx-td-primary">REQ-0045 (Supervisor)</td>
              <td>
                <span className="nx-status">
                  <span className="nx-dot running"></span> Entrevista
                </span>
              </td>
              <td className="nx-td-numeric">Alta</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
