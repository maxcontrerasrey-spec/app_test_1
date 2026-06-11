import React, { useMemo, useState, useEffect } from "react";
import { TextField } from "../../../../shared/ui";
import { getDaysSince } from "../../../../shared/lib/date";
import {
  fetchRecruitmentCaseDetail,
  toRecruitmentCaseStatusLabel,
  type RecruitmentCaseDetail
} from "../../../recruitment/services/hiringControl";
import type { DashboardActiveFolioItem, DashboardDataBundle } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";
import { useRecruitmentControlDashboard } from "../../../recruitment/hooks/useRecruitmentQueries";

type ActiveFoliosWidgetProps = {
  title: string;
  dashboardData?: DashboardDataBundle;
};

function formatDateValue(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateTimeValue(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ActiveFoliosWidget({ title, dashboardData }: ActiveFoliosWidgetProps) {
  const folios = dashboardData?.activeFoliosData ?? [];
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [caseDetailsCache, setCaseDetailsCache] = useState<Record<string, RecruitmentCaseDetail | null>>({});

  const dashboardQuery = useRecruitmentControlDashboard();
  const summary = dashboardQuery.data?.summary ?? {
    active_cases: 0,
    ready_to_hire_cases: 0,
    filled_cases: 0
  };

  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const pageSize = 7;

  const filteredAndSortedFolios = useMemo(() => {
    let result = folios;
    
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (normalizedSearch) {
      result = result.filter((folio) =>
        [
          folio.case_code,
          folio.job_position_name,
          folio.contract_name,
          folio.cost_center_code,
          folio.cost_center_name,
          folio.requester_name
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedSearch))
      );
    }

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key as keyof DashboardActiveFolioItem] ?? "";
        const bVal = b[sortConfig.key as keyof DashboardActiveFolioItem] ?? "";
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [folios, searchTerm, sortConfig]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedFolios.length / pageSize);
  const paginatedFolios = filteredAndSortedFolios.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return sortConfig.direction === 'asc' ? <span> ↑</span> : <span> ↓</span>;
  };

  const handleRowClick = async (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
      return;
    }

    setExpandedCaseId(caseId);

    if (caseDetailsCache[caseId]) {
      return;
    }

    setIsLoadingDetail(true);
    const { data } = await fetchRecruitmentCaseDetail(caseId);
    setCaseDetailsCache((current) => ({
      ...current,
      [caseId]: data
    }));
    setIsLoadingDetail(false);
  };

  return (
    <DashboardWidgetFrame title={title} className="widget-tasks widget-fill-height">
      <div className="dashboard-folios-toolbar dashboard-folios-toolbar-split">
        <div className="dashboard-folios-toolbar-search">
          <TextField
            id="dashboard-folios-search"
            label="Buscar folio en curso"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Caso, contrato o centro de costo"
            className="dashboard-folios-search"
          />
        </div>

        <div className="tracking-kpi-row dashboard-folios-kpis">
          <article className="tracking-kpi-card tracking-kpi-card-pendiente dashboard-folios-kpi-card">
            <span className="micro-label">Folios activos en búsqueda</span>
            <strong>{summary.active_cases}</strong>
          </article>
          <article className="tracking-kpi-card tracking-kpi-card-en-proceso dashboard-folios-kpi-card">
            <span className="micro-label">Con candidato listo</span>
            <strong>{summary.ready_to_hire_cases}</strong>
          </article>
          <article className="tracking-kpi-card tracking-kpi-card-generado dashboard-folios-kpi-card">
            <span className="micro-label">Casos cubiertos</span>
            <strong>{summary.filled_cases}</strong>
          </article>
        </div>
      </div>

      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table">
            <thead>
              <tr>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("case_code")}>Caso{getSortIcon("case_code")}</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("status")}>Estado{getSortIcon("status")}</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("job_position_name")}>Cargo{getSortIcon("job_position_name")}</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("contract_name")}>Contrato / CC{getSortIcon("contract_name")}</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("requested_vacancies")}>Cupos{getSortIcon("requested_vacancies")}</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("candidate_count")}>Candidatos activos{getSortIcon("candidate_count")}</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("opened_at")}>Días Abierto{getSortIcon("opened_at")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFolios.length > 0 ? (
                paginatedFolios.map((folio: DashboardActiveFolioItem) => {
                  const isExpanded = expandedCaseId === folio.id;
                  const detail = caseDetailsCache[folio.id] ?? null;
                  const hr = detail?.case?.hiring_request;
                  const approvalSummary = hr?.approval_summary;

                  return (
                    <React.Fragment key={folio.id}>
                      <tr
                        className={`tracking-table-row-clickable ${isExpanded ? "tracking-table-row-expanded" : ""}`}
                        onClick={() => void handleRowClick(folio.id)}
                      >
                        <td>
                          <span className="case-code-toggle">
                            <span className={`expand-chevron ${isExpanded ? "expand-chevron-open" : ""}`}>▸</span>
                            {folio.case_code}
                          </span>
                        </td>
                        <td>
                          <span className="tracking-status-pill">
                            {toRecruitmentCaseStatusLabel(folio.status)}
                          </span>
                        </td>
                        <td>{folio.job_position_name}</td>
                        <td>{folio.contract_name} {folio.cost_center_code ? `(${folio.cost_center_code})` : ""}</td>
                        <td>{folio.filled_vacancies}/{folio.requested_vacancies}</td>
                        <td>
                          <div className="candidate-count-indicator">
                            <span className="candidate-circle candidate-circle-neutral">{folio.candidate_count}</span>
                            <span className="candidate-circle-label">Activos</span>
                            <span className="candidate-circle candidate-circle-success">{folio.ready_candidates}</span>
                            <span className="candidate-circle-label">Listos</span>
                          </div>
                        </td>
                        <td>{getDaysSince(folio.opened_at) ?? "—"}</td>
                      </tr>
                      {isExpanded ? (
                        <tr className="tracking-table-expanded-row">
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
                                      <strong>{hr?.requester_name ?? folio.requester_name ?? "—"}</strong>
                                    </div>
                                    <div>
                                      <small>Correo</small>
                                      <strong>{hr?.requester_email ?? folio.requester_email ?? "—"}</strong>
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
                                      <strong>{hr?.other_benefits ?? "—"}</strong>
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
                                      <strong>{approvalSummary?.status === "approved" ? "Aprobada" : approvalSummary?.status === "rejected" ? "Rechazada" : "—"}</strong>
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
                            ) : (
                              <div className="expanded-case-loading">No fue posible cargar el detalle del caso.</div>
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
                    No hay folios en curso para el filtro actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem 0', borderTop: '1px solid var(--border-light)' }}>
            <button 
              type="button"
              className="soft-primary-button" 
              disabled={page === 0} 
              onClick={() => setPage(p => p - 1)}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              &lt; Anterior
            </button>
            <span className="tracking-filter-caption" style={{ margin: 0 }}>Página {page + 1} de {totalPages}</span>
            <button 
              type="button"
              className="soft-primary-button" 
              disabled={page >= totalPages - 1} 
              onClick={() => setPage(p => p + 1)}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              Siguiente &gt;
            </button>
          </div>
        )}
      </div>
    </DashboardWidgetFrame>
  );
}
