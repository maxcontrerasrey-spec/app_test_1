import { useState, Fragment } from "react";
import { useOnboardingCases } from "../../hooks/useOnboardingCases";
import { useOnboardingTasks } from "../../hooks/useOnboardingTasks";
import { useOnboardingActivityLog } from "../../hooks/useOnboardingActivityLog";
import { StartOnboardingModal } from "../modals/StartOnboardingModal";

function formatDateLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function resolveActivityLabel(action: string) {
  switch (action) {
    case "case_created":
      return "Caso iniciado";
    case "case_status_changed":
      return "Estado actualizado";
    case "task_created":
      return "Tarea creada";
    case "task_status_changed":
      return "Estado de tarea actualizado";
    case "task_updated":
      return "Tarea actualizada";
    case "evidence_uploaded":
      return "Evidencia cargada";
    default:
      return action;
  }
}

export function PeopleTab() {
  const { data: cases, isLoading, isError, error } = useOnboardingCases();
  const tasksQuery = useOnboardingTasks();
  const activityLogQuery = useOnboardingActivityLog();
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
                const caseTasks = (tasksQuery.data ?? []).filter((task) => task.case_id === c.id);
                const activityItems = (activityLogQuery.data ?? [])
                  .filter((entry) => entry.case_id === c.id)
                  .slice(0, 6);
                const name = c.candidates
                  ? `${c.candidates.full_name}`
                  : c.employees
                    ? `${c.employees.full_name}`
                    : "Candidato Desconocido";
                const rut = c.candidates?.national_id || c.employees?.document_number || "-";

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
                      <td>{formatDateLabel(c.target_ready_date)}</td>
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
                                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                  gap: "1rem",
                                }}
                              >
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

                              <div style={{ marginTop: "1.5rem", display: "grid", gap: "1rem" }}>
                                <div>
                                  <h5 style={{ margin: "0 0 0.75rem" }}>Tareas activas del caso</h5>
                                  {tasksQuery.isError ? (
                                    <p className="form-status form-status-error" style={{ margin: 0 }}>
                                      {(tasksQuery.error as Error).message}
                                    </p>
                                  ) : caseTasks.length === 0 ? (
                                    <p className="tracking-empty-state" style={{ margin: 0 }}>
                                      Aún no hay tareas operativas asociadas a este caso.
                                    </p>
                                  ) : (
                                    <div style={{ display: "grid", gap: "0.65rem" }}>
                                      {caseTasks.map((task) => (
                                        <div
                                          key={task.id}
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: "1rem",
                                            flexWrap: "wrap",
                                            border: "1px solid var(--border-color)",
                                            borderRadius: "0.75rem",
                                            padding: "0.85rem 1rem",
                                            background: "var(--surface-color)",
                                          }}
                                        >
                                          <div style={{ display: "grid", gap: "0.25rem" }}>
                                            <strong>{task.task_name}</strong>
                                            <span className="tracking-filter-caption">
                                              {task.area_responsible}
                                              {task.role_responsible ? ` · ${task.role_responsible}` : ""}
                                            </span>
                                            {task.task_description ? (
                                              <span className="tracking-filter-caption">
                                                {task.task_description}
                                              </span>
                                            ) : null}
                                          </div>
                                          <div style={{ display: "grid", gap: "0.25rem", textAlign: "right" }}>
                                            <strong>{task.status}</strong>
                                            <span className="tracking-filter-caption">
                                              SLA: {task.due_at ? formatDateLabel(task.due_at) : "Sin vencimiento"}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <h5 style={{ margin: "0 0 0.75rem" }}>Bitácora reciente</h5>
                                  {activityLogQuery.isLoading ? (
                                    <p className="tracking-empty-state" style={{ margin: 0 }}>
                                      Cargando bitácora...
                                    </p>
                                  ) : activityLogQuery.isError ? (
                                    <p className="form-status form-status-error" style={{ margin: 0 }}>
                                      {(activityLogQuery.error as Error).message}
                                    </p>
                                  ) : activityItems.length === 0 ? (
                                    <p className="tracking-empty-state" style={{ margin: 0 }}>
                                      No hay movimientos registrados para este caso.
                                    </p>
                                  ) : (
                                    <div style={{ display: "grid", gap: "0.65rem" }}>
                                      {activityItems.map((entry) => (
                                        <div
                                          key={entry.id}
                                          style={{
                                            border: "1px solid var(--border-color)",
                                            borderRadius: "0.75rem",
                                            padding: "0.85rem 1rem",
                                            background: "var(--surface-color)",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              justifyContent: "space-between",
                                              gap: "1rem",
                                              flexWrap: "wrap",
                                            }}
                                          >
                                            <strong>{resolveActivityLabel(entry.action)}</strong>
                                            <span className="tracking-filter-caption">
                                              {formatDateLabel(entry.created_at)}
                                            </span>
                                          </div>
                                          <div
                                            className="tracking-filter-caption"
                                            style={{ marginTop: "0.35rem" }}
                                          >
                                            {entry.tasks?.task_name ? `${entry.tasks.task_name} · ` : ""}
                                            {entry.profiles?.full_name || "Sistema"}
                                          </div>
                                          {entry.comment ? (
                                            <div
                                              className="tracking-filter-caption"
                                              style={{ marginTop: "0.35rem" }}
                                            >
                                              {entry.comment}
                                            </div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
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
