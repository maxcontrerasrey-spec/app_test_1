import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TextField } from "../../../shared/ui";
import { formatCurrencyValue, formatRequestDate } from "../../../shared/lib/format";
import { formatRut } from "../../../shared/lib/rut";
import { useAuth } from "../../auth/context/AuthContext";
import {
  bulkDecideHrIncentiveApprovals,
  decideHrIncentiveApproval
} from "../services/incentivesApi";
import {
  invalidateHrIncentiveQueries,
  useHrIncentiveApprovalQueue,
  useHrIncentiveRequestDetail
} from "../hooks/useIncentivesQueries";
import type { HrIncentiveApprovalQueueItem } from "../types";

function formatDateTimeValue(value: string | null) {
  if (!value) {
    return "No disponible";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return date.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRequestStatusLabel(status: string) {
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

function getApprovalStepLabel(stepCode: HrIncentiveApprovalQueueItem["stepCode"]) {
  return stepCode === "contract_admin" ? "Administrador de contrato" : "Gerente de area";
}

export function IncentiveApprovalsView() {
  const queryClient = useQueryClient();
  const { user, isSuperAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<number[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackError, setFeedbackError] = useState("");

  const approvalQueueQuery = useHrIncentiveApprovalQueue();

  const filteredQueue = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (approvalQueueQuery.data ?? []).filter((item) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        item.folio,
        item.employeeFullName,
        item.employeeDocumentNumber,
        item.employeeJobTitle,
        item.employeeUnionName ?? "",
        item.selectedContractCode,
        item.selectedAreaName,
        item.incentiveTypeName,
        item.requesterName,
        item.approverName,
        getApprovalStepLabel(item.stepCode)
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [approvalQueueQuery.data, searchTerm]);

  useEffect(() => {
    setSelectedApprovalIds((current) =>
      current.filter((approvalId) =>
        (approvalQueueQuery.data ?? []).some((item) => item.approvalId === approvalId)
      )
    );
  }, [approvalQueueQuery.data]);

  useEffect(() => {
    if (!selectedRequestId && filteredQueue[0]?.requestId) {
      setSelectedRequestId(filteredQueue[0].requestId);
      return;
    }

    if (selectedRequestId && !filteredQueue.some((item) => item.requestId === selectedRequestId)) {
      setSelectedRequestId(filteredQueue[0]?.requestId ?? "");
    }
  }, [filteredQueue, selectedRequestId]);

  const selectedRow =
    filteredQueue.find((item) => item.requestId === selectedRequestId) ??
    approvalQueueQuery.data?.find((item) => item.requestId === selectedRequestId) ??
    null;

  const detailQuery = useHrIncentiveRequestDetail(selectedRequestId, Boolean(selectedRequestId));

  const allFilteredSelected =
    filteredQueue.length > 0 &&
    filteredQueue.every((item) => selectedApprovalIds.includes(item.approvalId));

  const selectedRows = useMemo(
    () =>
      (approvalQueueQuery.data ?? []).filter((item) =>
        selectedApprovalIds.includes(item.approvalId)
      ),
    [approvalQueueQuery.data, selectedApprovalIds]
  );

  const decisionMutation = useMutation({
    mutationFn: (params: {
      approvalId: number;
      decision: "approved" | "rejected";
      comment?: string | null;
    }) => decideHrIncentiveApproval(params),
    onSuccess: async (_, variables) => {
      setFeedbackError("");
      setFeedbackMessage(
        variables.decision === "approved"
          ? "Aprobación registrada correctamente."
          : "Rechazo registrado correctamente."
      );
      setSelectedApprovalIds((current) =>
        current.filter((approvalId) => approvalId !== variables.approvalId)
      );
      await invalidateHrIncentiveQueries(queryClient);
    },
    onError: (error: Error) => {
      setFeedbackMessage("");
      setFeedbackError(error.message);
    }
  });

  const bulkDecisionMutation = useMutation({
    mutationFn: (params: {
      approvalIds: number[];
      decision: "approved" | "rejected";
      comment?: string | null;
    }) => bulkDecideHrIncentiveApprovals(params),
    onSuccess: async (results) => {
      const successCount = results.filter((item) => item.success).length;
      const failedItems = results.filter((item) => !item.success);

      setFeedbackError(
        failedItems.length > 0
          ? failedItems
              .map((item) => `#${item.approvalId}: ${item.error ?? "Error desconocido"}`)
              .join(" | ")
          : ""
      );
      setFeedbackMessage(
        failedItems.length > 0
          ? `${successCount} aprobación(es) procesadas y ${failedItems.length} con error.`
          : `${successCount} aprobación(es) procesadas correctamente.`
      );
      setSelectedApprovalIds([]);
      await invalidateHrIncentiveQueries(queryClient);
    },
    onError: (error: Error) => {
      setFeedbackMessage("");
      setFeedbackError(error.message);
    }
  });

  const toggleApprovalSelection = (approvalId: number) => {
    setSelectedApprovalIds((current) =>
      current.includes(approvalId)
        ? current.filter((item) => item !== approvalId)
        : [...current, approvalId]
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredQueue.map((item) => item.approvalId);

    setSelectedApprovalIds((current) => {
      if (filteredIds.every((approvalId) => current.includes(approvalId))) {
        return current.filter((approvalId) => !filteredIds.includes(approvalId));
      }

      return Array.from(new Set([...current, ...filteredIds]));
    });
  };

  const resolveRejectComment = (isBulk: boolean) => {
    const value = window.prompt(
      isBulk
        ? "Ingresa el motivo de rechazo para las aprobaciones seleccionadas."
        : "Ingresa el motivo de rechazo."
    );

    if (value === null) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      setFeedbackMessage("");
      setFeedbackError("El rechazo requiere un comentario.");
      return null;
    }

    return normalized;
  };

  const handleSingleDecision = (row: HrIncentiveApprovalQueueItem, decision: "approved" | "rejected") => {
    setFeedbackMessage("");
    setFeedbackError("");

    const comment = decision === "rejected" ? resolveRejectComment(false) : null;

    if (decision === "rejected" && !comment) {
      return;
    }

    decisionMutation.mutate({
      approvalId: row.approvalId,
      decision,
      comment
    });
  };

  const handleBulkDecision = (decision: "approved" | "rejected") => {
    if (selectedRows.length === 0) {
      setFeedbackMessage("");
      setFeedbackError("Selecciona al menos una aprobación.");
      return;
    }

    setFeedbackMessage("");
    setFeedbackError("");

    const comment = decision === "rejected" ? resolveRejectComment(true) : null;

    if (decision === "rejected" && !comment) {
      return;
    }

    bulkDecisionMutation.mutate({
      approvalIds: selectedRows.map((item) => item.approvalId),
      decision,
      comment
    });
  };

  const isMutating = decisionMutation.isPending || bulkDecisionMutation.isPending;

  return (
    <section className="info-card">
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Aprobaciones de incentivos</h3>
          <span className="tracking-filter-caption">
            Flujo de doble aprobación: Administrador de contrato y luego Gerente de area.
          </span>
        </div>
        <div className="tracking-filters tracking-filters-inline">
          <TextField
            id="incentive-approval-search"
            label="Buscar aprobaciones"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Folio, trabajador, contrato, incentivo o aprobador"
            className="tracking-search-field"
          />
          <button
            type="button"
            className="soft-primary-button approval-button-approve"
            disabled={isMutating || selectedRows.length === 0}
            onClick={() => handleBulkDecision("approved")}
          >
            Aprobar seleccionados ({selectedRows.length})
          </button>
          <button
            type="button"
            className="soft-primary-button approval-button-reject"
            disabled={isMutating || selectedRows.length === 0}
            onClick={() => handleBulkDecision("rejected")}
          >
            Rechazar seleccionados
          </button>
        </div>
      </div>

      {feedbackMessage ? <p className="form-status">{feedbackMessage}</p> : null}
      {feedbackError ? <p className="form-status form-status-error">{feedbackError}</p> : null}
      {approvalQueueQuery.isError ? (
        <p className="form-status form-status-error">{approvalQueueQuery.error.message}</p>
      ) : null}

      <div className="hr-incentives-approvals-layout">
        <div className="tracking-table-wrap">
          <div className="tracking-table-scroll tracking-table-scroll-wide">
            <table className="tracking-table">
              <thead>
                <tr>
                  <th className="tracking-selection-cell">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      aria-label="Seleccionar aprobaciones filtradas"
                      onChange={toggleSelectAllFiltered}
                    />
                  </th>
                  <th>Folio</th>
                  <th>Etapa</th>
                  <th>Trabajador</th>
                  <th>Incentivo</th>
                  <th>Contrato</th>
                  <th>Fecha servicio</th>
                  <th>Monto</th>
                  <th>Solicitó</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.length > 0 ? (
                  filteredQueue.map((row) => {
                    const isSelected = selectedApprovalIds.includes(row.approvalId);
                    const isActiveRow = selectedRequestId === row.requestId;
                    const canDecide =
                      isSuperAdmin || !row.approverUserId || row.approverUserId === user?.id;

                    return (
                      <tr
                        key={row.approvalId}
                        className={isActiveRow ? "tracking-row-selected" : ""}
                        onClick={() => setSelectedRequestId(row.requestId)}
                      >
                        <td className="tracking-selection-cell">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            aria-label={`Seleccionar aprobación ${row.folio}`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleApprovalSelection(row.approvalId)}
                          />
                        </td>
                        <td>
                          <strong>{row.folio}</strong>
                          <div className="tracking-filter-caption">
                            {formatDateTimeValue(row.createdAt)}
                          </div>
                        </td>
                        <td>
                          <strong>{row.stepName}</strong>
                          <div className="tracking-filter-caption">
                            {getRequestStatusLabel(row.stepCode === "contract_admin" ? "P" : "E")}
                          </div>
                        </td>
                        <td>
                          <strong>{row.employeeFullName}</strong>
                          <div className="tracking-filter-caption">
                            {formatRut(row.employeeDocumentNumber)}
                          </div>
                          <div className="tracking-filter-caption">{row.employeeJobTitle}</div>
                        </td>
                        <td>{row.incentiveTypeName}</td>
                        <td>
                          <strong>{row.selectedAreaName}</strong>
                          <div className="tracking-filter-caption">{row.selectedContractCode}</div>
                        </td>
                        <td>{formatRequestDate(row.serviceDate)}</td>
                        <td>{formatCurrencyValue(row.calculatedAmount)}</td>
                        <td>
                          <strong>{row.requesterName}</strong>
                          <div className="tracking-filter-caption">{row.approverName}</div>
                        </td>
                        <td>
                          {canDecide ? (
                            <div className="hr-incentives-inline-actions">
                              <button
                                type="button"
                                className="soft-primary-button approval-button-approve hr-incentives-inline-button"
                                disabled={isMutating}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleSingleDecision(row, "approved");
                                }}
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                className="soft-primary-button approval-button-reject hr-incentives-inline-button"
                                disabled={isMutating}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleSingleDecision(row, "rejected");
                                }}
                              >
                                Rechazar
                              </button>
                            </div>
                          ) : (
                            <span className="tracking-filter-caption">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="tracking-empty-state" colSpan={10}>
                      {approvalQueueQuery.isLoading
                        ? "Cargando aprobaciones..."
                        : "No hay aprobaciones pendientes para el filtro actual."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <section className="info-card hr-incentives-approval-detail">
          <div className="tracking-toolbar">
            <div className="tracking-toolbar-copy">
              <h3>Detalle de aprobación</h3>
              <span className="tracking-filter-caption">
                Resumen extendido de la solicitud y trazabilidad del flujo.
              </span>
            </div>
          </div>

          {!selectedRow ? (
            <p className="tracking-empty-state">Selecciona una aprobación para ver el detalle.</p>
          ) : null}

          {selectedRow && detailQuery.isLoading ? (
            <p className="tracking-empty-state">Cargando detalle del incentivo...</p>
          ) : null}

          {selectedRow && detailQuery.isError ? (
            <p className="form-status form-status-error">{detailQuery.error.message}</p>
          ) : null}

          {detailQuery.data ? (
            <>
              <div className="approval-detail-grid">
                <div className="approval-detail-item approval-detail-item-regular">
                  <small>Folio</small>
                  <strong>{detailQuery.data.request.folio}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-wide">
                  <small>Estado</small>
                  <strong>{getRequestStatusLabel(detailQuery.data.request.status)}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-xwide">
                  <small>Trabajador</small>
                  <strong>{detailQuery.data.request.employeeFullName}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-compact">
                  <small>RUT</small>
                  <strong>{formatRut(detailQuery.data.request.employeeDocumentNumber)}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-wide">
                  <small>Cargo BUK</small>
                  <strong>{detailQuery.data.request.employeeJobTitle}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-regular">
                  <small>Sindicato</small>
                  <strong>{detailQuery.data.request.employeeUnionName ?? "No informado"}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-wide">
                  <small>Contrato destino</small>
                  <strong>{detailQuery.data.request.selectedAreaName}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-compact">
                  <small>Código contrato</small>
                  <strong>{detailQuery.data.request.selectedContractCode}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-regular">
                  <small>Tipo incentivo</small>
                  <strong>{detailQuery.data.request.incentiveTypeName}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-regular">
                  <small>Fecha servicio</small>
                  <strong>{formatRequestDate(detailQuery.data.request.serviceDate)}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-regular">
                  <small>Monto</small>
                  <strong>{formatCurrencyValue(detailQuery.data.request.calculatedAmount)}</strong>
                </div>
                <div className="approval-detail-item approval-detail-item-regular">
                  <small>Solicitó</small>
                  <strong>{detailQuery.data.request.requesterName}</strong>
                </div>
              </div>

              <div className="approval-detail-note">
                <small>Motivo operacional</small>
                <strong>{detailQuery.data.request.motive ?? "Sin motivo registrado"}</strong>
              </div>

              {detailQuery.data.request.description ? (
                <div className="approval-detail-note">
                  <small>Observaciones</small>
                  <strong>{detailQuery.data.request.description}</strong>
                </div>
              ) : null}

              {detailQuery.data.request.replacementFullName ? (
                <div className="approval-detail-note">
                  <small>Trabajador reemplazado</small>
                  <strong>
                    {detailQuery.data.request.replacementFullName}
                    {detailQuery.data.request.replacementDocumentNumber
                      ? ` · ${formatRut(detailQuery.data.request.replacementDocumentNumber)}`
                      : ""}
                  </strong>
                </div>
              ) : null}

              <div className="hr-incentives-approval-history">
                <div>
                  <h4>Cadena de aprobación</h4>
                  <div className="hr-incentives-approval-list">
                    {detailQuery.data.approvals.map((approval) => (
                      <div key={approval.id} className="hr-incentives-approval-list-item">
                        <strong>{approval.stepName}</strong>
                        <span>
                          {approval.approverName ?? "No asignado"} · {approval.status}
                        </span>
                        <span>{formatDateTimeValue(approval.decidedAt ?? approval.createdAt)}</span>
                        {approval.decisionComment ? <span>{approval.decisionComment}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4>Historial</h4>
                  <div className="hr-incentives-approval-list">
                    {detailQuery.data.history.slice(0, 8).map((item) => (
                      <div key={item.id} className="hr-incentives-approval-list-item">
                        <strong>{item.actionType}</strong>
                        <span>{item.actorName ?? "Usuario no disponible"}</span>
                        <span>{formatDateTimeValue(item.createdAt)}</span>
                        {item.comment ? <span>{item.comment}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {filteredQueue.length > 0 ? (
        <p className="tracking-filter-caption">
          {selectedRows.length} aprobación(es) seleccionadas · {filteredQueue.length} visibles en la bandeja
        </p>
      ) : null}
    </section>
  );
}
