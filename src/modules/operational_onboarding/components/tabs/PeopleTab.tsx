import { useState, Fragment } from "react";
import { useOnboardingCases } from "../../hooks/useOnboardingCases";
import { StartOnboardingModal } from "../modals/StartOnboardingModal";

export function PeopleTab() {
  const { data: cases, isLoading, isError, error } = useOnboardingCases();
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isLoading) {
    return (
      <section className="info-card">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p className="tracking-empty-state">
            Cargando casos de alta operacional...
          </p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="info-card">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p className="form-status form-status-error">
            {(error as Error).message}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="info-card">
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Personal en Proceso</h3>
          <span className="tracking-filter-caption">
            Gestiona la habilitación y progreso de los candidatos en alta
            operacional.
          </span>
        </div>
        <div className="hr-incentives-history-actions">
          <button
            type="button"
            className="soft-primary-button"
            onClick={() => setIsModalOpen(true)}
          >
            + Nuevo Caso
          </button>
        </div>
      </div>

      {!cases || cases.length === 0 ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
          <p className="tracking-empty-state">
            No hay personal en proceso de alta operacional actualmente.
          </p>
        </div>
      ) : (
        <div className="tracking-table-container">
          <table className="tracking-table hr-incentives-table">
            <thead>
              <tr>
                <th>Personal</th>
                <th>Cargo</th>
                <th>Contrato</th>
                <th>Fecha Ingreso</th>
                <th>Progreso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const isActiveRow = selectedCaseId === c.id;
                const name = c.candidates
                  ? `${c.candidates.first_name} ${c.candidates.last_name}`
                  : c.employees
                    ? `${c.employees.first_name} ${c.employees.last_name}`
                    : "Candidato Desconocido";
                const rut = c.candidates?.rut || c.employees?.rut || "-";

                return (
                  <Fragment key={c.id}>
                    <tr
                      className={isActiveRow ? "tracking-row-selected" : ""}
                      onClick={() => setSelectedCaseId(isActiveRow ? "" : c.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <span
                          className="case-code-toggle"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            fontWeight: 600,
                          }}
                        >
                          <span
                            className={`expand-chevron ${isActiveRow ? "expand-chevron-open" : ""}`}
                            style={{
                              display: "inline-block",
                              fontSize: "1.2rem",
                              color: "var(--text-muted)",
                              transition: "transform 0.2s",
                              transform: isActiveRow ? "rotate(90deg)" : "none",
                            }}
                          >
                            ▸
                          </span>
                          {name}
                        </span>
                        <div
                          className="tracking-filter-caption"
                          style={{ marginLeft: "1.5rem" }}
                        >
                          {rut}
                        </div>
                      </td>
                      <td>{c.cargo || "-"}</td>
                      <td>{c.contrato || "-"}</td>
                      <td>{c.target_ready_date || "-"}</td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: "6px",
                              backgroundColor: "var(--border-color)",
                              borderRadius: "3px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${c.progress_percent}%`,
                                height: "100%",
                                backgroundColor: "var(--brand-primary)",
                              }}
                            ></div>
                          </div>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                            {Math.round(c.progress_percent)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong>{c.status}</strong>
                      </td>
                    </tr>

                    {isActiveRow ? (
                      <tr className="tracking-table-expanded-row">
                        <td colSpan={6}>
                          <div className="expanded-case-detail-grid">
                            <div className="expanded-detail-section">
                              <h4>DESGLOSE POR DEPARTAMENTO</h4>
                              <div
                                className="expanded-detail-fields"
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "1rem",
                                }}
                              >
                                <div
                                  className="expanded-detail-field-full"
                                  style={{ gridColumn: "1 / -1" }}
                                >
                                  <p
                                    className="tracking-empty-state"
                                    style={{ margin: 0 }}
                                  >
                                    El detalle de tareas por departamento se
                                    habilitará al conectar los sub-casos de
                                    tareas (employee_onboarding_tasks).
                                  </p>
                                </div>
                                <div>
                                  <small>Total Tareas</small>
                                  <strong>{c.total_tasks}</strong>
                                </div>
                                <div>
                                  <small>Completadas</small>
                                  <strong>{c.completed_tasks}</strong>
                                </div>
                                <div>
                                  <small>Vencidas</small>
                                  <strong
                                    style={{ color: "var(--status-danger)" }}
                                  >
                                    {c.expired_tasks}
                                  </strong>
                                </div>
                                <div>
                                  <small>Bloqueantes Pendientes</small>
                                  <strong
                                    style={{ color: "var(--status-danger)" }}
                                  >
                                    {c.blocking_pending_tasks}
                                  </strong>
                                </div>
                              </div>
                              <div style={{ marginTop: "1.5rem" }}>
                                <button
                                  type="button"
                                  className="soft-primary-button"
                                >
                                  Ver Bitácora de Caso
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <StartOnboardingModal onClose={() => setIsModalOpen(false)} />
      )}
    </section>
  );
}
