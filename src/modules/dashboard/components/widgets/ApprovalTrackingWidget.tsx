import React, { useMemo, useState } from "react";
import { TextField } from "../../../../shared/ui";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";
import type { DashboardApprovalTrackingItem, DashboardDataBundle } from "../../types";
import { toTravelMethodologyLabel } from "../../../recruitment/services/hiringWorkflow";
import { toWhoCauseTypeLabel } from "../../../recruitment/services/hiringControl";
import { formatDashboardDate } from "../../lib/formatters";

type ApprovalTrackingWidgetProps = {
  title: string;
  dashboardData?: DashboardDataBundle;
};

export function ApprovalTrackingWidget({ title, dashboardData }: ApprovalTrackingWidgetProps) {
  const approvals = dashboardData?.approvalTrackingData ?? [];
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredApprovals = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return approvals;

    return approvals.filter((approval) =>
      [
        approval.folio,
        approval.job_position_name,
        approval.contract_name,
        approval.cost_center_code,
        approval.requester_name,
        approval.current_step_name,
        approval.current_approver_name
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch))
    );
  }, [approvals, searchTerm]);

  return (
    <DashboardWidgetFrame
      title={title}
      subtitle="Solicitudes ya levantadas que aún recorren su flujo de aprobación."
      className="widget-tasks widget-fill-height"
    >
      <div className="dashboard-folios-toolbar">
        <TextField
          id="dashboard-approval-tracking-search"
          label="Buscar aprobación en curso"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Folio, cargo, contrato o aprobador"
          className="dashboard-folios-search"
        />
      </div>

      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Estado</th>
                <th>Cargo</th>
                <th>Contrato / CC</th>
                <th>Etapa actual</th>
                <th>Aprobador actual</th>
              </tr>
            </thead>
            <tbody>
              {filteredApprovals.length > 0 ? (
                filteredApprovals.map((approval: DashboardApprovalTrackingItem) => {
                  const isExpanded = expandedId === approval.id;

                  return (
                    <React.Fragment key={approval.id}>
                      <tr
                        className={`tracking-table-row-clickable ${isExpanded ? "tracking-table-row-expanded" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                      >
                        <td>
                          <span className="case-code-toggle">
                            <span className={`expand-chevron ${isExpanded ? "expand-chevron-open" : ""}`}>▸</span>
                            {approval.folio}
                          </span>
                        </td>
                        <td>
                          <span className="tracking-status-pill">
                            {approval.status_label}
                          </span>
                        </td>
                        <td>{approval.job_position_name ?? "—"}</td>
                        <td>
                          <span className="dashboard-contract-inline">
                            {approval.contract_name || "—"}
                            {approval.cost_center_code ? ` (${approval.cost_center_code})` : ""}
                          </span>
                        </td>
                        <td>{approval.current_step_name ?? "—"}</td>
                        <td>{approval.current_approver_name ?? "—"}</td>
                      </tr>

                      {isExpanded ? (
                        <tr className="tracking-table-expanded-row">
                          <td colSpan={6}>
                            {approval.type === "approval" ? (
                            <div className="expanded-case-detail-grid">
                              <div className="expanded-detail-section">
                                <h4>Solicitud original</h4>
                                <div className="expanded-detail-fields">
                                  <div>
                                    <small>Solicitante</small>
                                    <strong>{approval.requester_name ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Correo</small>
                                    <strong>{approval.requester_email ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Folio</small>
                                    <strong>{approval.folio ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Candidato</small>
                                    <strong>{approval.candidate_name ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Centro de costo</small>
                                    <strong>{approval.contract_name ?? "—"} {approval.cost_center_code ? `(${approval.cost_center_code})` : ""}</strong>
                                  </div>
                                </div>
                              </div>

                              <div className="expanded-detail-section">
                                <h4>Fechas y operación</h4>
                                <div className="expanded-detail-fields">
                                  <div>
                                    <small>Ingreso solicitado</small>
                                    <strong>{formatDashboardDate(approval.requested_income_date)}</strong>
                                  </div>
                                  <div>
                                    <small>Inicio contrato</small>
                                    <strong>{formatDashboardDate(approval.contract_start_date)}</strong>
                                  </div>
                                  <div>
                                    <small>Fin contrato</small>
                                    <strong>{formatDashboardDate(approval.contract_end_date)}</strong>
                                  </div>
                                  <div>
                                    <small>Turno</small>
                                    <strong>{approval.shift_code ?? "—"}</strong>
                                  </div>
                                </div>
                              </div>

                              <div className="expanded-detail-section">
                                <h4>Compensación y beneficios</h4>
                                <div className="expanded-detail-fields">
                                  <div>
                                    <small>Renta líquida ofrecida</small>
                                    <strong>{approval.salary_liquid ? `$${approval.salary_liquid.toLocaleString("es-CL")}` : "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Campamento</small>
                                    <strong>{approval.camp_required ? "Sí" : "No"}</strong>
                                  </div>
                                  <div>
                                    <small>Pasajes</small>
                                    <strong>{approval.flight_tickets_required ? "Sí" : "No"}</strong>
                                  </div>
                                  <div>
                                    <small>Metodología de pasajes</small>
                                    <strong>
                                      {approval.flight_tickets_required
                                        ? toTravelMethodologyLabel(approval.travel_methodology)
                                        : "No aplica"}
                                    </strong>
                                  </div>
                                  <div>
                                    <small>Otros beneficios</small>
                                    <strong>{approval.other_benefits ?? "—"}</strong>
                                  </div>
                                </div>
                              </div>

                              <div className="expanded-detail-section">
                                <h4>Estado de aprobación</h4>
                                <div className="expanded-detail-fields">
                                  <div>
                                    <small>Estado actual</small>
                                    <strong>{approval.status_label}</strong>
                                  </div>
                                  <div>
                                    <small>Etapa actual</small>
                                    <strong>{approval.current_step_name ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Aprobador actual</small>
                                    <strong>{approval.current_approver_name ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Correo aprobador</small>
                                    <strong>{approval.current_approver_email ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Solicitado por</small>
                                    <strong>{approval.requested_by_name ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Comentario</small>
                                    <strong>{approval.approval_comment ?? "—"}</strong>
                                  </div>
                                </div>
                              </div>
                            </div>
                            ) : null}

                            {approval.type === "who_approval" ? (
                              <div className="expanded-detail-section">
                                <h4>Resumen de causas Who</h4>
                                <div className="expanded-detail-fields">
                                  <div>
                                    <small>Candidato</small>
                                    <strong>{approval.candidate_name ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Solicitado por</small>
                                    <strong>{approval.requested_by_name ?? "—"}</strong>
                                  </div>
                                  <div>
                                    <small>Fecha solicitud</small>
                                    <strong>{formatDashboardDate(approval.created_at)}</strong>
                                  </div>
                                  <div>
                                    <small>Etapa actual</small>
                                    <strong>{approval.current_step_name ?? "—"}</strong>
                                  </div>
                                </div>

                                {approval.who_causes?.length ? (
                                  <div className="who-causes-summary-list">
                                    {approval.who_causes.map((cause, index) => (
                                      <div key={`${approval.id}-cause-${index}`} className="who-causes-summary-item">
                                        <span className="who-causes-summary-title">Causa {index + 1}</span>
                                        <span>{toWhoCauseTypeLabel(cause.type)}</span>
                                        <span>{cause.year}</span>
                                        <p>{cause.comment}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="who-causes-summary-empty">
                                    No se registraron causas estructuradas en esta solicitud.
                                  </p>
                                )}

                                {approval.approval_comment ? (
                                  <div className="who-causes-summary-note">
                                    <small>Observación general</small>
                                    <strong>{approval.approval_comment}</strong>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="tracking-empty-state">
                    No hay aprobaciones en curso para el filtro actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}
