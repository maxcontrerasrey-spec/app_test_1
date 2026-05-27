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
    <div
      className={`dashboard-floating-menu ${isOpen ? "dashboard-floating-menu-open" : ""}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="dashboard-floating-menu-trigger"
        aria-expanded={isOpen}
        aria-controls="dashboard-floating-menu-panel"
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => setIsOpen(true)}
        aria-label="Abrir acciones rápidas"
      >
        <span className="dashboard-floating-menu-trigger-badge" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 3L14.6 8.2L20 9L16 13L17 19L12 16.2L7 19L8 13L4 9L9.4 8.2L12 3Z"
              fill="url(#floating-action-gradient)"
            />
            <defs>
              <linearGradient id="floating-action-gradient" x1="4" y1="3" x2="20" y2="19" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2D63FF" />
                <stop offset="0.55" stopColor="#4C8CFF" />
                <stop offset="1" stopColor="#7EE0FF" />
              </linearGradient>
            </defs>
          </svg>
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
