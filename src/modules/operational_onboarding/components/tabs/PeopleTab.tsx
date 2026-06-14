import { useState } from "react";
import type { EmployeeOnboardingCase } from "../../types";

// Mock data to demonstrate the UI until the backend is wired up completely
const mockCases: any[] = [
  {
    id: "case-1",
    candidate_name: "Stan Triepels",
    email: "hello@chiefonboarding.com",
    target_ready_date: "2022-08-19",
    cargo: "Lead developer",
    progress_percent: 75,
    tasks_by_area: [
      { area: "TI", total: 4, completed: 4 },
      { area: "RRHH", total: 3, completed: 2 },
      { area: "HSEC", total: 2, completed: 0 }
    ]
  },
  {
    id: "case-2",
    candidate_name: "John Weller",
    email: "test12345@chiefonboarding.com",
    target_ready_date: "2022-07-21",
    cargo: "Product Manager",
    progress_percent: 20,
    tasks_by_area: [
      { area: "TI", total: 4, completed: 1 },
      { area: "RRHH", total: 3, completed: 1 },
      { area: "HSEC", total: 2, completed: 0 }
    ]
  }
];

export function PeopleTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <div>
          <h2>New hires</h2>
          <span className="subtitle">PEOPLE</span>
        </div>
        <button className="btn-primary">+ Add</button>
      </div>

      <div className="people-list-container">
        <div className="people-list-header">
          <div className="col-name">NAME</div>
          <div className="col-date">START DATE</div>
          <div className="col-position">POSITION</div>
          <div className="col-progress">PROGRESS</div>
          <div className="col-action"></div>
        </div>

        <div className="people-list-body">
          {mockCases.map(c => (
            <div key={c.id} className={`people-row-wrapper ${expandedId === c.id ? "expanded" : ""}`}>
              <div className="people-row">
                <div className="col-name">
                  <div className="avatar-initials">{c.candidate_name.substring(0, 2).toUpperCase()}</div>
                  <div className="name-info">
                    <strong>{c.candidate_name}</strong>
                    <span className="email">{c.email}</span>
                  </div>
                </div>
                <div className="col-date">{c.target_ready_date}</div>
                <div className="col-position">{c.cargo}</div>
                <div className="col-progress">
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${c.progress_percent}%` }}></div>
                  </div>
                </div>
                <div className="col-action">
                  <button className="btn-view" onClick={() => toggleExpand(c.id)}>
                    View
                  </button>
                </div>
              </div>
              
              {expandedId === c.id && (
                <div className="people-row-expanded">
                  <h4>Desglose por Departamento</h4>
                  <div className="area-progress-grid">
                    {c.tasks_by_area.map((area: any) => (
                      <div key={area.area} className="area-progress-card">
                        <h5>{area.area}</h5>
                        <p>{area.completed} de {area.total} tareas completadas</p>
                        <div className="progress-bar-bg small">
                          <div 
                            className="progress-bar-fill" 
                            style={{ width: `${(area.completed / area.total) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="expanded-actions">
                    <button className="btn-secondary">Ver Bitácora de Caso</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
