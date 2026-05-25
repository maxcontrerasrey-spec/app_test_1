import React, { useMemo, useState } from "react";
import { TextField } from "../../../../shared/ui";
import {
  fetchRecruitmentCaseDetail,
  toRecruitmentCaseStatusLabel,
  type RecruitmentCaseDetail
} from "../../../recruitment/services/hiringControl";
import type { DashboardActiveFolioItem, DashboardDataBundle, ResolvedWidget } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";

type ActiveFoliosWidgetProps = {
  widget: ResolvedWidget;
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

export function ActiveFoliosWidget({ widget, dashboardData }: ActiveFoliosWidgetProps) {
  const folios = dashboardData?.activeFoliosData ?? [];
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [caseDetailsCache, setCaseDetailsCache] = useState<Record<string, RecruitmentCaseDetail | null>>({});

  const filteredFolios = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return folios;

    return folios.filter((folio) =>
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
  }, [folios, searchTerm]);

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
    <DashboardWidgetFrame title={widget.name} className="widget-tasks widget-fill-height">
      <div className="dashboard-folios-toolbar">
        <TextField
          id="dashboard-folios-search"
          label="Buscar folio en curso"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Caso, contrato, centro de costo o solicitante"
          className="dashboard-folios-search"
        />
      </div>

      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table">
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
              {filteredFolios.length > 0 ? (
                filteredFolios.map((folio: DashboardActiveFolioItem) => {
                  const isExpanded = expandedCaseId === folio.id;
                  const detail = caseDetailsCache[folio.id] ?? null;
                  const hr = detail?.case?.hiring_request;

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
                        <td>{folio.requester_name ?? "—"}</td>
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
      </div>
    </DashboardWidgetFrame>
  );
}
