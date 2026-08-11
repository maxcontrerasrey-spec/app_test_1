import { Fragment, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SelectField, TextField } from "../../../shared/ui";
import { useAuth } from "../../auth/context/AuthContext";
import { useHrSanctionRequestsPage, invalidateHrSanctionQueries } from "../hooks/useSanctionsQueries";
import { transitionHrSanctionRequest } from "../services/sanctionsApi";
import type { HrSanctionRequestRow, HrSanctionStatus } from "../types";

const STATUS_LABELS: Record<HrSanctionStatus, string> = {
  submitted: "Ingresada",
  under_review: "En revisión",
  returned: "Devuelta",
  rejected: "Rechazada",
  issued: "Emitida",
  pending_signature: "Pendiente firma",
  pending_certified_mail: "Pendiente correo certificado",
  pending_dt_filing: "Pendiente DT",
  closed: "Cerrada",
  expired: "Vencida",
  cancelled: "Cancelada"
};

const MANAGER_STATUSES: Array<{ value: HrSanctionStatus; label: string }> = [
  { value: "under_review", label: "Tomar revisión" },
  { value: "returned", label: "Devolver" },
  { value: "rejected", label: "Rechazar" },
  { value: "issued", label: "Marcar emitida" },
  { value: "pending_signature", label: "Pendiente firma" },
  { value: "pending_certified_mail", label: "Pendiente correo certificado" },
  { value: "pending_dt_filing", label: "Pendiente DT" },
  { value: "closed", label: "Cerrar" }
];

