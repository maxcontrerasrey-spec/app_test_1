import { Fragment, useEffect, useRef, useState } from "react";
import { TextField } from "../../../shared/ui";
import {
  getRecruitmentCaseHeadcountBreakdown,
  resolveRecruitmentProcessSearchFilter,
  toRecruitmentCaseStatusLabel,
  type RecruitmentCaseListRow,
} from "../services/hiringControl";
import {
  useRecruitmentCaseDetail,
  useRecruitmentPendingApprovalsPage,
  useRecruitmentProcessesPage
} from "../hooks/useRecruitmentQueries";
import {
  caseFilterOptions,
  formatDateValue,
  formatDateTimeValue
} from "./hiringControlViewUtils";
import { ApprovalModal } from "./ApprovalModal";
import { TrackingPagination } from "./TrackingPagination";

type SortColumn = "case_code" | "status" | "job_position_name" | "contract_name" | "vacancies" | "candidate_count" | "requester_name";
const PROCESS_PAGE_SIZE = 50;
const APPROVAL_PAGE_SIZE = 50;

const SORTABLE_HEADERS: ReadonlyArray<{ column: SortColumn; label: string }> = [
  { column: "case_code", label: "Caso" },
  { column: "status", label: "Estado" },
  { column: "job_position_name", label: "Cargo" },
  { column: "contract_name", label: "Contrato" },
  { column: "vacancies", label: "Cupos" },
  { column: "candidate_count", label: "Candidatos activos" },
  { column: "requester_name", label: "Solicitó" }
];

type HiringProcessesViewProps = {
  isLoading: boolean;
  pendingApprovalCount: number;
  currentUserId?: string;
  isAdmin?: boolean;
  decisionMessage: string;
  errorMessage: string;
  onApprovalSuccess: () => void;
  onCloseRequest?: (requestId: string, comment?: string) => Promise<void>;
};

