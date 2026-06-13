import { Fragment, useEffect, useMemo, useState } from "react";
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
import { IncentiveActionModal } from "./IncentiveActionModal";
import { IncentiveOperationalFlags } from "./IncentiveOperationalFlags";

type DecisionModalState =
  | { mode: "closed" }
  | {
      mode: "single";
      approvalIds: number[];
      decision: "approved" | "rejected";
      description: string;
    }
  | {
      mode: "bulk";
      approvalIds: number[];
      decision: "approved" | "rejected";
      description: string;
    };

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
  const [decisionModal, setDecisionModal] = useState<DecisionModalState>({ mode: "closed" });

  const approvalQueueQuery = useHrIncentiveApprovalQueue();

  const filteredQueue = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (approvalQueueQuery.data ?? []).filter((item) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
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
    if (selectedRequestId && !filteredQueue.some((item) => item.requestId === selectedRequestId)) {
      setSelectedRequestId("");
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

  const handleSingleDecision = (row: HrIncentiveApprovalQueueItem, decision: "approved" | "rejected") => {
    setFeedbackMessage("");
    setFeedbackError("");
    setDecisionModal({
      mode: "single",
      approvalIds: [row.approvalId],
      decision,
      description:
        decision === "approved"
          ? `Confirma la aprobación del incentivo folio ${row.folio} para ${row.employeeFullName}.`
          : `Registra el motivo de rechazo del incentivo folio ${row.folio} para ${row.employeeFullName}.`
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
    setDecisionModal({
      mode: "bulk",
      approvalIds: selectedRows.map((item) => item.approvalId),
      decision,
      description:
        decision === "approved"
          ? `Confirma la aprobación masiva de ${selectedRows.length} incentivo(s) seleccionados.`
          : `Registra el motivo de rechazo para ${selectedRows.length} incentivo(s) seleccionados.`
    });
  };

  const isMutating = decisionMutation.isPending || bulkDecisionMutation.isPending;

  const handleDecisionConfirm = async (comment: string) => {
    if (decisionModal.mode === "closed") {
      return;
    }

    const normalizedComment = comment.trim();
    const payloadComment = normalizedComment ? normalizedComment : null;

    if (decisionModal.mode === "single") {
      decisionMutation.mutate({
        approvalId: decisionModal.approvalIds[0],
        decision: decisionModal.decision,
        comment: payloadComment
      });
      setDecisionModal({ mode: "closed" });
      return;
    }

    bulkDecisionMutation.mutate({
      approvalIds: decisionModal.approvalIds,
      decision: decisionModal.decision,
      comment: payloadComment
    });
    setDecisionModal({ mode: "closed" });
  };

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
                  <th>Trabajador</th>
                  <th>Incentivo</th>
                  <th>Contrato</th>
                  <th>Fecha servicio</th>
                  <th>Monto</th>
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
                    const isWarningRow = row.isContractMismatch || row.isOutOfDeadline;

                    return (
                      <Fragment key={row.approvalId}>
                        <tr
                          className={`${isActiveRow ? "tracking-row-selected" : ""} ${isWarningRow ? "hr-incentives-row-warning" : ""}`.trim()}
                          onClick={() => setSelectedRequestId(isActiveRow ? "" : row.requestId)}
                        >
                          <td className="tracking-selection-cell">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              aria-label="Seleccionar aprobación"
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleApprovalSelection(row.approvalId)}
                            />
                          </td>
                          <td>
                            <span className="case-code-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                              <span className={`expand-chevron ${isActiveRow ? "expand-chevron-open" : ""}`} style={{ display: 'inline-block', fontSize: '1.2rem', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isActiveRow ? 'rotate(90deg)' : 'none' }}>▸</span>
                              {String(row.folio).padStart(5, '0')}
                            </span>
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
                          </td>
                          <td>{formatRequestDate(row.serviceDate)}</td>
                          <td>{formatCurrencyValue(row.calculatedAmount)}</td>
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
                                        <div className="expanded-detail-field-full" style={{ gridColumn: '1 / -1' }}>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="expanded-detail-section">
                                      <h4>DETALLES INCENTIVO</h4>
                                      <div className="expanded-detail-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="expanded-detail-field-full" style={{ gridColumn: '1 / -1' }}>
                                          <small>Tipo incentivo</small>
                                          <strong>{detailQuery.data.request.incentiveTypeName}</strong>
                                        </div>
                                        <div>
                                          <small>Fecha servicio</small>
                                          <strong>{formatRequestDate(detailQuery.data.request.serviceDate)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
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
                                          <strong>{getRequestStatusLabel(detailQuery.data.request.status)}</strong>
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
                ) : (
                  <tr>
                    <td className="tracking-empty-state" colSpan={8}>
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


      </div>

      {filteredQueue.length > 0 ? (
        <p className="tracking-filter-caption">
          {selectedRows.length} aprobación(es) seleccionadas · {filteredQueue.length} visibles en la bandeja
        </p>
      ) : null}

      <IncentiveActionModal
        isOpen={decisionModal.mode !== "closed"}
        title={
          decisionModal.mode === "closed"
            ? ""
            : decisionModal.decision === "approved"
              ? "Confirmar aprobación"
              : "Registrar rechazo"
        }
        description={decisionModal.mode === "closed" ? "" : decisionModal.description}
        confirmLabel={
          decisionModal.mode === "closed"
            ? "Confirmar"
            : decisionModal.decision === "approved"
              ? "Confirmar aprobación"
              : "Confirmar rechazo"
        }
        isSubmitting={isMutating}
        requireComment={decisionModal.mode !== "closed" && decisionModal.decision === "rejected"}
        commentLabel={
          decisionModal.mode !== "closed" && decisionModal.decision === "rejected"
            ? "Motivo de rechazo"
            : "Comentario opcional"
        }
        commentPlaceholder={
          decisionModal.mode !== "closed" && decisionModal.decision === "rejected"
            ? "Explica por qué se rechaza esta solicitud."
            : "Agrega un comentario si necesitas dejar contexto."
        }
        onClose={() => {
          if (!isMutating) {
            setDecisionModal({ mode: "closed" });
          }
        }}
        onConfirm={handleDecisionConfirm}
      />
    </section>
  );
}
