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

function canCurrentUserDecideRow(
  row: HrIncentiveApprovalQueueItem,
  currentUserId: string | undefined,
  isSuperAdmin: boolean
) {
  return isSuperAdmin || !row.approverUserId || row.approverUserId === currentUserId;
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

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <span style={{ opacity: 0.3, marginLeft: '0.3rem' }}>↕</span>;
    return <span style={{ marginLeft: '0.3rem' }}>{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  const approvalQueueQuery = useHrIncentiveApprovalQueue();

  const filteredQueue = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let result = (approvalQueueQuery.data ?? []).filter((item) => {
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

    if (sortColumn) {
      result.sort((a, b) => {
        let aVal: any = 0;
        let bVal: any = 0;
        
        switch (sortColumn) {
          case "folio":
            aVal = Number(a.folio);
            bVal = Number(b.folio);
            break;
          case "trabajador":
            aVal = a.employeeFullName.toLowerCase();
            bVal = b.employeeFullName.toLowerCase();
            break;
          case "incentivo":
            aVal = a.incentiveTypeName.toLowerCase();
            bVal = b.incentiveTypeName.toLowerCase();
            break;
          case "contrato":
            aVal = a.selectedAreaName.toLowerCase();
            bVal = b.selectedAreaName.toLowerCase();
            break;
          case "fecha":
            aVal = new Date(a.serviceDate).getTime();
            bVal = new Date(b.serviceDate).getTime();
            break;
          case "monto":
            aVal = a.calculatedAmount;
            bVal = b.calculatedAmount;
            break;
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [approvalQueueQuery.data, searchTerm, sortColumn, sortDirection]);

  useEffect(() => {
    setSelectedApprovalIds((current) =>
      current.filter((approvalId) =>
        (approvalQueueQuery.data ?? []).some((item) => item.approvalId === approvalId)
      )
    );
  }, [approvalQueueQuery.data]);

  useEffect(() => {
    setSelectedApprovalIds((current) =>
      current.filter((approvalId) =>
        (approvalQueueQuery.data ?? []).some(
          (item) =>
            item.approvalId === approvalId &&
            canCurrentUserDecideRow(item, user?.id, isSuperAdmin)
        )
      )
    );
  }, [approvalQueueQuery.data, isSuperAdmin, user?.id]);

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
  const selectableFilteredRows = useMemo(
    () => filteredQueue.filter((item) => canCurrentUserDecideRow(item, user?.id, isSuperAdmin)),
    [filteredQueue, isSuperAdmin, user?.id]
  );

  const allFilteredSelected =
    selectableFilteredRows.length > 0 &&
    selectableFilteredRows.every((item) => selectedApprovalIds.includes(item.approvalId));

  const selectedRows = useMemo(
    () =>
      (approvalQueueQuery.data ?? []).filter((item) =>
        selectedApprovalIds.includes(item.approvalId) &&
        canCurrentUserDecideRow(item, user?.id, isSuperAdmin)
      ),
    [approvalQueueQuery.data, isSuperAdmin, selectedApprovalIds, user?.id]
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
    const filteredIds = selectableFilteredRows.map((item) => item.approvalId);

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
                      disabled={selectableFilteredRows.length === 0}
                      aria-label="Seleccionar aprobaciones filtradas"
                      onChange={toggleSelectAllFiltered}
                    />
                  </th>

                  <th onClick={() => handleSort('folio')} style={{ cursor: 'pointer', userSelect: 'none' }}>Folio <SortIcon column="folio" /></th>
                  <th onClick={() => handleSort('trabajador')} style={{ cursor: 'pointer', userSelect: 'none' }}>Trabajador <SortIcon column="trabajador" /></th>
                  <th onClick={() => handleSort('incentivo')} style={{ cursor: 'pointer', userSelect: 'none' }}>Incentivo <SortIcon column="incentivo" /></th>
                  <th onClick={() => handleSort('contrato')} style={{ cursor: 'pointer', userSelect: 'none' }}>Contrato <SortIcon column="contrato" /></th>
                  <th onClick={() => handleSort('fecha')} style={{ cursor: 'pointer', userSelect: 'none' }}>Fecha servicio <SortIcon column="fecha" /></th>
                  <th onClick={() => handleSort('monto')} style={{ cursor: 'pointer', userSelect: 'none' }}>Monto <SortIcon column="monto" /></th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.length > 0 ? (
                  filteredQueue.map((row) => {
                    const isSelected = selectedApprovalIds.includes(row.approvalId);
                    const isActiveRow = selectedRequestId === row.requestId;
                    const canDecide = canCurrentUserDecideRow(row, user?.id, isSuperAdmin);
                    const warningClass = row.isOutOfDeadline 
                      ? "hr-incentives-row-danger" 
                      : row.isContractMismatch 
                        ? "hr-incentives-row-warning" 
                        : "";

                    return (
                      <Fragment key={row.approvalId}>
                        <tr
                          className={`${isActiveRow ? "tracking-row-selected" : ""} ${warningClass}`.trim()}
                          onClick={() => setSelectedRequestId(isActiveRow ? "" : row.requestId)}
                        >
                          <td className="tracking-selection-cell">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              aria-label="Seleccionar aprobación"
                              disabled={!canDecide}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => {
                                if (!canDecide) {
                                  return;
                                }
                                toggleApprovalSelection(row.approvalId);
                              }}
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
                                            declaredRestDay={detailQuery.data.request.declaredRestDay}
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
