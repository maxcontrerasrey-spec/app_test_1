export function SequencesTab() {
  return (
    <div className="tab-container">
      <div className="tab-header">
        <div>
          <h2>Workflow Sequences</h2>
          <span className="subtitle">SEQUENCES & TIMELINE</span>
        </div>
      </div>

      <div className="sequences-board">
        <div className="timeline-container">
          <div className="timeline-item completed">
            <div className="timeline-marker"></div>
            <div className="timeline-content">
              <h4>Caso Creado</h4>
              <p>Stan Triepels - Reclutamiento aprobó el folio.</p>
              <span className="timeline-date">Aug 10, 2022</span>
            </div>
          </div>

          <div className="timeline-item completed">
            <div className="timeline-marker"></div>
            <div className="timeline-content">
              <h4>Tareas de RRHH Asignadas</h4>
              <p>Se generaron 3 tareas para el departamento de Recursos Humanos.</p>
              <span className="timeline-date">Aug 10, 2022</span>
            </div>
          </div>

          <div className="timeline-item active">
            <div className="timeline-marker"></div>
            <div className="timeline-content">
              <h4>Esperando Exámenes</h4>
              <p>Esperando la resolución de exámenes pre-ocupacionales (SLA: 48h).</p>
              <span className="timeline-date">Aug 12, 2022</span>
            </div>
          </div>

          <div className="timeline-item pending">
            <div className="timeline-marker"></div>
            <div className="timeline-content">
              <h4>Habilitación TI</h4>
              <p>Creación de credenciales en Active Directory.</p>
              <span className="timeline-date">Depende de: Exámenes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
