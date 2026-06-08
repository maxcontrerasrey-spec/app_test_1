import { useMemo, useState } from "react";
import { TextField } from "../../../shared/ui";
import {
  toRecruitmentCaseStatusLabel,
  type HiringControlApproval,
  type RecruitmentCaseListRow,
} from "../services/hiringControl";
import { useRecruitmentCaseDetail } from "../hooks/useRecruitmentQueries";
import {
  caseFilterOptions,
  formatDateValue,
  formatDateTimeValue
} from "./hiringControlViewUtils";
import { ApprovalModal } from "./ApprovalModal";

type HiringProcessesViewProps = {
  isLoading: boolean;
  pendingApprovals: HiringControlApproval[];
  activeCases: RecruitmentCaseListRow[];
  currentUserId?: string;
  isDecisionLoading: number | null;
  decisionMessage: string;
  errorMessage: string;
  onApprovalSuccess: () => void;
  onCloseRequest?: (requestId: string, comment?: string) => Promise<void>;
};

export function HiringProcessesView({
  isLoading,
  pendingApprovals,
  activeCases,
  currentUserId,
  isDecisionLoading,
  decisionMessage,
  errorMessage,
  onApprovalSuccess,
  onCloseRequest
}: HiringProcessesViewProps) {
  const [caseSearchTerm, setCaseSearchTerm] = useState("");
  const [caseFilter, setCaseFilter] =
    useState<(typeof caseFilterOptions)[number]["key"]>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<number | null>(null);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const expandedCaseDetailQuery = useRecruitmentCaseDetail(expandedCaseId ?? "", Boolean(expandedCaseId));

  const handleRowClick = (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
      return;
    }

    setExpandedCaseId(caseId);
  };

  const filteredCases = useMemo(() => {
    const normalizedSearch = caseSearchTerm.trim().toLowerCase();

    return activeCases.filter((caseRow) => {
      let matchesFilter = false;
      if (caseFilter === null) {
        matchesFilter = caseRow.status !== "cancelled";
      } else {
        matchesFilter = caseRow.status === caseFilter;
      }

      const matchesSearch =
        !normalizedSearch ||
        caseRow.case_code.toLowerCase().includes(normalizedSearch) ||
        caseRow.contract_name.toLowerCase().includes(normalizedSearch) ||
        caseRow.job_position_name.toLowerCase().includes(normalizedSearch) ||
        caseRow.cost_center_name.toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [activeCases, caseFilter, caseSearchTerm]);

  const selectedApproval =
    pendingApprovals.find((approval) => approval.id === selectedApprovalId) ?? null;

  const handleApprovalSuccess = () => {
    setSelectedApprovalId(null);
    onApprovalSuccess();
  };

  return (
    <>
      {pendingApprovals.length > 0 ? (
        <article className="info-card approval-panel-card approval-panel-primary">
          <div className="home-section-header">
            <div>
              <h3>Cola de aprobación final</h3>
              <p>
                {isLoading
                  ? "Cargando aprobaciones..."
                  : `${pendingApprovals.length} folios pendientes de Control de Contratos`}
              </p>
            </div>
          </div>

          <ul className="approval-queue">
            {pendingApprovals.map((approval) => (
              <li key={approval.id}>
                <button
                  type="button"
                  className="approval-queue-item approval-queue-item-button"
                  onClick={() => setSelectedApprovalId(approval.id)}
                >
                  <div className="approval-queue-copy">
                    <strong>{approval.hiring_requests?.folio ?? "Sin folio"}</strong>
                    <span>{approval.step_name}</span>
                    <span>
                      {approval.hiring_requests?.job_position_name ?? "Cargo no disponible"}
                    </span>
                    <span>
                      {approval.hiring_requests?.contract_name ?? "Contrato no disponible"}
                    </span>
                  </div>
                  <span className="approval-queue-link">Ver detalle y decidir</span>
                </button>
              </li>
            ))}
          </ul>

          {decisionMessage ? <p className="form-status">{decisionMessage}</p> : null}
        </article>
      ) : null}

      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Resumen de procesos de contratación</h3>
          <span className="tracking-filter-caption">
            Tabla de seguimiento de folios aprobados y activos en búsqueda, con volumen
            operativo por folio.
          </span>
        </div>
        <div className="tracking-filters">
          <TextField
            id="hiring-processes-search"
            label="Buscar casos"
            value={caseSearchTerm}
            placeholder="Buscar por caso, contrato, cargo o centro de costo"
            onChange={(event) => setCaseSearchTerm(event.target.value)}
            className="tracking-search-field"
          />
        </div>
      </div>

      <div className="approval-chip-row">
        {caseFilterOptions.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`approval-chip ${caseFilter === option.key ? "tracking-kpi-card-active" : ""}`}
            onClick={() => setCaseFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Estado</th>
                <th>Cargo</th>
                <th>Contrato</th>
                <th>Cupos</th>
                <th>Candidatos activos</th>
                <th>Solicitó</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length > 0 ? (
                filteredCases.map((caseRow) => {
                  const isExpanded = expandedCaseId === caseRow.id;
                  const detail = isExpanded ? expandedCaseDetailQuery.data ?? null : null;
                  const hr = detail?.case?.hiring_request;
                  const approvalSummary = hr?.approval_summary;

                  return (
                    <>
                      <tr
                        key={caseRow.id}
                        className={`tracking-table-row-clickable ${isExpanded ? "tracking-table-row-expanded" : ""}`}
                        onClick={() => void handleRowClick(caseRow.id)}
                      >
                        <td>
                          <span className="case-code-toggle">
                            <span className={`expand-chevron ${isExpanded ? "expand-chevron-open" : ""}`}>▸</span>
                            {caseRow.case_code}
                          </span>
                        </td>
                        <td>
                          <span className="tracking-status-pill">
                            {caseRow.status === "cancelled" 
                              ? (caseRow.hiring_request_status === "rejected" ? "Rechazado" : "Cerrado") 
                              : toRecruitmentCaseStatusLabel(caseRow.status)}
                          </span>
                        </td>
                        <td>{caseRow.job_position_name}</td>
                        <td>{caseRow.contract_name}</td>
                        <td>
                          {caseRow.filled_vacancies}/{caseRow.requested_vacancies}
                        </td>
                        <td>
                          <div className="candidate-count-indicator">
                            <span className="candidate-circle candidate-circle-neutral" title="Candidatos activos en el proceso">
                              {caseRow.candidate_count}
                            </span>
                            <span className="candidate-circle-label">Activos</span>
                            <span className="candidate-circle candidate-circle-success" title="Candidatos listos para contratar">
                              {caseRow.ready_candidates}
                            </span>
                            <span className="candidate-circle-label">Listos</span>
                          </div>
                        </td>
                        <td>{caseRow.requester_name ?? "No disponible"}</td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`${caseRow.id}-detail`} className="tracking-table-expanded-row">
                          <td colSpan={7}>
                            {expandedCaseDetailQuery.isLoading && !detail ? (
                              <div className="expanded-case-loading">Cargando detalle del caso...</div>
                            ) : detail ? (
                              <div className="expanded-case-detail-grid">
                                <div className="expanded-detail-section">
                                  <h4>Solicitud original</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Solicitante</small>
                                      <strong>{hr?.requester_name ?? caseRow.requester_name ?? "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Correo</small>
                                      <strong>{hr?.requester_email ?? caseRow.requester_email ?? "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Folio</small>
                                      <strong>{hr?.folio ?? "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Centro de costo</small>
                                      <strong>{detail.case.cost_center_name} ({detail.case.cost_center_code})</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section">
                                  <h4>Fechas y operación</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Ingreso solicitado</small>
                                      <strong>{formatDateValue(detail.case.requested_entry_date)}</strong>
                                    </div>
                                    <div>
                                      <small>Inicio contrato</small>
                                      <strong>{formatDateValue(hr?.start_date)}</strong>
                                    </div>
                                    <div>
                                      <small>Fin contrato</small>
                                      <strong>{formatDateValue(hr?.end_date)}</strong>
                                    </div>
                                    <div>
                                      <small>Turno</small>
                                      <strong>{hr?.shift_name ?? "—"}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section">
                                  <h4>Compensación y beneficios</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Renta líquida ofrecida</small>
                                      <strong>{hr?.salary_offer ? `$${hr.salary_offer.toLocaleString("es-CL")}` : "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Campamento</small>
                                      <strong>{hr?.campamento ? "Sí" : "No"}</strong>
                                    </div>
                                    <div>
                                      <small>Pasajes</small>
                                      <strong>{hr?.pasajes ? "Sí" : "No"}</strong>
                                    </div>
                                    <div>
                                      <small>Otros beneficios</small>
                                      <strong>{hr?.other_benefits?.trim() || "—"}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section">
                                  <h4>Decisión de aprobación</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Etapa</small>
                                      <strong>{approvalSummary?.step_name ?? "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Resolución</small>
                                      <strong>
                                        {approvalSummary?.status === "approved"
                                          ? "Aprobada"
                                          : approvalSummary?.status === "rejected"
                                            ? "Rechazada"
                                            : "—"}
                                      </strong>
                                    </div>
                                    <div>
                                      <small>Resuelto por</small>
                                      <strong>{approvalSummary?.decided_by_name ?? "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Fecha decisión</small>
                                      <strong>{formatDateTimeValue(approvalSummary?.decided_at)}</strong>
                                    </div>
                                    <div className="expanded-detail-field-full">
                                      <small>Comentario</small>
                                      <strong>{approvalSummary?.decision_comment?.trim() || "Sin comentario registrado"}</strong>
                                      </div>
                                    </div>
                                  </div>
                                  {!["filled", "closed_unfilled", "cancelled"].includes(caseRow.status) &&
                                  caseRow.can_close_request &&
                                  onCloseRequest &&
                                  hr && (
                                    <div className="expanded-detail-actions" style={{ padding: "1.25rem 1.5rem", gridColumn: "3", display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
                                      <button
                                        type="button"
                                        className="soft-primary-button soft-primary-button-danger"
                                        onClick={() => {
                                          if (window.confirm("¿Estás seguro de que deseas cerrar este folio? Esta acción cancelará las aprobaciones pendientes y el caso activo. Es irreversible.")) {
                                            const comment = window.prompt("Motivo de cierre (opcional):");
                                            if (comment !== null) {
                                              void onCloseRequest(hr?.id ?? "", comment);
                                            }
                                          }
                                        }}
                                      >
                                        Cerrar Folio
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                              <div className="expanded-case-loading">No se pudo cargar el detalle.</div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })
              ) : (
                <tr>
                  <td className="tracking-empty-state" colSpan={7}>
                    {isLoading ? "Cargando casos..." : "No hay folios activos para el filtro actual."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ApprovalModal
        isOpen={!!selectedApproval}
        approvalData={selectedApproval}
        currentUserId={currentUserId}
        onClose={() => setSelectedApprovalId(null)}
        onSuccess={handleApprovalSuccess}
      />
    </>
  );
}
