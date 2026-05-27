import { useState } from "react";

const pendingActions = [
  "Nuevo Reclutamiento",
  "Ingresar Candidato",
  "Generar Certificado",
  "Planificar Turno",
  "Opciones del dashboard",
  "Acciones de perfil"
];

export function FloatingActionMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`dashboard-floating-menu ${isOpen ? "dashboard-floating-menu-open" : ""}`}>
      <button
        type="button"
        className="dashboard-floating-menu-trigger"
        aria-expanded={isOpen}
        aria-controls="dashboard-floating-menu-panel"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="dashboard-floating-menu-trigger-copy">
          {isOpen ? "Cerrar accesos" : "Accesos"}
        </span>
        <span className="dashboard-floating-menu-trigger-icon" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen ? (
        <div id="dashboard-floating-menu-panel" className="dashboard-floating-menu-panel">
          <div className="dashboard-floating-menu-head">
            <strong>Backlog de acciones</strong>
            <p className="helper-copy">
              Estas entradas se moverán aquí cuando tengan lógica operativa real.
            </p>
          </div>

          <ul className="dashboard-floating-menu-list">
            {pendingActions.map((action) => (
              <li key={action} className="dashboard-floating-menu-item">
                <span className="dashboard-floating-menu-item-title">{action}</span>
                <span className="dashboard-floating-menu-item-state">Próximamente</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
