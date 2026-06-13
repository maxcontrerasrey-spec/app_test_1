import { useMemo, useState } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { SelectField, TextField } from "../../../shared/ui";
import { formatCurrencyValue, formatRequestDate } from "../../../shared/lib/format";
import { formatRut } from "../../../shared/lib/rut";
import { cancelHrIncentiveRequest } from "../services/incentivesApi";
import {
  invalidateHrIncentiveQueries,
  useHrIncentiveRequests
} from "../hooks/useIncentivesQueries";
import type { HrIncentiveRequest, HrIncentiveSetupCatalogs } from "../types";
import { IncentiveActionModal } from "./IncentiveActionModal";

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
                <th>Tipo</th>
                <th>Contrato</th>
                <th>Fecha servicio</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {(requestsQuery.data ?? []).length > 0
                ? requestsQuery.data?.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>{String(request.folio).padStart(5, '0')}</strong>
                      </td>
                      <td>
                        <strong>{request.employeeFullName}</strong>
                        <div className="tracking-filter-caption">
                          {formatRut(request.employeeDocumentNumber)}
                        </div>
                        <div className="tracking-filter-caption">{request.employeeJobTitle}</div>
                        {request.replacementFullName ? (
                          <div className="tracking-filter-caption" style={{ marginTop: '0.2rem' }}>
                            Reemplaza a {request.replacementFullName}
                          </div>
                        ) : null}
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
                            onClick={() => setRequestToCancel(request)}
                          >
                            Anular
                          </button>
                        ) : (
                          <span className="tracking-filter-caption">Sin acción</span>
                        )}
                      </td>
                    </tr>
                  ))
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
