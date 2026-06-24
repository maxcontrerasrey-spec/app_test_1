import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { TextField, MultiSelectField } from "../../../shared/ui";
import { formatCurrencyValue, formatRequestDate } from "../../../shared/lib/format";
import { formatRut } from "../../../shared/lib/rut";
import {
  cancelHrIncentiveRequest,
  fetchAllHrIncentiveRequests
} from "../services/incentivesApi";
import {
  invalidateHrIncentiveQueries,
  useHrIncentiveRequestDetail,
  useHrIncentiveRequestsPage
} from "../hooks/useIncentivesQueries";
import type {
  HrIncentiveRequest,
  HrIncentiveRequestSortColumn,
  HrIncentiveSetupCatalogs
} from "../types";
import { IncentiveActionModal } from "./IncentiveActionModal";
import { IncentiveOperationalFlags } from "./IncentiveOperationalFlags";

type IncentiveRequestsViewProps = {
  setupCatalogsQuery: UseQueryResult<HrIncentiveSetupCatalogs, Error>;
};

const REQUESTS_PAGE_SIZE = 50;
const STATUS_FILTER_OPTIONS = [
  { value: "A", label: "Todos" },
  { value: "P", label: "Pendiente administrador contrato" },
  { value: "E", label: "Pendiente gerente de area" },
  { value: "R", label: "Rechazado" },
  { value: "F", label: "Aprobado" },
  { value: "C", label: "Anulado" }
];

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

