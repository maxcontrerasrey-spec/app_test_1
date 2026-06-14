export function TasksTab() {
  return (
    <div className="tab-container">
      <div className="tab-header">
        <div>
          <h2>My Tasks</h2>
          <span className="subtitle">TASKS (KANBAN)</span>
        </div>
      </div>

      <div className="kanban-board">
        <div className="kanban-column">
          <div className="kanban-col-header">
            <h3>Pending</h3>
            <span className="count-badge">2</span>
          </div>
          <div className="kanban-col-body">
            <div className="task-card">
              <div className="task-card-header">
                <h4 className="task-title">Entregar Equipo PPE</h4>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 m-0 mt-2">
                Preparar EPP talla L para el candidato Stan Triepels.
              </p>
              <div className="task-meta mt-3">
                <span className="meta-badge">HSEC</span>
                <span className="task-badge badge-sla">SLA: 24h</span>
              </div>
            </div>

            <div className="task-card">
              <div className="task-card-header">
                <h4 className="task-title">Crear Cuentas AD</h4>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 m-0 mt-2">
                Habilitar Active Directory y correo corporativo.
              </p>
              <div className="task-meta mt-3">
                <span className="meta-badge">TI</span>
                <span className="task-badge badge-blocking">Bloqueante</span>
              </div>
            </div>
          </div>
        </div>

        <div className="kanban-column">
          <div className="kanban-col-header">
            <h3>In Progress</h3>
            <span className="count-badge">0</span>
          </div>
          <div className="kanban-col-body">
            {/* Empty state for demo */}
          </div>
        </div>

        <div className="kanban-column">
          <div className="kanban-col-header">
            <h3>Completed</h3>
            <span className="count-badge">1</span>
          </div>
          <div className="kanban-col-body">
            <div className="task-card completed">
              <div className="task-card-header">
                <h4 className="task-title text-gray-400 line-through">Exámenes Pre-Ocupacionales</h4>
              </div>
              <div className="task-meta mt-3">
                <span className="meta-badge">RRHH</span>
                <span className="text-xs text-green-600 font-semibold">Completado ayer</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