function formatDateTime(value: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function canManageSanctions(appRoles: string[], isSuperAdmin: boolean) {
  return (
    isSuperAdmin ||
    appRoles.some((role) =>
      ["admin", "control_contratos", "gerente_general", "director_op"].includes(role)
    )
  );
}

function getStatusTone(status: HrSanctionStatus) {
  if (status === "closed") return "mobility-status-pill-success";
  if (["rejected", "expired", "cancelled"].includes(status)) {
    return "mobility-status-pill-danger";
  }
  if (
    [
      "under_review",
      "issued",
      "pending_signature",
      "pending_certified_mail",
      "pending_dt_filing"
    ].includes(status)
  ) {
    return "mobility-status-pill-warning";
  }
  return "";
}

function SanctionRequestExpandedDetail({
  row,
  canManage,
  busyRequestId,
  onTransition
}: {
  row: HrSanctionRequestRow;
  canManage: boolean;
  busyRequestId: string | null;
  onTransition: (requestId: string, nextStatus: HrSanctionStatus) => void;
}) {
  return (
    <tr className="tracking-table-expanded-row">
      <td colSpan={6}>
        <div className="expanded-case-detail-grid sanctions-expanded-detail">
          <div className="expanded-detail-section">
            <h4>Trabajador</h4>
            <div className="expanded-detail-fields">
              <div>
                <strong>{row.employeeFullName}</strong>
                <span>{row.employeeDocumentNumber}</span>
              </div>
              <div>
                <strong>{row.employeeJobTitle || "Sin cargo"}</strong>
                <span>{row.employeeAreaName || row.employeeContractCode || "Sin contrato"}</span>
              </div>
            </div>
          </div>

          <div className="expanded-detail-section">
            <h4>Infracción</h4>
            <div className="expanded-detail-fields">
              <div>
                <strong>{row.causeName}</strong>
                <span>{row.measureName}</span>
              </div>
              <div>
                <strong>{formatDateTime(row.incidentAt)}</strong>
                <span>{row.incidentPlace}</span>
              </div>
              {row.equipmentNumber ? (
                <div>
                  <strong>Equipo</strong>
                  <span>{row.equipmentNumber}</span>
                </div>
              ) : null}
              <div>
                <strong>Solicitante</strong>
                <span>{row.requesterName || "Sin solicitante informado"}</span>
              </div>
            </div>
          </div>

          <div className="expanded-detail-section">
            <h4>Gestión RRLL</h4>
            <div className="expanded-detail-fields">
              <div>
                <strong>Vencimiento</strong>
                <span>{formatDateTime(row.dueAt)}</span>
              </div>
              <div>
                <strong>Respaldos</strong>
                <span>{row.documentsCount}</span>
              </div>
              <div>
                <strong>BUK</strong>
                <span>{row.bukUploadStatus.replace(/_/g, " ")}</span>
              </div>
              {canManage ? (
                <label className="sanctions-inline-action">
                  <span>Cambiar estado</span>
                  <select
                    value=""
                    onChange={(event) =>
                      onTransition(row.id, event.target.value as HrSanctionStatus)
                    }
                    disabled={busyRequestId === row.id}
                  >
                    <option value="">Seleccionar acción</option>
                    {MANAGER_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function SanctionsControlView() {
  const queryClient = useQueryClient();
  const { appRoles, isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<HrSanctionStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canManage = useMemo(
    () => canManageSanctions(appRoles, isSuperAdmin),
    [appRoles, isSuperAdmin]
  );
  const requestsQuery = useHrSanctionRequestsPage({
    status,
    search,
    limit: 50,
    offset: 0
  });
  const page = requestsQuery.data;
  const statusOptions = useMemo(
    () => [
      { value: "all", label: "Todos" },
      ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
    ],
    []
  );

  async function handleTransition(requestId: string, nextStatus: HrSanctionStatus) {
    const comment =
      nextStatus === "returned" || nextStatus === "rejected"
        ? window.prompt("Indica motivo o comentario para auditoría") ?? ""
        : "";

    if ((nextStatus === "returned" || nextStatus === "rejected") && !comment.trim()) {
      return;
    }

    setBusyRequestId(requestId);
    setErrorMessage(null);
    try {
      await transitionHrSanctionRequest({
        requestId,
        nextStatus,
        comment
      });
      await invalidateHrSanctionQueries(queryClient);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No fue posible actualizar la solicitud."
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  return (
    <div className="sanctions-control-view">
      <div className="sanctions-section-heading">
        <div>
          <h2>Control de sanciones</h2>
          <p>Seguimiento por estado, plazo de 48 horas y documentación asociada.</p>
        </div>
      </div>

      {errorMessage ? <div className="form-error-message">{errorMessage}</div> : null}

      <div className="tracking-kpi-row sanctions-kpi-row">
        <article className="tracking-kpi-card tracking-kpi-card-generado">
          <span>Total</span>
          <strong>{page?.kpis.total ?? 0}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-pendiente">
          <span>Ingresadas</span>
          <strong>{page?.kpis.submitted ?? 0}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-en-proceso">
          <span>En revisión</span>
          <strong>{page?.kpis.underReview ?? 0}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-pendiente">
          <span>Pendiente firma</span>
          <strong>{page?.kpis.pendingSignature ?? 0}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-error">
          <span>Vencidas</span>
          <strong>{page?.kpis.overdue ?? 0}</strong>
        </article>
      </div>

      <div className="tracking-filters tracking-filters-inline sanctions-toolbar">
        <SelectField
          id="sanction-status-filter"
          label="Estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as HrSanctionStatus | "all")}
          options={statusOptions}
          includePlaceholder={false}
          className="tracking-filter-select"
        />
        <TextField
          id="sanction-search"
          label="Buscar"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Folio, trabajador, RUT, causal o equipo"
          className="tracking-search-field"
        />
      </div>

      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table sanctions-tracking-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Trabajador</th>
                <th>Causal</th>
                <th>Ocurrencia</th>
                <th>Estado</th>
                <th>Respaldos</th>
              </tr>
            </thead>
            <tbody>
              {requestsQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="tracking-empty-state">
                    Cargando solicitudes de sanción...
                  </td>
                </tr>
              ) : null}
              {!requestsQuery.isLoading && !page?.rows.length ? (
                <tr>
                  <td colSpan={6} className="tracking-empty-state">
                    No hay solicitudes para los filtros actuales.
                  </td>
                </tr>
              ) : null}
              {page?.rows.map((row) => {
                const isExpanded = expandedRequestId === row.id;

                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`tracking-table-row-clickable ${isExpanded ? "tracking-table-row-expanded" : ""}`}
                      onClick={() => setExpandedRequestId(isExpanded ? null : row.id)}
                      aria-expanded={isExpanded}
                    >
                      <td>
                        <span className="case-code-toggle tracking-case-code-toggle">
                          <span className={`expand-chevron tracking-expand-chevron ${isExpanded ? "expand-chevron-open" : ""}`}>
                            ›
                          </span>
                          #{row.folio}
                        </span>
                      </td>
                      <td>
                        <strong>{row.employeeFullName}</strong>
                        <span className="sanctions-table-subtext">{row.employeeDocumentNumber}</span>
                      </td>
                      <td>
                        <strong>{row.causeName}</strong>
                        <span className="sanctions-table-subtext">{row.measureName}</span>
                      </td>
                      <td>
                        <strong>{formatDateTime(row.incidentAt)}</strong>
                        <span className="sanctions-table-subtext">{row.incidentPlace}</span>
                      </td>
                      <td>
                        <span className={`tracking-status-pill mobility-status-pill ${getStatusTone(row.status)}`}>
                          {STATUS_LABELS[row.status]}
                        </span>
                        <span className="sanctions-table-subtext">Vence {formatDateTime(row.dueAt)}</span>
                      </td>
                      <td>{row.documentsCount}</td>
                    </tr>
                    {isExpanded ? (
                      <SanctionRequestExpandedDetail
                        row={row}
                        canManage={canManage}
                        busyRequestId={busyRequestId}
                        onTransition={handleTransition}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