export function HiringProcessesView({
  isLoading,
  pendingApprovalCount,
  currentUserId,
  isAdmin = false,
  decisionMessage,
  errorMessage,
  onApprovalSuccess,
  onCloseRequest
}: HiringProcessesViewProps) {
  const [caseSearchTerm, setCaseSearchTerm] = useState("");
  const [caseFilter, setCaseFilter] =
    useState<(typeof caseFilterOptions)[number]["key"]>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedApprovalId, setSelectedApprovalId] = useState<number | null>(null);
  const [isApprovalQueueExpanded, setIsApprovalQueueExpanded] = useState(false);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [casePage, setCasePage] = useState(0);
  const [approvalPage, setApprovalPage] = useState(0);
  const searchFilterRequestIdRef = useRef(0);
  const processesQuery = useRecruitmentProcessesPage({
    search: debouncedSearchTerm,
    statusFilter: caseFilter,
    sortColumn,
    sortDirection,
    limit: PROCESS_PAGE_SIZE,
    offset: casePage * PROCESS_PAGE_SIZE
  });
  const approvalsQuery = useRecruitmentPendingApprovalsPage(
    {
      limit: APPROVAL_PAGE_SIZE,
      offset: approvalPage * APPROVAL_PAGE_SIZE
    },
    isApprovalQueueExpanded
  );
  const activeCases = processesQuery.data?.items ?? [];
  const pendingApprovals = approvalsQuery.data?.items ?? [];
  const processTotalCount = processesQuery.data?.totalCount ?? 0;
  const approvalTotalCount = approvalsQuery.data?.totalCount ?? pendingApprovalCount;
  const processError =
    processesQuery.error instanceof Error ? processesQuery.error.message : "";
  const approvalError =
    approvalsQuery.error instanceof Error ? approvalsQuery.error.message : "";
  const combinedErrorMessage = errorMessage || processError || approvalError;
  const isProcessLoading = isLoading || processesQuery.isLoading;
  const expandedCaseRow =
    activeCases.find((caseRow) => caseRow.id === expandedCaseId) ?? null;
  const expandedCaseDetailQuery = useRecruitmentCaseDetail(
    expandedCaseRow?.source_type === "request" ? "" : expandedCaseId ?? "",
    Boolean(expandedCaseId) && expandedCaseRow?.source_type !== "request"
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(caseSearchTerm);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [caseSearchTerm]);

  useEffect(() => {
    setCasePage(0);
  }, [debouncedSearchTerm, caseFilter, sortColumn, sortDirection]);

  useEffect(() => {
    const normalizedSearch = debouncedSearchTerm.trim();
    const requestId = ++searchFilterRequestIdRef.current;

    if (normalizedSearch.length < 2) {
      return;
    }

    let isCancelled = false;

    resolveRecruitmentProcessSearchFilter(normalizedSearch)
      .then((result) => {
        if (isCancelled || requestId !== searchFilterRequestIdRef.current || result.error) {
          return;
        }

        setCaseFilter((currentFilter) =>
          currentFilter === result.data ? currentFilter : result.data
        );
      })
      .catch(() => {
        // The main paged query still owns user-visible errors.
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setApprovalPage(0);
  }, [isApprovalQueueExpanded]);

  useEffect(() => {
    if (expandedCaseId && !activeCases.some((caseRow) => caseRow.id === expandedCaseId)) {
      setExpandedCaseId(null);
    }
  }, [activeCases, expandedCaseId]);

  const handleRowClick = (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
      return;
    }

    setExpandedCaseId(caseId);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (column: SortColumn) => (
    <span
      aria-hidden="true"
      className={`tracking-sort-icon ${sortColumn !== column ? "tracking-sort-icon-idle" : ""}`}
    >
      {sortColumn === column ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const selectedApproval =
    pendingApprovals.find((approval) => approval.id === selectedApprovalId) ?? null;

  const handleApprovalSuccess = () => {
    setSelectedApprovalId(null);
    onApprovalSuccess();
  };

  return (
    <>
      <article className="info-card approval-panel-card approval-panel-primary">
        <div
          className="home-section-header approval-queue-header"
          onClick={() => setIsApprovalQueueExpanded(!isApprovalQueueExpanded)}
        >
          <div>
            <div className="approval-queue-title-row">
              <h3>Cola de aprobación final</h3>
              <span
                className={`approval-count-badge ${
                  pendingApprovalCount === 0
                    ? "badge-green"
                    : pendingApprovalCount <= 3
                    ? "badge-yellow"
                    : "badge-red"
                }`}
              >
                {pendingApprovalCount}
              </span>
            </div>
          </div>
          <span className="approval-queue-toggle">
            {isApprovalQueueExpanded ? "▲" : "▼"}
          </span>
        </div>

        {isApprovalQueueExpanded && approvalsQuery.isLoading ? (
          <p className="approval-empty-state">Cargando aprobaciones pendientes...</p>
        ) : null}

        {isApprovalQueueExpanded && pendingApprovals.length > 0 && (
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
        )}
        {isApprovalQueueExpanded && !approvalsQuery.isLoading && pendingApprovals.length === 0 && (
          <p className="approval-empty-state">No hay aprobaciones pendientes en este momento.</p>
        )}

        {isApprovalQueueExpanded ? (
          <TrackingPagination
            page={approvalPage}
            pageSize={APPROVAL_PAGE_SIZE}
            totalCount={approvalTotalCount}
            label="Aprobaciones pendientes"
            onPageChange={setApprovalPage}
          />
        ) : null}

        {decisionMessage ? <p className="form-status">{decisionMessage}</p> : null}
      </article>

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
            placeholder="Buscar por caso, contrato, cargo, gerencia, area o centro de costo"
            onChange={(event) => setCaseSearchTerm(event.target.value)}
            className="tracking-search-field"
          />
        </div>
      </div>

      {combinedErrorMessage ? <p className="form-status form-status-error">{combinedErrorMessage}</p> : null}

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
                {SORTABLE_HEADERS.map(({ column, label }) => (
                  <th
                    key={column}
                    className="tracking-sortable-header"
                    onClick={() => handleSort(column)}
                  >
                    {label}
                    {renderSortIcon(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeCases.length > 0 ? (
                activeCases.map((caseRow) => {
                  const isExpanded = expandedCaseId === caseRow.id;
                  const detail = isExpanded ? expandedCaseDetailQuery.data ?? null : null;
                  const hr = detail?.case?.hiring_request;
                  const approvalSummary = hr?.approval_summary ?? caseRow.approval_summary;
                  const isRequestOnlyRow = caseRow.source_type === "request";
                  const summaryRequesterName = hr?.requester_name ?? caseRow.requester_name ?? "—";
                  const summaryRequesterEmail = hr?.requester_email ?? caseRow.requester_email ?? "—";
                  const summaryFolio = hr?.folio ?? caseRow.folio ?? "—";
                  const summaryCostCenter = detail
                    ? `${detail.case.cost_center_name} (${detail.case.cost_center_code})`
                    : `${caseRow.cost_center_name} (${caseRow.cost_center_code})`;
                  const summaryRequestedEntryDate = detail?.case.requested_entry_date ?? caseRow.requested_entry_date;
                  const summaryStartDate = hr?.start_date ?? caseRow.start_date;
                  const summaryEndDate = hr?.end_date ?? caseRow.end_date;
                  const summaryShiftName = hr?.shift_name ?? caseRow.shift_name;
                  const summarySalaryOffer = hr?.salary_offer ?? caseRow.salary_offer;
                  const summaryCampamento = hr?.campamento ?? caseRow.campamento;
                  const summaryPasajes = hr?.pasajes ?? caseRow.pasajes;
                  const summaryBenefits = hr?.other_benefits ?? caseRow.other_benefits;
                  const headcount = getRecruitmentCaseHeadcountBreakdown(caseRow);

                  return (
                    <Fragment key={caseRow.id}>
                      <tr
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
                              {headcount.activeCandidates}
                            </span>
                            <span className="candidate-circle-label">Activos</span>
                            <span
                              className="candidate-circle candidate-circle-filled"
                              title="Contratados efectivos del folio que ya consumieron cupo"
                            >
                              {headcount.hiredCandidates}
                            </span>
                            <span className="candidate-circle-label">Contratados</span>
                            <span
                              className="candidate-circle candidate-circle-warning"
                              title="Movilidades internas pendientes o aprobadas asociadas al folio"
                            >
                              {headcount.internalMobility}
                            </span>
                            <span className="candidate-circle-label">Movilidad Interna</span>
                          </div>
                        </td>
                        <td>{caseRow.requester_name ?? "No disponible"}</td>
                      </tr>
                      {isExpanded ? (
                        <tr className="tracking-table-expanded-row">
                          <td colSpan={7}>
                            {isRequestOnlyRow ? (
                              <div className="expanded-case-detail-grid">
                                <div className="expanded-detail-section">
                                  <h4>Solicitud original</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Solicitante</small>
                                      <strong>{summaryRequesterName}</strong>
                                    </div>
                                    <div>
                                      <small>Correo</small>
                                      <strong>{summaryRequesterEmail}</strong>
                                    </div>
                                    <div>
                                      <small>Folio</small>
                                      <strong>{summaryFolio}</strong>
                                    </div>
                                    <div>
                                      <small>Centro de costo</small>
                                      <strong>{summaryCostCenter}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section">
                                  <h4>Fechas y operación</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Ingreso solicitado</small>
                                      <strong>{formatDateValue(summaryRequestedEntryDate)}</strong>
                                    </div>
                                    <div>
                                      <small>Inicio contrato</small>
                                      <strong>{formatDateValue(summaryStartDate)}</strong>
                                    </div>
                                    <div>
                                      <small>Fin contrato</small>
                                      <strong>{formatDateValue(summaryEndDate)}</strong>
                                    </div>
                                    <div>
                                      <small>Turno</small>
                                      <strong>{summaryShiftName ?? "—"}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section">
                                  <h4>Compensación y beneficios</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Renta líquida ofrecida</small>
                                      <strong>{summarySalaryOffer ? `$${summarySalaryOffer.toLocaleString("es-CL")}` : "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Campamento</small>
                                      <strong>{summaryCampamento ? "Sí" : "No"}</strong>
                                    </div>
                                    <div>
                                      <small>Pasajes</small>
                                      <strong>{summaryPasajes ? "Sí" : "No"}</strong>
                                    </div>
                                    <div>
                                      <small>Otros beneficios</small>
                                      <strong>{summaryBenefits?.trim() || "—"}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section expanded-detail-section-full">
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
                                            : caseRow.hiring_request_status === "closed"
                                              ? "Cerrada"
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
                              </div>
                            ) : expandedCaseDetailQuery.isLoading && !detail ? (
                              <div className="expanded-case-loading">Cargando detalle del caso...</div>
                            ) : detail ? (
                              <div className="expanded-case-detail-grid">
                                <div className="expanded-detail-section">
                                  <h4>Solicitud original</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Solicitante</small>
                                      <strong>{summaryRequesterName}</strong>
                                    </div>
                                    <div>
                                      <small>Correo</small>
                                      <strong>{summaryRequesterEmail}</strong>
                                    </div>
                                    <div>
                                      <small>Folio</small>
                                      <strong>{summaryFolio}</strong>
                                    </div>
                                    <div>
                                      <small>Centro de costo</small>
                                      <strong>{summaryCostCenter}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section">
                                  <h4>Fechas y operación</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Ingreso solicitado</small>
                                      <strong>{formatDateValue(summaryRequestedEntryDate)}</strong>
                                    </div>
                                    <div>
                                      <small>Inicio contrato</small>
                                      <strong>{formatDateValue(summaryStartDate)}</strong>
                                    </div>
                                    <div>
                                      <small>Fin contrato</small>
                                      <strong>{formatDateValue(summaryEndDate)}</strong>
                                    </div>
                                    <div>
                                      <small>Turno</small>
                                      <strong>{summaryShiftName ?? "—"}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section">
                                  <h4>Compensación y beneficios</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Renta líquida ofrecida</small>
                                      <strong>{summarySalaryOffer ? `$${summarySalaryOffer.toLocaleString("es-CL")}` : "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Campamento</small>
                                      <strong>{summaryCampamento ? "Sí" : "No"}</strong>
                                    </div>
                                    <div>
                                      <small>Pasajes</small>
                                      <strong>{summaryPasajes ? "Sí" : "No"}</strong>
                                    </div>
                                    <div>
                                      <small>Otros beneficios</small>
                                      <strong>{summaryBenefits?.trim() || "—"}</strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section expanded-detail-section-full">
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
                                    <div className="expanded-detail-actions tracking-expanded-actions-end">
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
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td className="tracking-empty-state" colSpan={7}>
                    {isProcessLoading ? "Cargando casos..." : "No hay folios para el filtro actual."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TrackingPagination
          page={casePage}
          pageSize={PROCESS_PAGE_SIZE}
          totalCount={processTotalCount}
          label="Procesos visibles"
          onPageChange={setCasePage}
        />
      </div>

      <ApprovalModal
        isOpen={!!selectedApproval}
        approvalData={selectedApproval}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onClose={() => setSelectedApprovalId(null)}
        onSuccess={handleApprovalSuccess}
      />
    </>
  );
}
