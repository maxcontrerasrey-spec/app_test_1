import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { formatDateTimeLabel } from "../../../shared/lib/format";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { formatRut } from "../../../shared/lib/rut";
import { TextField } from "../../../shared/ui";
import {
  canManageInternalMobilityHrExecution,
  toInternalMobilityVisibleStatusLabel,
  toInternalMobilityExecutionStatusLabel
} from "../../internal_mobility/lib/presentation";
import {
  invalidateInternalMobilityQueries,
  useInternalMobilityRequestDetail,
  useInternalMobilityRequests
} from "../../internal_mobility/hooks/useInternalMobilityQueries";
import { setInternalMobilityHrExecutionStatus } from "../../internal_mobility/services/internalMobilityApi";

type HiringInternalMobilityViewProps = {
  isParentLoading: boolean;
  externalErrorMessage: string;
};

export function HiringInternalMobilityView({
  isParentLoading,
  externalErrorMessage
}: HiringInternalMobilityViewProps) {
  const queryClient = useQueryClient();
  const { appRoles, isSuperAdmin, user } = useAuth();
  const requestsQuery = useInternalMobilityRequests();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [isHrExecutionSaving, setIsHrExecutionSaving] = useState(false);
  const [hrExecutionError, setHrExecutionError] = useState<string | null>(null);
  const canManageHrExecution = canManageInternalMobilityHrExecution(appRoles, isSuperAdmin);

  const approvedRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (requestsQuery.data ?? [])
      .filter((request) => request.status === "approved" && request.hrExecutionStatus !== "executed")
      .filter((request) => {
        if (!normalizedSearch) {
          return true;
        }

        return [
          request.folio,
          request.employeeFullName,
          request.employeeDocumentNumber ?? "",
          request.destinationAreaName,
          request.destinationCompanyName,
          request.destinationJobTitle,
          request.requesterName
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      });
  }, [requestsQuery.data, searchTerm]);

  useEffect(() => {
    if (!approvedRequests.length) {
      if (selectedRequestId) {
        setSelectedRequestId("");
      }
      return;
    }

    if (!selectedRequestId || !approvedRequests.some((request) => request.requestId === selectedRequestId)) {
      setSelectedRequestId(approvedRequests[0].requestId);
    }
  }, [approvedRequests, selectedRequestId]);

  useEffect(() => {
    setHrExecutionError(null);
  }, [selectedRequestId]);

  const selectedRequest =
    approvedRequests.find((request) => request.requestId === selectedRequestId) ?? null;
  const requestDetailQuery = useInternalMobilityRequestDetail(
    selectedRequestId,
    Boolean(selectedRequestId)
  );

  const isLoading = isParentLoading || requestsQuery.isLoading;
  const errorMessage =
    externalErrorMessage ||
    hrExecutionError ||
    (requestsQuery.error instanceof Error ? requestsQuery.error.message : "") ||
    (requestDetailQuery.error instanceof Error ? requestDetailQuery.error.message : "");

  const handleHrExecutionStatusChange = async (
    status: "pending" | "executed" | "rejected"
  ) => {
    if (!selectedRequestId) {
      return;
    }

    setIsHrExecutionSaving(true);
    setHrExecutionError(null);

    try {
      const { error } = await setInternalMobilityHrExecutionStatus({
        requestId: selectedRequestId,
        status
      });

      if (error) {
        setHrExecutionError(error);
        return;
      }

      await invalidateInternalMobilityQueries(queryClient, selectedRequestId);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.home(user?.id ?? "anonymous")
      });
    } finally {
      setIsHrExecutionSaving(false);
    }
  };

  return (
    <>
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Movilidad Interna</h3>
          <span className="tracking-filter-caption">
            Solicitudes aprobadas listas para ejecutar el traslado interno del trabajador.
          </span>
        </div>
        <div className="tracking-filters">
          <TextField
            id="hiring-internal-mobility-search"
            label="Buscar movilidad"
            value={searchTerm}
            placeholder="Trabajador, folio, cargo, contrato o empresa"
            onChange={(event) => setSearchTerm(event.target.value)}
            className="tracking-search-field"
          />
        </div>
      </div>

      {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}

      <div
        className="control-layout control-layout-stacked control-layout-stacked-mobility"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedRequestId("");
          }
        }}
      >
        <div className="tracking-table-wrap tracking-table-wrap-full">
          <div className="tracking-table-scroll tracking-table-scroll-mobility-queue">
            <table className="tracking-table">
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>Folio MI</th>
                  <th>Folio destino</th>
                  <th>Cargo destino</th>
                  <th>Contrato destino</th>
                  <th>Aprobada</th>
                  <th>Solicitó</th>
                </tr>
              </thead>
              <tbody>
                {approvedRequests.length > 0 ? (
                  approvedRequests.map((request) => (
                    <tr
                      key={request.requestId}
                      className={
                        request.requestId === selectedRequestId ? "tracking-row-selected" : ""
                      }
                      onClick={() => setSelectedRequestId(request.requestId)}
                    >
                      <td>
                        <strong>{request.employeeFullName}</strong>
                        <div className="tracking-filter-caption">
                          {request.employeeDocumentNumber
                            ? formatRut(request.employeeDocumentNumber)
                            : "Sin identificador"}
                        </div>
                      </td>
                      <td>{request.folio}</td>
                      <td>{request.sourceFolio ?? request.recruitmentCaseCode ?? "—"}</td>
                      <td>{request.destinationJobTitle}</td>
                      <td>{request.destinationAreaName}</td>
                      <td>{formatDateTimeLabel(request.approvedAt ?? request.submittedAt, "—")}</td>
                      <td>{request.requesterName}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="tracking-empty-state" colSpan={7}>
                      {isLoading
                        ? "Cargando movilidades internas..."
                        : "No hay movilidades internas aprobadas para el filtro actual."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="control-detail-panel control-detail-panel-full">
          {selectedRequest && requestDetailQuery.data ? (
            <>
            <div className="control-detail-header">
              <div>
                <h3>{requestDetailQuery.data.request.employeeFullName}</h3>
                <span className="tracking-status-pill">
                  {toInternalMobilityVisibleStatusLabel(
                    requestDetailQuery.data.request.status,
                    requestDetailQuery.data.request.hrExecutionStatus
                  )}
                </span>
              </div>
              <div className="mobility-detail-pill-row">
                <span className="tracking-status-pill">
                  {toInternalMobilityExecutionStatusLabel(requestDetailQuery.data.request.hrExecutionStatus)}
                </span>
              </div>
            </div>

            <div className="control-detail-body">
              <div className="control-readonly-grid">
                <div>
                  <small>Folio movilidad</small>
                  <strong>{requestDetailQuery.data.request.folio}</strong>
                </div>
                <div>
                  <small>Folio contratación</small>
                  <strong>{requestDetailQuery.data.request.sourceFolio ?? "—"}</strong>
                </div>
                <div>
                  <small>Caso contratación</small>
                  <strong>{requestDetailQuery.data.request.recruitmentCaseCode ?? "—"}</strong>
                </div>
                <div>
                  <small>Solicitó</small>
                  <strong>{requestDetailQuery.data.request.requesterName}</strong>
                </div>
              </div>

              <div className="expanded-detail-section">
                <h4>Origen actual</h4>
                <div className="expanded-detail-fields">
                  <div>
                    <small>Cargo actual</small>
                    <strong>{requestDetailQuery.data.request.currentJobTitle ?? "—"}</strong>
                  </div>
                  <div>
                    <small>Área actual</small>
                    <strong>{requestDetailQuery.data.request.currentAreaName ?? "—"}</strong>
                  </div>
                  <div>
                    <small>Empresa actual</small>
                    <strong>{requestDetailQuery.data.request.currentCompanyName ?? "—"}</strong>
                  </div>
                  <div>
                    <small>Turno actual</small>
                    <strong>{requestDetailQuery.data.request.currentShiftName ?? "—"}</strong>
                  </div>
                </div>
              </div>

              <div className="expanded-detail-section">
                <h4>Destino aprobado</h4>
                <div className="expanded-detail-fields">
                  <div>
                    <small>Cargo destino</small>
                    <strong>{requestDetailQuery.data.request.destinationJobTitle}</strong>
                  </div>
                  <div>
                    <small>Contrato / Área destino</small>
                    <strong>{requestDetailQuery.data.request.destinationAreaName}</strong>
                  </div>
                  <div>
                    <small>Centro de costo</small>
                    <strong>
                      {requestDetailQuery.data.request.destinationCostCenterName ?? "—"}
                      {requestDetailQuery.data.request.destinationCostCenterCode
                        ? ` (${requestDetailQuery.data.request.destinationCostCenterCode})`
                        : ""}
                    </strong>
                  </div>
                  <div>
                    <small>Empresa destino</small>
                    <strong>{requestDetailQuery.data.request.destinationCompanyName ?? "—"}</strong>
                  </div>
                  <div>
                    <small>Turno destino</small>
                    <strong>{requestDetailQuery.data.request.destinationShiftName ?? "—"}</strong>
                  </div>
                  <div>
                    <small>Requiere finiquito</small>
                    <strong>{requestDetailQuery.data.request.requiresTermination ? "Sí" : "No"}</strong>
                  </div>
                </div>
              </div>

              <div className="expanded-detail-section">
                <h4>Ejecución</h4>
                <div className="expanded-detail-fields">
                  <div>
                    <small>Enviada</small>
                    <strong>{formatDateTimeLabel(requestDetailQuery.data.request.submittedAt, "—")}</strong>
                  </div>
                  <div>
                    <small>Aprobada</small>
                    <strong>{formatDateTimeLabel(requestDetailQuery.data.request.approvedAt, "—")}</strong>
                  </div>
                  <div>
                    <small>Etapas aprobadas</small>
                    <strong>
                      {requestDetailQuery.data.approvals.filter((approval) => approval.status === "approved").length}
                    </strong>
                  </div>
                  <div>
                    <small>Estado final</small>
                    <strong>
                      {toInternalMobilityVisibleStatusLabel(
                        requestDetailQuery.data.request.status,
                        requestDetailQuery.data.request.hrExecutionStatus
                      )}
                    </strong>
                  </div>
                  <div>
                    <small>Estado RRHH</small>
                    <strong>{toInternalMobilityExecutionStatusLabel(requestDetailQuery.data.request.hrExecutionStatus)}</strong>
                  </div>
                  <div>
                    <small>RRHH ejecutó</small>
                    <strong>{formatDateTimeLabel(requestDetailQuery.data.request.hrExecutionExecutedAt, "—")}</strong>
                  </div>
                  <div>
                    <small>Ejecutó RRHH</small>
                    <strong>{requestDetailQuery.data.request.hrExecutionExecutedByName ?? "—"}</strong>
                  </div>
                </div>
                <div className="mobility-execution-actions">
                  <button
                    type="button"
                    className="soft-primary-button"
                    disabled={!canManageHrExecution || isHrExecutionSaving}
                    onClick={() => {
                      void handleHrExecutionStatusChange("pending");
                    }}
                  >
                    Pendiente de Ejecución RRHH
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button"
                    disabled={!canManageHrExecution || isHrExecutionSaving}
                    onClick={() => {
                      void handleHrExecutionStatusChange("executed");
                    }}
                  >
                    {isHrExecutionSaving ? "Guardando..." : "Ejecutado RRHH"}
                  </button>
                  <button
                    type="button"
                    className="soft-primary-button"
                    disabled={!canManageHrExecution || isHrExecutionSaving}
                    onClick={() => {
                      void handleHrExecutionStatusChange("rejected");
                    }}
                  >
                    {isHrExecutionSaving ? "Guardando..." : "Rechazado"}
                  </button>
                </div>
                {!canManageHrExecution ? (
                  <p className="helper-copy">Solo RRHH administrativo o administradores pueden cerrar esta ejecución.</p>
                ) : null}
              </div>

              <div className="expanded-detail-section expanded-detail-section-full">
                <h4>Motivo del cambio</h4>
                <p className="mobility-detail-copy">{requestDetailQuery.data.request.motive}</p>
              </div>
            </div>
            </>
          ) : (
            <div className="control-detail-body">
              <div className="expanded-detail-section expanded-detail-section-full tracking-expanded-feedback">
                Selecciona un conductor para revisar el resumen de la movilidad interna.
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