function buildIncentiveExportRows(requests: HrIncentiveRequest[]) {
  const parseExcelDate = (value: string | null | undefined) => {
    if (!value?.trim()) {
      return null;
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return null;
    }

    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  };

  const parseExcelDateTime = (value: string | null | undefined) => {
    if (!value?.trim()) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  return requests.map((request) => ({
    folio: request.folio,
    estado_codigo: request.status,
    estado: getIncentiveStatusLabel(request.status),
    periodo: request.periodCode,
    fecha_servicio: parseExcelDate(request.serviceDate),
    fecha_creacion: parseExcelDateTime(request.createdAt),
    fecha_actualizacion: parseExcelDateTime(request.updatedAt),
    fecha_anulacion: parseExcelDateTime(request.cancelledAt),
    desfase_dias_ingreso: request.entryLagDays,
    fuera_de_plazo: request.isOutOfDeadline ? "Si" : "No",
    contrato_distinto: request.isContractMismatch ? "Si" : "No",
    declarado_en_descanso: request.declaredRestDay === null ? "" : request.declaredRestDay ? "Si" : "No",
    rut_empleado: request.employeeDocumentNumber,
    trabajador: request.employeeFullName,
    cargo_empleado: request.employeeJobTitle,
    sindicato_empleado: request.employeeUnionName ?? "",
    area_primaria: request.primaryAreaName ?? "",
    area_servicio: request.selectedAreaName,
    incentivo_tipo: request.incentiveTypeName,
    requiere_reemplazo: request.requiresReplacement ? "Si" : "No",
    rut_reemplazo: request.replacementDocumentNumber ?? "",
    trabajador_reemplazado: request.replacementFullName ?? "",
    motivo: request.motive ?? "",
    descripcion: request.description ?? "",
    monto_regla: request.rateRuleAmount,
    monto_calculado: request.calculatedAmount,
    duracion_horas: request.durationHours ?? "",
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
  const worksheet = utils.json_to_sheet(rows, { cellDates: true });

  const dateOnlyColumns = new Set(["fecha_servicio"]);
  const dateTimeColumns = new Set(["fecha_creacion", "fecha_actualizacion", "fecha_anulacion"]);
  const headers = Object.keys(rows[0] ?? {});

  headers.forEach((header, columnIndex) => {
    const isDateOnlyColumn = dateOnlyColumns.has(header);
    const isDateTimeColumn = dateTimeColumns.has(header);

    if (!isDateOnlyColumn && !isDateTimeColumn) {
      return;
    }

    const columnRef = utils.encode_col(columnIndex);

    rows.forEach((_, rowIndex) => {
      const cellRef = `${columnRef}${rowIndex + 2}`;
      const cell = worksheet[cellRef];

      if (!cell || !(cell.v instanceof Date)) {
        return;
      }

      cell.t = "d";
      cell.z = isDateOnlyColumn ? "dd-mm-yyyy" : "dd-mm-yyyy hh:mm";
    });
  });

  utils.book_append_sheet(workbook, worksheet, "Incentivos");

  const safePeriod = params.periodCode?.trim() ? `-${params.periodCode.trim()}` : "";
  const fileName = `incentivos-${params.mode}${safePeriod}.xlsx`;
  writeFile(workbook, fileName, { cellDates: true });
}

export function IncentiveRequestsView({
  setupCatalogsQuery
}: IncentiveRequestsViewProps) {
  const { appRoles, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [workerSearch, setWorkerSearch] = useState("");
  const [debouncedWorkerSearch, setDebouncedWorkerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(["A"]);
  const [typeIdFilter, setTypeIdFilter] = useState<string[]>([]);
  const [periodCodeFilter, setPeriodCodeFilter] = useState("");
  const [contractCodeFilter, setContractCodeFilter] = useState<string[]>([]);
  const [serviceDateUntil, setServiceDateUntil] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportSuccess, setExportSuccess] = useState("");
  const [requestToCancel, setRequestToCancel] = useState<HrIncentiveRequest | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [isExportingSelection, setIsExportingSelection] = useState(false);
  const [isExportingPeriod, setIsExportingPeriod] = useState(false);
  const [sortColumn, setSortColumn] = useState<HrIncentiveRequestSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const detailQuery = useHrIncentiveRequestDetail(selectedRequestId);

  const canCancelRequests = isSuperAdmin || appRoles.includes("control_contratos");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedWorkerSearch(workerSearch.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [workerSearch]);

  useEffect(() => {
    setPage(0);
  }, [
    contractCodeFilter,
    debouncedWorkerSearch,
    periodCodeFilter,
    serviceDateUntil,
    sortColumn,
    sortDirection,
    statusFilter,
    typeIdFilter
  ]);

  const requestsQuery = useHrIncentiveRequestsPage({
    workerSearch: debouncedWorkerSearch || undefined,
    statuses: statusFilter.length > 0 ? statusFilter : undefined,
    typeIds: typeIdFilter.length > 0 ? typeIdFilter : undefined,
    periodCode: periodCodeFilter || undefined,
    contractCodes: contractCodeFilter.length > 0 ? contractCodeFilter : undefined,
    serviceDateUntil: serviceDateUntil || undefined,
    limit: REQUESTS_PAGE_SIZE,
    offset: page * REQUESTS_PAGE_SIZE,
    sortColumn,
    sortDirection
  });

  const pagedRequests = requestsQuery.data?.items ?? [];
  const totalCount = requestsQuery.data?.totalCount ?? 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / REQUESTS_PAGE_SIZE) : 0;

  useEffect(() => {
    if (page > 0 && totalPages > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  useEffect(() => {
    const visibleRequestIds = new Set(pagedRequests.map((request) => request.id));
    setSelectedRequestIds((current) => current.filter((requestId) => visibleRequestIds.has(requestId)));

    if (selectedRequestId && !visibleRequestIds.has(selectedRequestId)) {
      setSelectedRequestId("");
    }
  }, [pagedRequests, selectedRequestId]);

  const selectedRequests = useMemo(() => {
    const selectedIds = new Set(selectedRequestIds);
    return pagedRequests.filter((request) => selectedIds.has(request.id));
  }, [pagedRequests, selectedRequestIds]);

  const allVisibleSelected =
    pagedRequests.length > 0 && selectedRequestIds.length === pagedRequests.length;

  const incentiveTypeOptions = useMemo(
    () =>
      (setupCatalogsQuery.data?.incentiveTypes ?? []).map((item) => ({
        value: item.id,
        label: item.name
      })),
    [setupCatalogsQuery.data?.incentiveTypes]
  );

  const contractOptions = setupCatalogsQuery.data?.contractOptions ?? [];

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

  const handleSort = (column: HrIncentiveRequestSortColumn) => {
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
      current.length === pagedRequests.length ? [] : pagedRequests.map((request) => request.id)
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
      const periodRequests = await fetchAllHrIncentiveRequests({
        periodCode: normalizedPeriodCode,
        workerSearch: debouncedWorkerSearch || undefined,
        statuses: statusFilter.length > 0 ? statusFilter : undefined,
        typeIds: typeIdFilter.length > 0 ? typeIdFilter : undefined,
        contractCodes: contractCodeFilter.length > 0 ? contractCodeFilter : undefined,
        serviceDateUntil: serviceDateUntil || undefined
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

  const SortIcon = ({ column }: { column: HrIncentiveRequestSortColumn }) => {
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
        <MultiSelectField
          id="incentive-filter-status"
          label="Estados"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
          placeholder="Todos"
        />
        <MultiSelectField
          id="incentive-filter-type"
          label="Tipos"
          value={typeIdFilter}
          onChange={setTypeIdFilter}
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
        <MultiSelectField
          id="incentive-filter-contract"
          label="Contratos"
          value={contractCodeFilter}
          onChange={setContractCodeFilter}
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
      {requestsQuery.isError ? (
        <p className="form-status form-status-error">{requestsQuery.error.message}</p>
      ) : null}

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
              {pagedRequests.length > 0
                ? pagedRequests.map((request) => {
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
                                          declaredRestDay={detailQuery.data.request.declaredRestDay}
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

              {!requestsQuery.isLoading && pagedRequests.length === 0 ? (
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

      {totalPages > 1 ? (
        <div className="hr-incentives-pagination">
          <button
            type="button"
            className="soft-primary-button hr-incentives-pagination-button"
            disabled={page === 0}
            onClick={() => setPage((currentPage) => currentPage - 1)}
          >
            &lt; Anterior
          </button>
          <span className="tracking-filter-caption hr-incentives-pagination-label">
            Página {page + 1} de {totalPages} · {totalCount} registros
          </span>
          <button
            type="button"
            className="soft-primary-button hr-incentives-pagination-button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((currentPage) => currentPage + 1)}
          >
            Siguiente &gt;
          </button>
        </div>
      ) : null}

      {totalCount > 0 ? (
        <p className="tracking-filter-caption">
          {selectedRequests.length} incentivo(s) seleccionados · {totalCount} coincidencia(s) para el filtro
        </p>
      ) : null}

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
