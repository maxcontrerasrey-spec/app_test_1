import { useMemo, useState, useCallback } from "react";
import { TextField } from "../../../shared/ui";
import {
  toRecruitmentCaseStatusLabel,
  fetchRecruitmentCaseDetail,
  type HiringControlApproval,
  type RecruitmentCaseListRow,
  type RecruitmentCaseDetail
} from "../services/hiringControl";
import {
  caseFilterOptions,
  formatDateValue,
  formatDateTimeValue
} from "./hiringControlViewUtils";

type HiringProcessesViewProps = {
  isLoading: boolean;
  pendingApprovals: HiringControlApproval[];
  activeCases: RecruitmentCaseListRow[];
  currentUserId?: string;
  isDecisionLoading: number | null;
  decisionMessage: string;
  errorMessage: string;
  onApprovalDecision: (
    approvalId: number,
    decision: "approved" | "rejected"
  ) => Promise<boolean>;
};

export function HiringProcessesView({
  isLoading,
  pendingApprovals,
  activeCases,
  currentUserId,
  isDecisionLoading,
  decisionMessage,
  errorMessage,
  onApprovalDecision
}: HiringProcessesViewProps) {
  const [caseSearchTerm, setCaseSearchTerm] = useState("");
  const [caseFilter, setCaseFilter] =
    useState<(typeof caseFilterOptions)[number]["key"]>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<number | null>(null);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [caseDetailsCache, setCaseDetailsCache] = useState<Record<string, RecruitmentCaseDetail>>({});
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const handleRowClick = useCallback(async (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
      return;
    }

    setExpandedCaseId(caseId);

    if (caseDetailsCache[caseId]) return;

    setIsLoadingDetail(true);
    const { data } = await fetchRecruitmentCaseDetail(caseId);
    if (data) {
      setCaseDetailsCache((prev) => ({ ...prev, [caseId]: data }));
    }
    setIsLoadingDetail(false);
  }, [expandedCaseId, caseDetailsCache]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = caseSearchTerm.trim().toLowerCase();

    return activeCases.filter((caseRow) => {
      const matchesFilter = !caseFilter || caseRow.status === caseFilter;
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

  const handleApproval = async (decision: "approved" | "rejected") => {
    if (!selectedApproval) {
      return;
    }

    const wasSuccessful = await onApprovalDecision(selectedApproval.id, decision);

    if (wasSuccessful) {
      setSelectedApprovalId(null);
    }
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
                  const detail = caseDetailsCache[caseRow.id] ?? null;
                  const hr = detail?.case?.hiring_request;

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
                            {toRecruitmentCaseStatusLabel(caseRow.status)}
                          </span>
                        </td>
                        <td>{caseRow.job_position_name}</td>
                        <td>{caseRow.contract_name}</td>
                        <td>
                          {caseRow.filled_vacancies}/{caseRow.requested_vacancies}
                        </td>
                        <td>
                          {caseRow.candidate_count} · listos {caseRow.ready_candidates}
                        </td>
                        <td>{caseRow.requester_name ?? "No disponible"}</td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`${caseRow.id}-detail`} className="tracking-table-expanded-row">
                          <td colSpan={7}>
                            {isLoadingDetail && !detail ? (
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

      {selectedApproval ? (
        <div
          className="approval-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedApprovalId(null)}
        >
          <div
            className="approval-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="home-section-header">
              <div>
                <h3 id="approval-modal-title">
                  Folio {selectedApproval.hiring_requests?.folio ?? "Sin folio"}
                </h3>
                <p>{selectedApproval.step_name}</p>
              </div>
              <button
                type="button"
                className="soft-primary-button approval-button-detail"
                onClick={() => setSelectedApprovalId(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="approval-detail-grid">
              <div className="approval-detail-item approval-detail-item-tiny">
                <small>Solicitó</small>
                <strong>
                  {selectedApproval.hiring_requests?.requester_name ?? "No disponible"}
                </strong>
              </div>
              <div className="approval-detail-item approval-detail-item-wide">
                <small>Correo solicitante</small>
                <strong>
                  {selectedApproval.hiring_requests?.requester_email ?? "No disponible"}
                </strong>
              </div>
              <div className="approval-detail-item approval-detail-item-compact">
                <small>Cargo solicitado</small>
                <strong>
                  {selectedApproval.hiring_requests?.job_position_name ?? "No disponible"}
                </strong>
              </div>
              <div className="approval-detail-item approval-detail-item-regular">
                <small>Contrato</small>
                <strong>
                  {selectedApproval.hiring_requests?.contract_name ?? "No disponible"}
                </strong>
              </div>
              <div className="approval-detail-item approval-detail-item-tiny">
                <small>Vacantes</small>
                <strong>{selectedApproval.hiring_requests?.vacancies ?? 0}</strong>
              </div>
              <div className="approval-detail-item approval-detail-item-tiny">
                <small>Ingreso solicitado</small>
                <strong>
                  {formatDateValue(selectedApproval.hiring_requests?.requested_entry_date)}
                </strong>
              </div>
              <div className="approval-detail-item approval-detail-item-tiny">
                <small>Inicio contrato</small>
                <strong>{formatDateValue(selectedApproval.hiring_requests?.start_date)}</strong>
              </div>
              <div className="approval-detail-item approval-detail-item-tiny">
                <small>Fin contrato</small>
                <strong>{formatDateValue(selectedApproval.hiring_requests?.end_date)}</strong>
              </div>
              <div className="approval-detail-item approval-detail-item-tiny">
                <small>Turno</small>
                <strong>{selectedApproval.hiring_requests?.shift_name ?? "No disponible"}</strong>
              </div>
              <div className="approval-detail-item approval-detail-item-tiny">
                <small>Creado</small>
                <strong>{formatDateTimeValue(selectedApproval.created_at)}</strong>
              </div>
            </div>

            <div className="approval-detail-note">
              <small>Beneficios</small>
              <strong>
                {selectedApproval.hiring_requests?.other_benefits?.trim() ||
                selectedApproval.hiring_requests?.campamento ||
                selectedApproval.hiring_requests?.pasajes
                  ? [
                      selectedApproval.hiring_requests?.campamento ? "Campamento" : null,
                      selectedApproval.hiring_requests?.pasajes ? "Pasajes" : null,
                      selectedApproval.hiring_requests?.other_benefits?.trim() || null
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Sin beneficios adicionales registrados"}
              </strong>
            </div>

            {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}
            {decisionMessage ? <p className="form-status">{decisionMessage}</p> : null}

            {selectedApproval.approver_user_id === currentUserId ? (
              <div className="approval-action-row approval-action-row-detail">
                <button
                  type="button"
                  className="soft-primary-button approval-button-approve"
                  disabled={isDecisionLoading === selectedApproval.id}
                  onClick={() => void handleApproval("approved")}
                >
                  Aprobar folio
                </button>
                <button
                  type="button"
                  className="soft-primary-button approval-button-reject"
                  disabled={isDecisionLoading === selectedApproval.id}
                  onClick={() => void handleApproval("rejected")}
                >
                  Rechazar folio
                </button>
              </div>
            ) : (
              <div className="approval-detail-note">
                <small>Decisión</small>
                <strong>Solo el aprobador asignado puede decidir este folio.</strong>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
