import { useMemo, useState, Fragment } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { SelectField, TextField } from "../../../shared/ui";
import { formatCurrencyValue, formatRequestDate } from "../../../shared/lib/format";
import { formatRut } from "../../../shared/lib/rut";
import { cancelHrIncentiveRequest } from "../services/incentivesApi";
import {
  invalidateHrIncentiveQueries,
  useHrIncentiveRequests,
  useHrIncentiveRequestDetail
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

export function IncentiveRequestsView({
  setupCatalogsQuery
}: IncentiveRequestsViewProps) {
  const queryClient = useQueryClient();
  const [workerSearch, setWorkerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("A");
  const [typeIdFilter, setTypeIdFilter] = useState("");
  const [periodCodeFilter, setPeriodCodeFilter] = useState("");
  const [contractCodeFilter, setContractCodeFilter] = useState("");
  const [serviceDateUntil, setServiceDateUntil] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [requestToCancel, setRequestToCancel] = useState<HrIncentiveRequest | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const detailQuery = useHrIncentiveRequestDetail(selectedRequestId);

  const requestsQuery = useHrIncentiveRequests({
    workerSearch,
    status: statusFilter,
    typeId: typeIdFilter || undefined,
    periodCode: periodCodeFilter || undefined,
    contractCode: contractCodeFilter || undefined,
    serviceDateUntil: serviceDateUntil || undefined
  });

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

  return (
    <section className="info-card">
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Historial de incentivos</h3>
          <span className="tracking-filter-caption">
            Consulta solicitudes registradas y anula solo cuando corresponda.
          </span>
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

      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Trabajador</th>
                <th>Incentivo</th>
                <th>Contrato</th>
                <th>Fecha servicio</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {(requestsQuery.data ?? []).length > 0
                ? requestsQuery.data?.map((request) => {
                    const isActiveRow = selectedRequestId === request.id;
                    const isWarningRow = request.isContractMismatch || request.isOutOfDeadline;
                    return (
                      <Fragment key={request.id}>
                        <tr
                          className={`${isActiveRow ? "tracking-row-selected" : ""} ${isWarningRow ? "hr-incentives-row-warning" : ""}`.trim()}
                          onClick={() => setSelectedRequestId(isActiveRow ? "" : request.id)}
                        >
                          <td>
                            <span className="case-code-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                              <span className={`expand-chevron ${isActiveRow ? "expand-chevron-open" : ""}`} style={{ display: 'inline-block', fontSize: '1.2rem', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isActiveRow ? 'rotate(90deg)' : 'none' }}>▸</span>
                              {String(request.folio).padStart(5, '0')}
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
                          </td>
                          <td>{formatRequestDate(request.serviceDate)}</td>
                          <td>{formatCurrencyValue(request.calculatedAmount)}</td>
                          <td>
                            <span className="tracking-status-pill">
                              {getIncentiveStatusLabel(request.status)}
                            </span>
                            {request.currentFlowUser ? (
                              <div className="tracking-filter-caption">
                                En flujo con {request.currentFlowUser}
                              </div>
                            ) : null}
                            {request.cancellationComment ? (
                              <div className="tracking-filter-caption">
                                {request.cancellationComment}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {request.status !== "C" ? (
                              <button
                                type="button"
                                className="soft-primary-button soft-primary-button-danger hr-incentives-inline-button"
                                disabled={cancelMutation.isPending}
                                onClick={(event) => {
                                  event.stopPropagation();
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
                            <td colSpan={8}>
                              {detailQuery.isLoading ? (
                                <div className="expanded-detail-section-full" style={{ padding: '1.5rem' }}>
                                  <p className="tracking-empty-state">Cargando detalle del incentivo...</p>
                                </div>
                              ) : null}

                              {detailQuery.isError ? (
                                <div className="expanded-detail-section-full" style={{ padding: '1.5rem' }}>
                                  <p className="form-status form-status-error">{detailQuery.error.message}</p>
                                </div>
                              ) : null}

                              {detailQuery.data ? (
                                <>
                                  <div className="expanded-case-detail-grid">
                                    <div className="expanded-detail-section">
                                      <h4>TRABAJADOR Y CONTRATO</h4>
                                      <div className="expanded-detail-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="expanded-detail-field-full" style={{ gridColumn: '1 / -1' }}>
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
                                          <small>Contrato del Servicio</small>
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
                                      <div className="expanded-detail-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1rem', alignItems: 'start' }}>
                                        <div className="expanded-detail-field-full" style={{ gridColumn: '1 / -1' }}>
                                          <small>Tipo incentivo</small>
                                          <strong>{detailQuery.data.request.incentiveTypeName}</strong>
                                        </div>
                                        <div>
                                          <small>Fecha servicio</small>
                                          <strong>{formatRequestDate(detailQuery.data.request.serviceDate)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem', gridRow: 'span 2' }}>
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
                                          <div className="expanded-detail-field-full" style={{ gridColumn: '1 / -1' }}>
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
                                      <div className="expanded-detail-fields" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
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
                                </>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                : null}

              {!requestsQuery.isLoading && (requestsQuery.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="tracking-empty-state">
                    No hay incentivos para el filtro actual.
                  </td>
                </tr>
              ) : null}

              {requestsQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="tracking-empty-state">
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
