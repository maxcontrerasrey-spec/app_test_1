import React, { useState } from "react";
import type { DashboardDataBundle, DashboardTaskItem, ResolvedWidget } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";
import { SelectField } from "../../../../shared/ui";
import {
  decideHiringApproval,
  toTravelMethodologyLabel,
  travelMethodologyOptions,
  type TravelMethodology
} from "../../../recruitment/services/hiringWorkflow";

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
  const [travelMethodology, setTravelMethodology] = useState<TravelMethodology | "">("");

  const handleRowClick = (task: DashboardTaskItem) => {
    const initialTravelMethodology =
      task.travel_methodology === "travel_allowance" || task.travel_methodology === "company_purchase"
        ? task.travel_methodology
        : "";

    if (expandedTaskId === task.id) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(task.id);
      setSubmitError(null);
      setComments("");
      setTravelMethodology(initialTravelMethodology);
    }
  };

  const handleDecision = async (taskId: string, approvalId: number, decision: "approved" | "rejected") => {
    const targetTask = tasks.find((task) => task.id === taskId) ?? null;

    if (decision === "approved" && targetTask?.flight_tickets_required && !travelMethodology) {
      setSubmitError("Debes definir la metodología de pasajes antes de aprobar.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const { error } = await decideHiringApproval({
      approvalId,
      decision,
      comment: comments.trim() || undefined,
      travelMethodology: decision === "approved" ? travelMethodology || null : null
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
          <table className="tracking-table dashboard-pending-approvals-table">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Estado</th>
                <th>Cargo</th>
                <th>Contrato / CC</th>
                <th>Cupos</th>
                <th>Solicitó</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="nx-table-empty dashboard-pending-approvals-empty">
                    Excelente, no tienes tareas pendientes.
                  </td>
                </tr>
              ) : (
                tasks.map((task: DashboardTaskItem) => {
                  const isExpanded = expandedTaskId === task.id;
                  
                  return (
                    <React.Fragment key={task.id}>
                      <tr 
                        className={`tracking-table-row-clickable ${isExpanded ? "tracking-table-row-expanded" : ""}`}
                        onClick={() => handleRowClick(task)}
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
                          <span className="dashboard-contract-inline">
                            {task.contract_name || "—"}
                            {task.cost_center_code ? ` (${task.cost_center_code})` : ""}
                          </span>
                        </td>
                        <td>{task.requested_vacancies ?? "—"}</td>
                        <td>{task.requester_name ?? "—"}</td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="tracking-table-expanded-row">
                          <td colSpan={6}>
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
                                    <small>Metodología de pasajes</small>
                                    <strong>
                                      {task.flight_tickets_required
                                        ? toTravelMethodologyLabel(task.travel_methodology)
                                        : "No aplica"}
                                    </strong>
                                  </div>
                                  <div>
                                    <small>Otros beneficios</small>
                                    <strong>{task.other_benefits ?? "—"}</strong>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Acciones de Aprobación Inline */}
                            {task.type === "approval" && task.status_code === "pending" && task.approval_id ? (
                              <div className="task-decision-panel">
                                <h4 className="task-decision-title">Decisión de Aprobación</h4>
                                {task.flight_tickets_required ? (
                                  <SelectField
                                    id={`task-travel-methodology-${task.id}`}
                                    label="Metodología de pasajes"
                                    value={travelMethodology}
                                    onChange={(event) =>
                                      setTravelMethodology(event.target.value as TravelMethodology | "")
                                    }
                                    options={[...travelMethodologyOptions]}
                                    placeholder="Selecciona una metodología"
                                    disabled={isSubmitting}
                                  />
                                ) : null}
                                <textarea
                                  placeholder="Agrega comentarios o motivos (obligatorio si rechazas)..."
                                  value={comments}
                                  onChange={(e) => setComments(e.target.value)}
                                  disabled={isSubmitting}
                                  className="task-decision-textarea"
                                />
                                
                                {submitError && (
                                  <div className="task-decision-error">
                                    {submitError}
                                  </div>
                                )}
                                
                                <div className="task-decision-actions">
                                  <button
                                    onClick={() => handleDecision(task.id, task.approval_id as number, "rejected")}
                                    disabled={isSubmitting || !comments.trim()}
                                    className="task-decision-button task-decision-button-reject"
                                  >
                                    {isSubmitting ? "Procesando..." : "Rechazar Solicitud"}
                                  </button>
                                  
                                  <button
                                    onClick={() => handleDecision(task.id, task.approval_id as number, "approved")}
                                    disabled={isSubmitting}
                                    className="task-decision-button task-decision-button-approve"
                                  >
                                    {isSubmitting ? "Procesando..." : "Aprobar Solicitud"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
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
