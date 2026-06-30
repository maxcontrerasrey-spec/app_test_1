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
  useHrIncentiveApprovalQueuePage,
  useHrIncentiveRequestDetail
} from "../hooks/useIncentivesQueries";
import type {
  HrIncentiveApprovalQueueItem,
  HrIncentiveApprovalQueueSortColumn
} from "../types";
import { IncentiveActionModal } from "./IncentiveActionModal";
import { IncentiveOperationalFlags } from "./IncentiveOperationalFlags";

const APPROVALS_PAGE_SIZE = 50;

const SORTABLE_HEADERS: ReadonlyArray<{
  column: HrIncentiveApprovalQueueSortColumn;
  label: string;
}> = [
  { column: "folio", label: "Folio" },
  { column: "trabajador", label: "Trabajador" },
  { column: "incentivo", label: "Incentivo" },
  { column: "contrato", label: "Contrato" },
  { column: "fecha", label: "Fecha servicio" },
  { column: "monto", label: "Monto" }
];

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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<number[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [decisionModal, setDecisionModal] = useState<DecisionModalState>({ mode: "closed" });

  const [sortColumn, setSortColumn] = useState<HrIncentiveApprovalQueueSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchTerm, sortColumn, sortDirection]);

  const handleSort = (column: HrIncentiveApprovalQueueSortColumn) => {
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

  const renderSortIcon = (column: HrIncentiveApprovalQueueSortColumn) => (
    <span
      aria-hidden="true"
      className={`tracking-sort-icon ${sortColumn !== column ? "tracking-sort-icon-idle" : ""}`}
    >
      {sortColumn === column ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const approvalQueueQuery = useHrIncentiveApprovalQueuePage({
    search: debouncedSearchTerm || undefined,
    limit: APPROVALS_PAGE_SIZE,
    offset: page * APPROVALS_PAGE_SIZE,
    sortColumn,
    sortDirection
  });

  const visibleQueue = approvalQueueQuery.data?.items ?? [];
  const totalCount = approvalQueueQuery.data?.totalCount ?? 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / APPROVALS_PAGE_SIZE) : 0;

  useEffect(() => {
    if (page > 0 && totalPages > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedApprovalIds((current) =>
      current.filter((approvalId) =>
        visibleQueue.some((item) => item.approvalId === approvalId)
      )
    );
  }, [visibleQueue]);

  useEffect(() => {
    setSelectedApprovalIds((current) =>
      current.filter((approvalId) =>
        visibleQueue.some(
          (item) =>
            item.approvalId === approvalId &&
            canCurrentUserDecideRow(item, user?.id, isSuperAdmin)
        )
      )
    );
  }, [visibleQueue, isSuperAdmin, user?.id]);

  useEffect(() => {
    if (selectedRequestId && !visibleQueue.some((item) => item.requestId === selectedRequestId)) {
      setSelectedRequestId("");
    }
  }, [selectedRequestId, visibleQueue]);

  const detailQuery = useHrIncentiveRequestDetail(selectedRequestId, Boolean(selectedRequestId));
  const selectableFilteredRows = useMemo(
    () => visibleQueue.filter((item) => canCurrentUserDecideRow(item, user?.id, isSuperAdmin)),
    [isSuperAdmin, user?.id, visibleQueue]
  );

  const allFilteredSelected =
    selectableFilteredRows.length > 0 &&
    selectableFilteredRows.every((item) => selectedApprovalIds.includes(item.approvalId));

  const selectedRows = useMemo(
    () =>
      visibleQueue.filter(
        (item) =>
          selectedApprovalIds.includes(item.approvalId) &&
          canCurrentUserDecideRow(item, user?.id, isSuperAdmin)
      ),
    [isSuperAdmin, selectedApprovalIds, user?.id, visibleQueue]
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

                  {SORTABLE_HEADERS.map(({ column, label }) => (
                    <th
                      key={column}
                      className="tracking-sortable-header"
                      onClick={() => handleSort(column)}
                    >
                      {label}
                      {renderSortIcon(column)}
                    </th>
                  ))}
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibleQueue.length > 0 ? (
                  visibleQueue.map((row) => {
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
                            <span className="case-code-toggle tracking-case-code-toggle">
                              <span className={`expand-chevron tracking-expand-chevron ${isActiveRow ? "expand-chevron-open" : ""}`}>▸</span>
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
                                <div className="expanded-detail-section-full tracking-expanded-feedback">
                                  <p className="tracking-empty-state">Cargando detalle del incentivo...</p>
                                </div>
                              ) : null}

                              {detailQuery.isError ? (
                                <div className="expanded-detail-section-full tracking-expanded-feedback">
                                  <p className="form-status form-status-error">{detailQuery.error.message}</p>
                                </div>
                              ) : null}

                              {detailQuery.data ? (
                                <>
                                  <div className="expanded-case-detail-grid">
                                    <div className="expanded-detail-section">
                                      <h4>TRABAJADOR Y CONTRATO</h4>
                                      <div className="expanded-detail-fields tracking-expanded-fields-two-columns">
                                        <div className="expanded-detail-field-full">
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
                                      </div>
                                    </div>

                                    <div className="expanded-detail-section">
                                      <h4>DETALLES INCENTIVO</h4>
                                      <div className="expanded-detail-fields tracking-expanded-fields-incentive">
                                        <div className="expanded-detail-field-full">
                                          <small>Tipo incentivo</small>
                                          <strong>{detailQuery.data.request.incentiveTypeName}</strong>
                                        </div>
                                        <div>
                                          <small>Fecha servicio</small>
                                          <strong>{formatRequestDate(detailQuery.data.request.serviceDate)}</strong>
                                        </div>
                                        <div className="tracking-operational-flags-cell">
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
                                        <div>
                                          <small>Origen del monto</small>
                                          <strong>
                                            {detailQuery.data.request.amountSource === "manual" ? "Manual" : "Regla"}
                                          </strong>
                                        </div>
                                        {detailQuery.data.request.manualAmount !== null ? (
                                          <div>
                                            <small>Monto ingresado</small>
                                            <strong>
                                              {formatCurrencyValue(detailQuery.data.request.manualAmount)}
                                            </strong>
                                          </div>
                                        ) : null}
                                        {detailQuery.data.request.replacementFullName ? (
                                          <div className="expanded-detail-field-full">
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
                                      <div className="expanded-detail-fields tracking-expanded-fields-single-column">
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
            Página {page + 1} de {totalPages} · {totalCount} pendientes
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
          {selectedRows.length} aprobación(es) seleccionadas · {totalCount} coincidencia(s) en la bandeja
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
