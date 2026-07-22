import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SoftMetricCard, TextField } from "../../../../shared/ui";
import { getDaysSince } from "../../../../shared/lib/date";
import {
  useRecruitmentProcessesPage,
  getRecruitmentCaseDetailQueryOptions
} from "../../../recruitment/hooks/useRecruitmentQueries";
import {
  getRecruitmentCaseHeadcountBreakdown,
  toRecruitmentCaseStatusLabel,
  type RecruitmentCaseDetail,
  type RecruitmentCaseListRow,
  type RecruitmentProcessesPageSummary
} from "../../../recruitment/services/hiringControl";
import type { DashboardDataBundle } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";
import { formatDashboardDate, formatDashboardDateTime } from "../../lib/formatters";

type ActiveFoliosWidgetProps = {
  title: string;
  dashboardData?: DashboardDataBundle;
};

export function ActiveFoliosWidget({ title, dashboardData }: ActiveFoliosWidgetProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [caseDetailsCache, setCaseDetailsCache] = useState<Record<string, RecruitmentCaseDetail | null>>({});
  const [caseDetailErrors, setCaseDetailErrors] = useState<Record<string, string | null>>({});
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<
    { key: ActiveFoliosSortKey; direction: "asc" | "desc" } | null
  >(null);

  const recruitmentSummary = dashboardData?.operationalSummaryData?.recruitment;
  const pageSize = 7;
  const sortableColumns = [
    { key: "case_code", label: "Caso" },
    { key: "status", label: "Estado" },
    { key: "job_position_name", label: "Cargo" },
    { key: "contract_name", label: "Contrato / CC" },
    { key: "vacancies", label: "Cupos" },
    { key: "candidate_count", label: "Candidatos activos" },
    { key: "opened_at", label: "Días Abierto" }
  ] as const;
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, sortConfig]);

  const activeFoliosQuery = useRecruitmentProcessesPage({
    search: debouncedSearch || undefined,
    statusFilter: null,
    sortColumn: sortConfig?.key ?? null,
    sortDirection: sortConfig?.direction ?? "desc",
    limit: 250,
    offset: 0
  });

  const foliosForPage = useMemo<RecruitmentCaseListRow[]>(
    () => activeFoliosQuery.data?.items ?? [],
    [activeFoliosQuery.data]
  );
  const folios = useMemo<RecruitmentCaseListRow[]>(
    () => foliosForPage.slice(page * pageSize, page * pageSize + pageSize),
    [foliosForPage, page]
  );
  const totalCount = foliosForPage.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const folioSummary = useMemo<RecruitmentProcessesPageSummary>(
    () => {
      if (activeFoliosQuery.data?.summary) {
        return activeFoliosQuery.data.summary;
      }

      if (!debouncedSearch && recruitmentSummary) {
        return {
          activeCases: recruitmentSummary.openProcesses ?? 0,
          requestedVacancies: recruitmentSummary.requestedVacancies ?? 0,
          inProgressCandidates: recruitmentSummary.inProgressCandidates ?? 0,
          readyToHireCases: recruitmentSummary.readyToHireCases ?? 0,
          filledCases: recruitmentSummary.filledCases ?? 0,
          hiredCandidates: recruitmentSummary.hiredCandidates ?? 0
        };
      }

      return {
        activeCases: 0,
        requestedVacancies: 0,
        inProgressCandidates: 0,
        readyToHireCases: 0,
        filledCases: 0,
        hiredCandidates: 0
      };
    },
    [activeFoliosQuery.data?.summary, debouncedSearch, recruitmentSummary]
  );
  const folioKpis = useMemo(
    () => [
      {
        label: "Folios activos en búsqueda",
        tone: "warning" as const,
        value: String(folioSummary.activeCases)
      },
      {
        label: "Requerimiento total",
        tone: "neutral" as const,
        value: String(folioSummary.requestedVacancies)
      },
      {
        label: "Candidatos en curso",
        tone: "info" as const,
        value: String(folioSummary.inProgressCandidates)
      },
      {
        label: "Con candidato listo",
        tone: "info" as const,
        value: String(folioSummary.readyToHireCases)
      },
      {
        label: "Casos cubiertos",
        tone: "success" as const,
        value: String(folioSummary.filledCases)
      }
    ],
    [folioSummary]
  );

  const handleSort = (key: ActiveFoliosSortKey) => {
    if (sortConfig?.key === key) {
      if (sortConfig.direction === "asc") {
        setSortConfig({ key, direction: "desc" });
      } else {
        setSortConfig(null);
      }
      return;
    }

    setSortConfig({ key, direction: "asc" });
  };

  const getSortIcon = (key: ActiveFoliosSortKey) => {
    if (sortConfig?.key !== key) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return sortConfig.direction === "asc" ? <span> ↑</span> : <span> ↓</span>;
  };

  const fetchCaseDetail = async (caseId: string) => {
    setIsLoadingDetail(true);
    try {
      const data = await queryClient.fetchQuery(getRecruitmentCaseDetailQueryOptions(caseId));
      setCaseDetailsCache((current) => ({ ...current, [caseId]: data }));
      setCaseDetailErrors((current) => ({ ...current, [caseId]: null }));
    } catch (error) {
      setCaseDetailErrors((current) => ({
        ...current,
        [caseId]: error instanceof Error ? error.message : "No fue posible cargar el detalle."
      }));
    }
    setIsLoadingDetail(false);
  };

  useEffect(() => {
    if (!expandedCaseId) {
      return;
    }

    void fetchCaseDetail(expandedCaseId);
  }, [activeFoliosQuery.dataUpdatedAt, expandedCaseId]);

  const handleRowClick = async (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
      return;
    }

    setExpandedCaseId(caseId);

    if (caseDetailsCache[caseId]) {
      return;
    }

    await fetchCaseDetail(caseId);
  };

  return (
    <DashboardWidgetFrame
      title={title}
      className="widget-tasks widget-fill-height"
    >
      <div className="dashboard-folios-toolbar">
        <div className="tracking-kpi-row dashboard-folios-kpis">
          {folioKpis.map((kpi) => (
            <SoftMetricCard
              key={kpi.label}
              className="dashboard-folios-kpi-card"
              label={kpi.label}
              tone={kpi.tone}
              value={kpi.value}
            />
          ))}
        </div>

        <div className="dashboard-folios-search-row">
          <TextField
            id="dashboard-folios-search"
            label="Buscar folio en curso"
            hideLabel
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Caso, contrato, cargo, gerencia o centro de costo"
            className="dashboard-folios-search"
          />
        </div>
      </div>

      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table">
            <thead>
              <tr>
                {sortableColumns.map((column) => (
                  <th
                    key={column.key}
                    className="dashboard-sortable-heading"
                    onClick={() => handleSort(column.key)}
                  >
                    {column.label}
                    {getSortIcon(column.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {folios.length > 0 ? (
                folios.map((folio) => {
                  const isExpanded = expandedCaseId === folio.id;
                  const detail = caseDetailsCache[folio.id] ?? null;
                  const detailError = caseDetailErrors[folio.id] ?? null;
                  const hr = detail?.case?.hiring_request;
                  const approvalSummary = hr?.approval_summary;
                  const headcount = getRecruitmentCaseHeadcountBreakdown(folio);

                  return (
                    <React.Fragment key={folio.id}>
                      <tr
                        className={`tracking-table-row-clickable ${
                          isExpanded ? "tracking-table-row-expanded" : ""
                        }`}
                        onClick={() => void handleRowClick(folio.id)}
                      >
                        <td>
                          <span className="case-code-toggle">
                            <span
                              className={`expand-chevron ${
                                isExpanded ? "expand-chevron-open" : ""
                              }`}
                            >
                              ▸
                            </span>
                            {folio.case_code}
                          </span>
                        </td>
                        <td>
                          <span className="tracking-status-pill">
                            {toRecruitmentCaseStatusLabel(folio.status)}
                          </span>
                        </td>
                        <td>{folio.job_position_name}</td>
                        <td>
                          {folio.contract_name}{" "}
                          {folio.cost_center_code ? `(${folio.cost_center_code})` : ""}
                        </td>
                        <td>
                          <span title="Cupos cubiertos / requeridos en el folio">
                            {folio.filled_vacancies}/{folio.requested_vacancies}
                          </span>
                        </td>
                        <td>
                          <div className="candidate-count-indicator">
                            <span className="candidate-circle candidate-circle-neutral">
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
                        <td>{getDaysSince(folio.opened_at) ?? "—"}</td>
                      </tr>
                      {isExpanded ? (
                        <tr className="tracking-table-expanded-row">
                          <td colSpan={7}>
                            {isLoadingDetail && !detail ? (
                              <div className="expanded-case-loading">
                                Cargando detalle del caso...
                              </div>
                            ) : detail ? (
                              <div className="expanded-case-detail-grid">
                                <div className="expanded-detail-section">
                                  <h4>Solicitud original</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Solicitante</small>
                                      <strong>
                                        {hr?.requester_name ?? folio.requester_name ?? "—"}
                                      </strong>
                                    </div>
                                    <div>
                                      <small>Correo</small>
                                      <strong>
                                        {hr?.requester_email ?? folio.requester_email ?? "—"}
                                      </strong>
                                    </div>
                                    <div>
                                      <small>Folio</small>
                                      <strong>{hr?.folio ?? "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Centro de costo</small>
                                      <strong>
                                        {detail.case.cost_center_name} ({detail.case.cost_center_code})
                                      </strong>
                                    </div>
                                  </div>
                                </div>
                                <div className="expanded-detail-section">
                                  <h4>Fechas y operación</h4>
                                  <div className="expanded-detail-fields">
                                    <div>
                                      <small>Ingreso solicitado</small>
                                      <strong>
                                        {formatDashboardDate(detail.case.requested_entry_date)}
                                      </strong>
                                    </div>
                                    <div>
                                      <small>Inicio contrato</small>
                                      <strong>{formatDashboardDate(hr?.start_date)}</strong>
                                    </div>
                                    <div>
                                      <small>Fin contrato</small>
                                      <strong>{formatDashboardDate(hr?.end_date)}</strong>
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
                                      <strong>
                                        {hr?.salary_offer
                                          ? `$${hr.salary_offer.toLocaleString("es-CL")}`
                                          : "—"}
                                      </strong>
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
                                      <strong>{hr?.other_benefits ?? "—"}</strong>
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
                                      <strong>
                                        {formatDashboardDateTime(approvalSummary?.decided_at)}
                                      </strong>
                                    </div>
                                    <div className="expanded-detail-field-full">
                                      <small>Comentario</small>
                                      <strong>
                                        {approvalSummary?.decision_comment?.trim() ||
                                          "Sin comentario registrado"}
                                      </strong>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="expanded-case-loading">
                                {detailError ?? "No fue posible cargar el detalle del caso."}
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="tracking-empty-state">
                    {activeFoliosQuery.isLoading
                      ? "Cargando folios en curso..."
                      : activeFoliosQuery.error instanceof Error
                        ? activeFoliosQuery.error.message
                        : "No hay folios en curso."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {activeFoliosQuery.isFetching && !activeFoliosQuery.isLoading ? (
          <div className="tracking-helper-copy">Actualizando folios visibles...</div>
        ) : null}

        {totalCount > pageSize ? (
          <div className="tracking-pagination">
            <button
              type="button"
              className="soft-primary-button tracking-pagination-button"
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
              disabled={page === 0}
            >
              Anterior
            </button>
            <span>
              Página {page + 1} de {totalPages}
            </span>
            <button
              type="button"
              className="soft-primary-button tracking-pagination-button"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}
              disabled={page >= totalPages - 1}
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </div>
    </DashboardWidgetFrame>
  );
}

type ActiveFoliosSortKey =
  | "case_code"
  | "status"
  | "job_position_name"
  | "contract_name"
  | "vacancies"
  | "candidate_count"
  | "opened_at";
