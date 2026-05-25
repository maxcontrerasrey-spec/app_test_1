import React, { useState } from "react";
import type { DashboardDataBundle, ResolvedWidget } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";
import { decideHiringApproval } from "../../../recruitment/services/hiringWorkflow";

type TasksWidgetProps = {
  widget: ResolvedWidget;
  dashboardData?: DashboardDataBundle;
  onAction?: (actionType: string, payload: string) => void;
};

function formatDateValue(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getPriorityClass(priority: string) {
  if (priority === "Crítica") return "nx-priority-critical";
  if (priority === "Alta") return "nx-priority-warning";
  return "nx-priority-normal";
}

export function TasksWidget({ widget, dashboardData, onAction }: TasksWidgetProps) {
  const tasks = dashboardData?.tasksData ?? [];
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  
  // Estados para acciones integradas (Aprobar/Rechazar)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [comments, setComments] = useState("");

  const handleRowClick = (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(taskId);
      setSubmitError(null);
      setComments("");
    }
  };

  const handleDecision = async (taskId: string, approvalId: number, decision: "approved" | "rejected") => {
    setIsSubmitting(true);
    setSubmitError(null);

    const { error } = await decideHiringApproval({
      approvalId,
      decision,
      comment: comments.trim() || undefined
    });

    setIsSubmitting(false);

    if (error) {
      setSubmitError(error);
    } else {
      setExpandedTaskId(null);
      if (onAction) {
        onAction("REFRESH_DATA", ""); // Refrescar el dashboard
      }
    }
  };

  return (
    <DashboardWidgetFrame title={widget.name} className="widget-tasks widget-fill-height">
      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Caso</th>
                <th>Estado</th>
                <th>Cargo</th>
                <th>Contrato / CC</th>
                <th>Cupos</th>
                <th>Candidatos activos</th>
                <th>Solicitó</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="nx-table-empty" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                    Excelente, no tienes tareas pendientes.
                  </td>
                </tr>
              ) : (
                tasks.map((task: any) => {
                  const isExpanded = expandedTaskId === task.id;
                  
                  return (
                    <React.Fragment key={task.id}>
                      <tr 
                        className={`tracking-table-row-clickable ${isExpanded ? "tracking-table-row-expanded" : ""}`}
                        onClick={() => handleRowClick(task.id)}
                      >
                        <td>
                          <span className="case-code-toggle">
                            <span className={`expand-chevron ${isExpanded ? "expand-chevron-open" : ""}`}>▸</span>
                            {task.folio}
                          </span>
                        </td>
                        <td>
                          <span className="tracking-status-pill">
                            {task.status_label}
                          </span>
                        </td>
                        <td>{task.job_position_name}</td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>{task.contract_name || "—"}</span>
                            {task.cost_center_code && <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>({task.cost_center_code})</span>}
                          </div>
                        </td>
                        <td>{task.requested_vacancies ?? "—"}</td>
                        <td>
                          <div className="candidate-count-indicator">
                            <span className="candidate-circle candidate-circle-neutral" title="Activos">
                              {task.candidate_count ?? 0}
                            </span>
                            <span className="candidate-circle-label">Activos</span>
                            <span className="candidate-circle candidate-circle-success" title="Listos">
                              {task.ready_candidates ?? 0}
                            </span>
                            <span className="candidate-circle-label">Listos</span>
                          </div>
                        </td>
                        <td>{task.requester_name ?? "—"}</td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="tracking-table-expanded-row">
                          <td colSpan={7}>
                            <div className="expanded-case-detail-grid">
                              <div className="expanded-detail-section">
                                <h4>Solicitud original</h4>
                                <div className="expanded-detail-fields">
                                  <div>
                                    <small>Solicitante</small>
                                    <strong>{task.requester_name ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Correo</small>
                                    <strong>{task.requester_email ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Folio</small>
                                    <strong>{task.folio ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Centro de costo</small>
                                    <strong>{task.contract_name ?? "—"} {task.cost_center_code ? `(${task.cost_center_code})` : ""}</strong>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="expanded-detail-section">
                                <h4>Fechas y operación</h4>
                                <div className="expanded-detail-fields">
                                  <div>
                                    <small>Ingreso solicitado</small>
                                    <strong>{formatDateValue(task.requested_income_date)}</strong>
                                  </div>
                                  <div>
                                    <small>Inicio contrato</small>
                                    <strong>{formatDateValue(task.contract_start_date)}</strong>
                                  </div>
                                  <div>
                                    <small>Fin contrato</small>
                                    <strong>{formatDateValue(task.contract_end_date)}</strong>
                                  </div>
                                  <div>
                                    <small>Turno</small>
                                    <strong>{task.shift_code ?? "—"}</strong>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="expanded-detail-section">
                                <h4>Compensación y beneficios</h4>
                                <div className="expanded-detail-fields">
                                  <div>
                                    <small>Renta líquida ofrecida</small>
                                    <strong>{task.salary_liquid ? `$${task.salary_liquid.toLocaleString("es-CL")}` : "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Campamento</small>
                                    <strong>{task.camp_required ? "Sí" : "No"}</strong>
                                  </div>
                                  <div>
                                    <small>Pasajes</small>
                                    <strong>{task.flight_tickets_required ? "Sí" : "No"}</strong>
                                  </div>
                                  <div>
                                    <small>Otros beneficios</small>
                                    <strong>{task.other_benefits ?? "—"}</strong>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Acciones de Aprobación Inline */}
                            {task.type === "approval" && task.status_code === "pending" && (
                              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                                <h4 style={{ marginBottom: "0.5rem", fontSize: "0.875rem", color: "#111827" }}>Decisión de Aprobación</h4>
                                <textarea
                                  placeholder="Agrega comentarios o motivos (obligatorio si rechazas)..."
                                  value={comments}
                                  onChange={(e) => setComments(e.target.value)}
                                  disabled={isSubmitting}
                                  style={{
                                    width: "100%",
                                    padding: "0.5rem",
                                    borderRadius: "4px",
                                    border: "1px solid #d1d5db",
                                    marginBottom: "1rem",
                                    resize: "vertical",
                                    minHeight: "60px"
                                  }}
                                />
                                
                                {submitError && (
                                  <div style={{ color: "#ef4444", marginBottom: "1rem", fontSize: "0.875rem" }}>
                                    {submitError}
                                  </div>
                                )}
                                
                                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                                  <button
                                    onClick={() => handleDecision(task.id, task.approval_id, "rejected")}
                                    disabled={isSubmitting || !comments.trim()}
                                    className="nx-btn"
                                    style={{ 
                                      backgroundColor: "white", 
                                      color: "#ef4444", 
                                      border: "1px solid #fca5a5",
                                      padding: "0.5rem 1rem",
                                      borderRadius: "6px",
                                      cursor: isSubmitting || !comments.trim() ? "not-allowed" : "pointer",
                                      opacity: isSubmitting || !comments.trim() ? 0.6 : 1
                                    }}
                                  >
                                    {isSubmitting ? "Procesando..." : "Rechazar Solicitud"}
                                  </button>
                                  
                                  <button
                                    onClick={() => handleDecision(task.id, task.approval_id, "approved")}
                                    disabled={isSubmitting}
                                    className="nx-btn"
                                    style={{ 
                                      backgroundColor: "#10b981", 
                                      color: "white",
                                      border: "none",
                                      padding: "0.5rem 1rem",
                                      borderRadius: "6px",
                                      cursor: isSubmitting ? "not-allowed" : "pointer",
                                      opacity: isSubmitting ? 0.6 : 1
                                    }}
                                  >
                                    {isSubmitting ? "Procesando..." : "Aprobar Solicitud"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}
