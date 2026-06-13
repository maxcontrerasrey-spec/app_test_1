import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { SelectField, TextField } from "../../../shared/ui";
import { formatCurrencyValue, formatRequestDate } from "../../../shared/lib/format";
import { formatRut } from "../../../shared/lib/rut";
import {
  cancelHrIncentiveRequest,
  fetchHrIncentiveRequests
} from "../services/incentivesApi";
import {
  invalidateHrIncentiveQueries,
  useHrIncentiveRequestDetail,
  useHrIncentiveRequests
} from "../hooks/useIncentivesQueries";
import type { HrIncentiveRequest, HrIncentiveSetupCatalogs } from "../types";
import { IncentiveActionModal } from "./IncentiveActionModal";
import { IncentiveOperationalFlags } from "./IncentiveOperationalFlags";

type IncentiveRequestsViewProps = {
  setupCatalogsQuery: UseQueryResult<HrIncentiveSetupCatalogs, Error>;
};

function getIncentiveStatusLabel(status: HrIncentiveRequest["status"]) {
  switch (status) {
    case "P":
      return "Pendiente administrador contrato";
    case "E":
      return "Pendiente gerente de area";
    case "R":
      return "Rechazado";
    case "F":
      return "Aprobado";
    case "C":
      return "Anulado";
    default:
      return status;
  }
}

function getSortableValue(request: HrIncentiveRequest, column: string) {
  switch (column) {
    case "folio":
      return request.folio;
    case "trabajador":
      return request.employeeFullName.toLowerCase();
    case "incentivo":
      return request.incentiveTypeName.toLowerCase();
    case "contrato":
      return request.selectedAreaName.toLowerCase();
    case "fecha":
      return new Date(request.serviceDate).getTime();
    case "monto":
      return request.calculatedAmount;
    case "estado":
      return getIncentiveStatusLabel(request.status).toLowerCase();
    default:
      return 0;
  }
}

function buildIncentiveExportRows(requests: HrIncentiveRequest[]) {
  return requests.map((request) => ({
    id: request.id,
    folio: request.folio,
    estado_codigo: request.status,
    estado: getIncentiveStatusLabel(request.status),
    periodo: request.periodCode,
    fecha_servicio: request.serviceDate,
    fecha_creacion: request.createdAt,
    fecha_actualizacion: request.updatedAt,
    fecha_anulacion: request.cancelledAt ?? "",
    desfase_dias_ingreso: request.entryLagDays,
    fuera_de_plazo: request.isOutOfDeadline ? "Si" : "No",
    contrato_distinto: request.isContractMismatch ? "Si" : "No",
    empleado_buk_id: request.employeeBukEmployeeId,
    tipo_documento_empleado: request.employeeDocumentType,
    rut_empleado: request.employeeDocumentNumber,
    trabajador: request.employeeFullName,
    cargo_empleado: request.employeeJobTitle,
    sindicato_empleado: request.employeeUnionName ?? "",
    estado_sindicato_empleado: request.employeeUnionStatus,
    fecha_ingreso_sindicato: request.employeeUnionJoinedAt ?? "",
    contrato_primario: request.primaryContractCode ?? "",
    area_primaria: request.primaryAreaName ?? "",
    contrato_servicio: request.selectedContractCode,
    area_servicio: request.selectedAreaName,
    codigo_area_servicio: request.selectedAreaCode ?? "",
    incentivo_tipo_id: request.incentiveTypeId,
    incentivo_tipo: request.incentiveTypeName,
    requiere_reemplazo: request.requiresReplacement ? "Si" : "No",
    reemplazo_buk_id: request.replacementBukEmployeeId ?? "",
    rut_reemplazo: request.replacementDocumentNumber ?? "",
    trabajador_reemplazado: request.replacementFullName ?? "",
    motivo: request.motive ?? "",
    descripcion: request.description ?? "",
    base_calculo: request.calculationBasis,
    rate_rule_id: request.rateRuleId ?? "",
    monto_regla: request.rateRuleAmount,
    monto_calculado: request.calculatedAmount,
    duracion_horas: request.durationHours ?? "",
    creado_por_usuario_id: request.createdBy,
    solicito: request.requesterName,
    email_solicitante: request.requesterEmail ?? "",
    flujo_actual: request.currentFlowUser ?? "",
    cancelado_por_usuario_id: request.cancelledBy ?? "",
    comentario_anulacion: request.cancellationComment ?? ""
  }));
}

