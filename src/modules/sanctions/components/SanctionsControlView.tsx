import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { useHrSanctionRequestsPage, invalidateHrSanctionQueries } from "../hooks/useSanctionsQueries";
import { transitionHrSanctionRequest } from "../services/sanctionsApi";
import type { HrSanctionStatus } from "../types";

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

export function SanctionsControlView() {
  const queryClient = useQueryClient();
  const { appRoles, isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<HrSanctionStatus | "all">("all");
  const [search, setSearch] = useState("");
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

      <div className="sanctions-toolbar">
        <label>
          <span>Estado</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as HrSanctionStatus | "all")}>
            <option value="all">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Buscar</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Folio, trabajador, RUT, causal o equipo"
          />
        </label>
      </div>

      <div className="sanctions-table-wrap">
        <table className="sanctions-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Trabajador</th>
              <th>Causal</th>
              <th>Ocurrencia</th>
              <th>Estado</th>
              <th>Respaldos</th>
              {canManage ? <th>Acción RRLL</th> : null}
            </tr>
          </thead>
          <tbody>
            {requestsQuery.isLoading ? (
              <tr>
                <td colSpan={canManage ? 7 : 6}>Cargando solicitudes...</td>
              </tr>
            ) : null}
            {!requestsQuery.isLoading && !page?.rows.length ? (
              <tr>
                <td colSpan={canManage ? 7 : 6}>No hay solicitudes para los filtros actuales.</td>
              </tr>
            ) : null}
            {page?.rows.map((row) => (
              <tr key={row.id}>
                <td>#{row.folio}</td>
                <td>
                  <strong>{row.employeeFullName}</strong>
                  <span>{row.employeeDocumentNumber}</span>
                  <small>{row.employeeAreaName || row.employeeContractCode || "Sin contrato"}</small>
                </td>
                <td>
                  <strong>{row.causeName}</strong>
                  <span>{row.measureName}</span>
                  {row.equipmentNumber ? <small>Equipo {row.equipmentNumber}</small> : null}
                </td>
                <td>
                  <span>{formatDateTime(row.incidentAt)}</span>
                  <small>{row.incidentPlace}</small>
                </td>
                <td>
                  <span className={`sanctions-status-pill sanctions-status-${row.status}`}>
                    {STATUS_LABELS[row.status]}
                  </span>
                  <small>Vence {formatDateTime(row.dueAt)}</small>
                </td>
                <td>{row.documentsCount}</td>
                {canManage ? (
                  <td>
                    <select
                      value=""
                      onChange={(event) =>
                        handleTransition(row.id, event.target.value as HrSanctionStatus)
                      }
                      disabled={busyRequestId === row.id}
                    >
                      <option value="">Cambiar estado</option>
                      {MANAGER_STATUSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