async function exportIncentiveRequestsToXlsx(params: {
  requests: HrIncentiveRequest[];
  mode: "seleccionados" | "periodo";
  periodCode?: string;
}) {
  const { utils, writeFile } = await import("@mylinkpi/xlsx");
  const workbook = utils.book_new();
  const rows = buildIncentiveExportRows(params.requests);
  const worksheet = utils.json_to_sheet(rows);

  utils.book_append_sheet(workbook, worksheet, "Incentivos");

  const safePeriod = params.periodCode?.trim() ? `-${params.periodCode.trim()}` : "";
  const fileName = `incentivos-${params.mode}${safePeriod}.xlsx`;
  writeFile(workbook, fileName);
}

export function IncentiveRequestsView({
  setupCatalogsQuery
}: IncentiveRequestsViewProps) {
  const { appRoles, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [workerSearch, setWorkerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("A");
  const [typeIdFilter, setTypeIdFilter] = useState("");
  const [periodCodeFilter, setPeriodCodeFilter] = useState("");
  const [contractCodeFilter, setContractCodeFilter] = useState("");
  const [serviceDateUntil, setServiceDateUntil] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportSuccess, setExportSuccess] = useState("");
  const [requestToCancel, setRequestToCancel] = useState<HrIncentiveRequest | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [isExportingSelection, setIsExportingSelection] = useState(false);
  const [isExportingPeriod, setIsExportingPeriod] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const detailQuery = useHrIncentiveRequestDetail(selectedRequestId);

  const canCancelRequests = isSuperAdmin || appRoles.includes("control_contratos");

  const requestsQuery = useHrIncentiveRequests({
    workerSearch,
    status: statusFilter,
    typeId: typeIdFilter || undefined,
    periodCode: periodCodeFilter || undefined,
    contractCode: contractCodeFilter || undefined,
    serviceDateUntil: serviceDateUntil || undefined
  });

  const sortedRequests = useMemo(() => {
    const result = [...(requestsQuery.data ?? [])];

    if (!sortColumn) {
      return result;
    }

    result.sort((left, right) => {
      const leftValue = getSortableValue(left, sortColumn);
      const rightValue = getSortableValue(right, sortColumn);

      if (leftValue < rightValue) {
        return sortDirection === "asc" ? -1 : 1;
      }

      if (leftValue > rightValue) {
        return sortDirection === "asc" ? 1 : -1;
      }

      return 0;
    });

    return result;
  }, [requestsQuery.data, sortColumn, sortDirection]);

  useEffect(() => {
    const visibleRequestIds = new Set(sortedRequests.map((request) => request.id));
    setSelectedRequestIds((current) => current.filter((requestId) => visibleRequestIds.has(requestId)));

    if (selectedRequestId && !visibleRequestIds.has(selectedRequestId)) {
      setSelectedRequestId("");
    }
  }, [sortedRequests, selectedRequestId]);

  const selectedRequests = useMemo(() => {
    const selectedIds = new Set(selectedRequestIds);
    return sortedRequests.filter((request) => selectedIds.has(request.id));
  }, [selectedRequestIds, sortedRequests]);

  const allVisibleSelected =
    sortedRequests.length > 0 && selectedRequestIds.length === sortedRequests.length;

  const incentiveTypeOptions = useMemo(
    () =>
      (setupCatalogsQuery.data?.incentiveTypes ?? []).map((item) => ({
        value: item.id,
        label: item.name
      })),
    [setupCatalogsQuery.data?.incentiveTypes]
  );

  const contractOptions = useMemo(() => {
    const uniqueContracts = new Set(
      (requestsQuery.data ?? []).map((item) => item.selectedContractCode).filter(Boolean)
    );

    return Array.from(uniqueContracts).map((contractCode) => ({
      value: contractCode,
      label: contractCode
    }));
  }, [requestsQuery.data]);

  const cancelMutation = useMutation({
    mutationFn: ({ requestId, comment }: { requestId: string; comment?: string }) =>
      cancelHrIncentiveRequest(requestId, comment),
    onSuccess: async () => {
      setMutationError("");
      await invalidateHrIncentiveQueries(queryClient);
    },
    onError: (error: Error) => {
      setMutationError(error.message);
    }
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
        return;
      }

      setSortColumn(null);
      setSortDirection("asc");
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  };

  const handleToggleSelectAll = () => {
    setSelectedRequestIds((current) =>
      current.length === sortedRequests.length ? [] : sortedRequests.map((request) => request.id)
    );
  };

  const handleToggleSelection = (requestId: string) => {
    setSelectedRequestIds((current) =>
      current.includes(requestId)
        ? current.filter((currentRequestId) => currentRequestId !== requestId)
        : [...current, requestId]
    );
  };

  const handleExportSelection = async () => {
    if (selectedRequests.length === 0) {
      return;
    }

    setIsExportingSelection(true);
    setExportError("");
    setExportSuccess("");

    try {
      await exportIncentiveRequestsToXlsx({
        requests: selectedRequests,
        mode: "seleccionados",
        periodCode: periodCodeFilter || undefined
      });
      setExportSuccess(`Se exportaron ${selectedRequests.length} folios seleccionados.`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "No fue posible exportar los folios seleccionados.");
    } finally {
      setIsExportingSelection(false);
    }
  };

  const handleExportPeriod = async () => {
    const normalizedPeriodCode = periodCodeFilter.trim();

    if (!normalizedPeriodCode) {
      return;
    }

    setIsExportingPeriod(true);
    setExportError("");
    setExportSuccess("");

    try {
      const periodRequests = await fetchHrIncentiveRequests({
        periodCode: normalizedPeriodCode,
        status: "A"
      });

      await exportIncentiveRequestsToXlsx({
        requests: periodRequests,
        mode: "periodo",
        periodCode: normalizedPeriodCode
      });

      setExportSuccess(`Se exportaron ${periodRequests.length} incentivos del período ${normalizedPeriodCode}.`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "No fue posible exportar el período.");
    } finally {
      setIsExportingPeriod(false);
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <span style={{ opacity: 0.3, marginLeft: "0.3rem" }}>↕</span>;
    }

    return <span style={{ marginLeft: "0.3rem" }}>{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <section className="info-card">
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Historial de incentivos</h3>
          <span className="tracking-filter-caption">
            Consulta solicitudes registradas, exporta a XLS y anula solo cuando el rol lo permite.
          </span>
        </div>
        <div className="hr-incentives-history-actions">
          <button
            type="button"
            className="soft-primary-button"
            disabled={selectedRequests.length === 0 || isExportingSelection || isExportingPeriod}
            onClick={handleExportSelection}
          >
            {isExportingSelection
              ? "Exportando..."
              : `Exportar seleccionados (${selectedRequests.length})`}
          </button>
          <button
            type="button"
            className="soft-primary-button"
            disabled={!periodCodeFilter.trim() || isExportingSelection || isExportingPeriod}
            onClick={handleExportPeriod}
          >
            {isExportingPeriod ? "Exportando..." : "Exportar período"}
          </button>
        </div>
      </div>

      <div className="tracking-filters hr-incentives-filters">
        <TextField
          id="incentive-filter-worker"
          label="Buscar"
          value={workerSearch}
          onChange={(event) => setWorkerSearch(event.target.value)}
          placeholder="Trabajador, reemplazo, tipo o contrato"
        />
        <SelectField
          id="incentive-filter-status"
          label="Estado"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { value: "A", label: "Todos" },
            { value: "P", label: "Pendiente administrador contrato" },
            { value: "E", label: "Pendiente gerente de area" },
            { value: "R", label: "Rechazado" },
            { value: "F", label: "Aprobado" },
            { value: "C", label: "Anulado" }
          ]}
        />
        <SelectField
          id="incentive-filter-type"
          label="Tipo"
          value={typeIdFilter}
          onChange={(event) => setTypeIdFilter(event.target.value)}
          options={incentiveTypeOptions}
          placeholder="Todos los tipos"
        />
        <TextField
          id="incentive-filter-period"
          label="Periodo"
          value={periodCodeFilter}
          onChange={(event) => setPeriodCodeFilter(event.target.value)}
          placeholder="YYYYMM"
          inputMode="numeric"
        />
        <SelectField
          id="incentive-filter-contract"
          label="Contrato"
          value={contractCodeFilter}
          onChange={(event) => setContractCodeFilter(event.target.value)}
          options={contractOptions}
          placeholder="Todos los contratos"
        />
        <TextField
          id="incentive-filter-service-date"
          label="Servicio hasta"
          value={serviceDateUntil}
          onChange={(event) => setServiceDateUntil(event.target.value)}
          type="date"
        />
      </div>

      {mutationError ? <p className="form-status form-status-error">{mutationError}</p> : null}
      {exportError ? <p className="form-status form-status-error">{exportError}</p> : null}
      {exportSuccess ? <p className="form-status form-status-success">{exportSuccess}</p> : null}

      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los incentivos visibles"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th
                  onClick={() => handleSort("folio")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  Folio <SortIcon column="folio" />
                </th>
                <th
                  onClick={() => handleSort("trabajador")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  Trabajador <SortIcon column="trabajador" />
                </th>
                <th
                  onClick={() => handleSort("incentivo")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  Incentivo <SortIcon column="incentivo" />
                </th>
                <th
                  onClick={() => handleSort("contrato")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  Contrato <SortIcon column="contrato" />
                </th>
                <th
                  onClick={() => handleSort("fecha")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  Fecha servicio <SortIcon column="fecha" />
                </th>
                <th
                  onClick={() => handleSort("monto")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  Monto <SortIcon column="monto" />
                </th>
                <th
                  onClick={() => handleSort("estado")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  Estado <SortIcon column="estado" />
                </th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {sortedRequests.length > 0
                ? sortedRequests.map((request) => {
                    const isActiveRow = selectedRequestId === request.id;
                    const warningClass = request.isOutOfDeadline
                      ? "hr-incentives-row-danger"
                      : request.isContractMismatch
                        ? "hr-incentives-row-warning"
                        : "";

                    return (
                      <Fragment key={request.id}>
                        <tr
                          className={`${isActiveRow ? "tracking-row-selected" : ""} ${warningClass}`.trim()}
                          onClick={() => setSelectedRequestId(isActiveRow ? "" : request.id)}
                        >
                          <td onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar folio ${request.folio}`}
                              checked={selectedRequestIds.includes(request.id)}
                              onChange={() => handleToggleSelection(request.id)}
                            />
                          </td>
                          <td>
                            <span
                              className="case-code-toggle"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                fontWeight: 600
                              }}
                            >
                              <span
                                className={`expand-chevron ${isActiveRow ? "expand-chevron-open" : ""}`}
                                style={{
                                  display: "inline-block",
                                  fontSize: "1.2rem",
                                  color: "var(--text-muted)",
                                  transition: "transform 0.2s",
                                  transform: isActiveRow ? "rotate(90deg)" : "none"
                                }}
                              >
                                ▸
                              </span>
                              {String(request.folio).padStart(5, "0")}
                            </span>
                          </td>
                          <td>
                            <strong>{request.employeeFullName}</strong>
                            <div className="tracking-filter-caption">
                              {formatRut(request.employeeDocumentNumber)}
                            </div>
                            <div className="tracking-filter-caption">{request.employeeJobTitle}</div>
                          </td>
                          <td>{request.incentiveTypeName}</td>
                          <td>
                            <strong>{request.selectedAreaName}</strong>
                            <div className="tracking-filter-caption">{request.selectedContractCode}</div>
                          </td>
                          <td>{formatRequestDate(request.serviceDate)}</td>
                          <td>{formatCurrencyValue(request.calculatedAmount)}</td>
                          <td>
                            <strong>{getIncentiveStatusLabel(request.status)}</strong>
                            {request.currentFlowUser ? (
                              <div className="tracking-filter-caption">{request.currentFlowUser}</div>
                            ) : null}
                          </td>
                          <td onClick={(event) => event.stopPropagation()}>
                            {canCancelRequests && request.status !== "C" ? (
                              <button
                                type="button"
                                className="soft-primary-button soft-primary-button-danger hr-incentives-inline-button"
                                disabled={cancelMutation.isPending}
                                onClick={() => {
                                  setMutationError("");
                                  setRequestToCancel(request);
                                }}
                              >
                                Anular
                              </button>
                            ) : (
                              <span className="tracking-filter-caption">Sin acción</span>
                            )}
                          </td>
                        </tr>
                        {isActiveRow ? (
                          <tr className="tracking-table-expanded-row">
                            <td colSpan={9}>
                              {detailQuery.isLoading ? (
                                <div className="expanded-detail-section-full" style={{ padding: "1.5rem" }}>
                                  <p className="tracking-empty-state">Cargando detalle del incentivo...</p>
                                </div>
                              ) : null}

                              {detailQuery.isError ? (
                                <div className="expanded-detail-section-full" style={{ padding: "1.5rem" }}>
                                  <p className="form-status form-status-error">{detailQuery.error.message}</p>
                                </div>
                              ) : null}

                              {detailQuery.data ? (
                                <div className="expanded-case-detail-grid">
                                  <div className="expanded-detail-section">
                                    <h4>TRABAJADOR Y CONTRATO</h4>
                                    <div
                                      className="expanded-detail-fields"
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: "1rem"
                                      }}
                                    >
                                      <div className="expanded-detail-field-full" style={{ gridColumn: "1 / -1" }}>
                                        <small>Trabajador</small>
                                        <strong>{detailQuery.data.request.employeeFullName}</strong>
                                      </div>
                                      <div>
                                        <small>RUT</small>
                                        <strong>{formatRut(detailQuery.data.request.employeeDocumentNumber)}</strong>
                                      </div>
                                      <div>
                                        <small>Sindicato</small>
                                        <strong>{detailQuery.data.request.employeeUnionName ?? "No informado"}</strong>
                                      </div>
                                      <div>
                                        <small>Cargo BUK</small>
                                        <strong>{detailQuery.data.request.employeeJobTitle}</strong>
                                      </div>
                                      <div>
                                        <small>Contrato del servicio</small>
                                        <strong>{detailQuery.data.request.selectedAreaName}</strong>
                                      </div>
                                      <div>
                                        <small>Código contrato</small>
                                        <strong>{detailQuery.data.request.selectedContractCode}</strong>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="expanded-detail-section">
                                    <h4>DETALLES INCENTIVO</h4>
                                    <div
                                      className="expanded-detail-fields"
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1.5fr",
                                        gap: "1rem",
                                        alignItems: "start"
                                      }}
                                    >
                                      <div className="expanded-detail-field-full" style={{ gridColumn: "1 / -1" }}>
                                        <small>Tipo incentivo</small>
                                        <strong>{detailQuery.data.request.incentiveTypeName}</strong>
                                      </div>
                                      <div>
                                        <small>Fecha servicio</small>
                                        <strong>{formatRequestDate(detailQuery.data.request.serviceDate)}</strong>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "flex-start",
                                          gap: "0.4rem",
                                          gridRow: "span 2"
                                        }}
                                      >
                                        <small>Período pago</small>
                                        <IncentiveOperationalFlags
                                          periodCode={detailQuery.data.request.periodCode}
                                          entryLagDays={detailQuery.data.request.entryLagDays}
                                          isOutOfDeadline={detailQuery.data.request.isOutOfDeadline}
                                          isContractMismatch={detailQuery.data.request.isContractMismatch}
                                        />
                                      </div>
                                      <div>
                                        <small>Monto</small>
                                        <strong>{formatCurrencyValue(detailQuery.data.request.calculatedAmount)}</strong>
                                      </div>
                                      {detailQuery.data.request.replacementFullName ? (
                                        <div className="expanded-detail-field-full" style={{ gridColumn: "1 / -1" }}>
                                          <small>Trabajador reemplazado</small>
                                          <strong>
                                            {detailQuery.data.request.replacementFullName}
                                            {detailQuery.data.request.replacementDocumentNumber
                                              ? ` · ${formatRut(detailQuery.data.request.replacementDocumentNumber)}`
                                              : ""}
                                          </strong>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="expanded-detail-section">
                                    <h4>GESTIÓN Y OPERACIÓN</h4>
                                    <div
                                      className="expanded-detail-fields"
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr",
                                        gap: "1rem"
                                      }}
                                    >
                                      <div>
                                        <small>Estado actual</small>
                                        <strong>{getIncentiveStatusLabel(detailQuery.data.request.status)}</strong>
                                      </div>
                                      <div>
                                        <small>Motivo operacional</small>
                                        <strong>{detailQuery.data.request.motive ?? "Sin motivo registrado"}</strong>
                                      </div>
                                      {detailQuery.data.request.description ? (
                                        <div>
                                          <small>Observaciones</small>
                                          <strong>{detailQuery.data.request.description}</strong>
                                        </div>
                                      ) : null}
                                      <div>
                                        <small>Solicitó</small>
                                        <strong>{detailQuery.data.request.requesterName}</strong>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                : null}

              {!requestsQuery.isLoading && sortedRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="tracking-empty-state">
                    No hay incentivos para el filtro actual.
                  </td>
                </tr>
              ) : null}

              {requestsQuery.isLoading ? (
                <tr>
                  <td colSpan={9} className="tracking-empty-state">
                    Cargando incentivos...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <IncentiveActionModal
        isOpen={Boolean(requestToCancel)}
        title="Anular incentivo"
        description={
          requestToCancel
            ? `Confirma la anulación del incentivo folio ${requestToCancel.folio} para ${requestToCancel.employeeFullName}.`
            : ""
        }
        confirmLabel="Confirmar anulación"
        isSubmitting={cancelMutation.isPending}
        commentLabel="Comentario opcional"
        commentPlaceholder="Agrega un comentario si necesitas justificar la anulación."
        onClose={() => {
          if (!cancelMutation.isPending) {
            setRequestToCancel(null);
          }
        }}
        onConfirm={async (comment) => {
          if (!requestToCancel) {
            return;
          }

          cancelMutation.mutate({
            requestId: requestToCancel.id,
            comment: comment.trim() || undefined
          });
          setRequestToCancel(null);
        }}
      />
    </section>
  );
}
