import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { formatDateTimeLabel } from "../../../shared/lib/format";
import { formatRut } from "../../../shared/lib/rut";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { PageShell, TextField } from "../../../shared/ui";
import { SearchableSelectField as SelectField } from "../../../shared/ui/forms/SearchableSelectField";
import { InternalMobilityWorkerLookup } from "../components/InternalMobilityWorkerLookup";
import {
  invalidateInternalMobilityQueries,
  useInternalMobilityRequestDetail,
  useInternalMobilityRequests,
  useInternalMobilitySetupCatalogs,
  useInternalMobilityWorkerContext
} from "../hooks/useInternalMobilityQueries";
import { createInternalMobilityRequest } from "../services/internalMobilityApi";
import type { InternalMobilityEligibleFolio, InternalMobilityEligibleWorker } from "../types";

const UNRESOLVED_COMPANY_LABEL = "No resuelta";
const UNRESOLVED_SHIFT_LABEL = "No resuelto";
const PENDING_LABEL = "Pendiente";

function resolveWorkerCompanyLabel(value: string | null | undefined) {
  return value ?? UNRESOLVED_COMPANY_LABEL;
}

function resolveWorkerShiftLabel(value: string | null | undefined) {
  return value ?? UNRESOLVED_SHIFT_LABEL;
}

function resolveFolioLabel(folio: InternalMobilityEligibleFolio | null) {
  if (!folio) {
    return PENDING_LABEL;
  }

  return folio.folio ?? folio.caseCode;
}

function toStatusLabel(value: string | null | undefined) {
  if (value === "approved") return "Aprobada";
  if (value === "rejected") return "Rechazada";
  if (value === "closed") return "Cerrada";
  if (value === "pending_contracts_control") return "Pendiente control contratos";
  if (value === "pending_area_manager") return "Pendiente gerente de area";
  return "Pendiente";
}

function toAuditLabel(value: string | null | undefined) {
  if (value === "submitted") return "Solicitud enviada";
  if (value === "approval_created") return "Aprobación creada";
  if (value === "approved") return "Aprobación registrada";
  if (value === "rejected") return "Solicitud rechazada";
  return value || "Evento";
}

export function InternalMobilityPage() {
  const queryClient = useQueryClient();
  const { displayName, jobTitle, user } = useAuth();
  const [selectedWorker, setSelectedWorker] = useState<InternalMobilityEligibleWorker | null>(null);
  const [selectedFolioId, setSelectedFolioId] = useState("");
  const [motive, setMotive] = useState("");
  const [requesterSigned, setRequesterSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string>("");

  const setupCatalogsQuery = useInternalMobilitySetupCatalogs();
  const workerContextQuery = useInternalMobilityWorkerContext(
    selectedWorker?.bukEmployeeId ?? "",
    Boolean(selectedWorker?.bukEmployeeId)
  );
  const requestsQuery = useInternalMobilityRequests();
  const requestDetailQuery = useInternalMobilityRequestDetail(
    selectedRequestId,
    Boolean(selectedRequestId)
  );

  const mobilityRequestsKey = queryKeys.internalMobility.requests();
  const selectedRequestDetailKey = selectedRequestId
    ? queryKeys.internalMobility.requestDetail(selectedRequestId)
    : null;

  useRealtimeQueryInvalidation({
    channelName: `internal-mobility:${user?.id ?? "anonymous"}`,
    enabled: Boolean(user?.id),
    subscriptions: [
      { table: "internal_mobility_requests" },
      { table: "internal_mobility_request_approvals" }
    ],
    queryKeys: selectedRequestDetailKey
      ? [mobilityRequestsKey, selectedRequestDetailKey]
      : [mobilityRequestsKey]
  });

  const setupCatalogs = setupCatalogsQuery.data;
  const workerContext = workerContextQuery.data?.worker ?? null;
  const eligibleFolios = setupCatalogs?.eligibleFolios ?? [];

  const selectedFolio =
    eligibleFolios.find((folio) => folio.recruitmentCaseId === selectedFolioId) ??
    null;

  const requiresTermination =
    workerContext && selectedFolio && workerContext.currentCompanyName
      ? workerContext.currentCompanyName !== selectedFolio.companyName
      : false;

  const requiresRoleChange =
    workerContext && selectedFolio && workerContext.currentJobTitle
      ? workerContext.currentJobTitle !== selectedFolio.jobPositionName
      : false;

  const requiresShiftChange =
    workerContext && selectedFolio && workerContext.currentShiftName
      ? workerContext.currentShiftName !== selectedFolio.shiftName
      : false;

  const changedElements: string[] = [];
  if (requiresTermination) changedElements.push("empresa");
  if (requiresRoleChange) changedElements.push("cargo");
  if (requiresShiftChange) changedElements.push("turno");

  useEffect(() => {
    if (!selectedWorker) {
      setSelectedFolioId("");
      setMotive("");
      setRequesterSigned(false);
      return;
    }

    setSubmitError(null);
    setSubmitMessage(null);
    setSelectedFolioId("");
    setMotive("");
    setRequesterSigned(false);
  }, [selectedWorker?.bukEmployeeId]);

  const filteredRequests = useMemo(() => {
    const rows = requestsQuery.data ?? [];
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.folio,
        row.employeeFullName,
        row.employeeDocumentNumber,
        row.requesterName,
        row.currentAreaName,
        row.destinationAreaName,
        row.currentCompanyName,
        row.destinationCompanyName
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch))
    );
  }, [requestsQuery.data, searchTerm]);

  const isSubmitEnabled =
    Boolean(selectedWorker?.bukEmployeeId) &&
    Boolean(workerContext) &&
    Boolean(selectedFolioId) &&
    Boolean(motive.trim()) &&
    requesterSigned &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!isSubmitEnabled || !selectedWorker) {
      setSubmitError("Completa los campos obligatorios y confirma la firma del solicitante.");
      setSubmitMessage(null);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    try {
      const result = await createInternalMobilityRequest({
        bukEmployeeId: selectedWorker.bukEmployeeId,
        recruitmentCaseId: selectedFolioId,
        motive: motive.trim(),
        requesterSigned
      });

      setSubmitMessage(
        `Solicitud ${result.folio} guardada. Quedó enviada a Gerente de Area como primera etapa de aprobación.`
      );
      setSelectedRequestId(result.requestId);
      setSelectedWorker(null);
      setSelectedFolioId("");
      setMotive("");
      setRequesterSigned(false);

      await invalidateInternalMobilityQueries(queryClient, result.requestId);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.home(user?.id ?? "anonymous")
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible registrar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell useFormShell>
      <div className="minimal-page-header">
        <h1>Movilidad Interna</h1>
      </div>

      <div className="mobility-layout-single">
          <div className="form-card mobility-form-card">
            <div className="requester-grid">
              <TextField id="mobility-requester-name" label="Nombre solicitante" value={displayName} readOnly />
              <TextField id="mobility-requester-job" label="Cargo solicitante" value={jobTitle} readOnly />
            </div>

            <hr className="mobility-divider" />
            <h3 className="mobility-section-title">Trabajador a movilizar</h3>
            <div className="contract-grid">
              <InternalMobilityWorkerLookup
                id="mobility-worker-search"
                label="Trabajador"
                placeholder="Busca por nombre, RUT, contrato o cargo BUK. Solo se muestran trabajadores activos."
                selectedWorker={selectedWorker}
                onSelect={setSelectedWorker}
                disabled={setupCatalogsQuery.isLoading}
              />
              <TextField
                id="mobility-worker-rut"
                label="RUT"
                value={workerContext ? formatRut(workerContext.documentNumber) : ""}
                readOnly
              />
            </div>
            <div className="field-group mobility-block-spaced">
              <SelectField
                id="mobility-target-folio"
                label="Folio destino"
                value={selectedFolioId}
                onChange={(event) => setSelectedFolioId(event.target.value)}
                disabled={setupCatalogsQuery.isLoading || eligibleFolios.length === 0}
                options={eligibleFolios.map((folio) => ({
                  value: folio.recruitmentCaseId,
                  label: folio.label
                }))}
                placeholder="Selecciona un folio abierto con cupos disponibles"
              />
            </div>

            {workerContextQuery.error ? (
              <div className="form-status form-status-error mobility-block-spaced">
                {workerContextQuery.error.message}
              </div>
            ) : null}
            {!setupCatalogsQuery.isLoading && !setupCatalogsQuery.error && eligibleFolios.length === 0 ? (
              <div className="form-status form-status-error mobility-block-spaced">
                No hay folios abiertos con cupos disponibles para generar una movilidad interna.
              </div>
            ) : null}

            <hr className="mobility-divider" />
            <h3 className="mobility-section-title">Condiciones actuales</h3>
            <div className="mobility-compact-grid">
              <TextField
                id="mobility-current-job"
                label="Cargo actual"
                value={workerContext?.currentJobTitle ?? ""}
                readOnly
              />
              <TextField
                id="mobility-current-area"
                label="Contrato / Área actual"
                value={workerContext?.currentAreaName ?? ""}
                readOnly
              />
              <TextField
                id="mobility-current-company"
                label="Empresa actual"
                value={selectedWorker ? resolveWorkerCompanyLabel(workerContext?.currentCompanyName) : ""}
                readOnly
              />
              <TextField
                id="mobility-current-shift"
                label="Turno actual"
                value={selectedWorker ? resolveWorkerShiftLabel(workerContext?.currentShiftName) : ""}
                readOnly
              />
            </div>


            <hr className="mobility-divider" />
            <h3 className="mobility-section-title">Condiciones destino</h3>
            <div className="mobility-compact-grid">
              <TextField
                id="mobility-destination-folio"
                label="Folio seleccionado"
                value={resolveFolioLabel(selectedFolio)}
                readOnly
              />
              <TextField
                id="mobility-destination-job"
                label="Cargo destino"
                value={selectedFolio?.jobPositionName ?? ""}
                readOnly
              />
              <TextField
                id="mobility-destination-area"
                label="Contrato / Área destino"
                value={selectedFolio?.contractName ?? ""}
                readOnly
              />
              <TextField
                id="mobility-destination-shift"
                label="Turno destino"
                value={selectedFolio?.shiftName ?? ""}
                readOnly
              />
              <TextField
                id="mobility-destination-company"
                label="Empresa destino"
                value={selectedFolio?.companyName ?? ""}
                readOnly
              />
              <TextField
                id="mobility-destination-vacancies"
                label="Cupos disponibles"
                value={
                  selectedFolio
                    ? `${selectedFolio.availableVacancies} de ${selectedFolio.requestedVacancies}`
                    : ""
                }
                readOnly
              />
            </div>


            {workerContext && selectedFolio && changedElements.length > 0 ? (
              <div className="mobility-company-alert">
                <strong>Atención:</strong> Esta movilidad implica cambios en:{" "}
                <strong>{changedElements.join(", ")}</strong>.{" "}
                {requiresTermination && "Será necesario gestionar un finiquito especial por el cambio de empresa antes de materializar el traslado. "}
                {(requiresRoleChange || requiresShiftChange) &&
                  "Se deberá generar un anexo de contrato por las nuevas condiciones."}
              </div>
            ) : null}

            <hr className="mobility-divider" />
            <div className="field-group">
              <label className="field-label" htmlFor="mobility-motive">
                Motivo del cambio
              </label>
              <textarea
                id="mobility-motive"
                className="task-decision-textarea mobility-textarea"
                value={motive}
                disabled={!selectedWorker || isSubmitting}
                placeholder="Describe la justificación operativa del traslado."
                onChange={(event) => setMotive(event.target.value)}
              />
            </div>

            <div className="signature-panel">
              <label className="signature-checkbox" htmlFor="mobility-requester-signed">
                <input
                  id="mobility-requester-signed"
                  className="signature-checkbox-input"
                  type="checkbox"
                  checked={requesterSigned}
                  disabled={!selectedWorker || isSubmitting}
                  onChange={(event) => setRequesterSigned(event.target.checked)}
                />
                <span>Confirmo la solicitud y envío a aprobación.</span>
              </label>
            </div>

            {submitError ? <div className="form-status form-status-error">{submitError}</div> : null}
            {submitMessage ? <div className="form-status form-status-success">{submitMessage}</div> : null}

            <div className="action-row">
              <button
                type="button"
                className="soft-primary-button"
                disabled={!isSubmitEnabled}
                onClick={() => {
                  void handleSubmit();
                }}
              >
                {isSubmitting ? "Enviando..." : "Enviar por proceso"}
              </button>
            </div>
          </div>
          <div className="form-card mobility-summary-card">
            <h3>Resumen de movilidad</h3>
            <div className="summary-grid summary-grid-horizontal">
              <div>
                <small>Trabajador</small>
                <strong>{workerContext?.fullName ?? PENDING_LABEL}</strong>
              </div>
              <div>
                <small>Empresa actual</small>
                <strong>{resolveWorkerCompanyLabel(workerContext?.currentCompanyName)}</strong>
              </div>
              <div>
                <small>Empresa destino</small>
                <strong>{selectedFolio?.companyName ?? PENDING_LABEL}</strong>
              </div>
              
              <div>
                <small>Folio destino</small>
                <strong>{resolveFolioLabel(selectedFolio)}</strong>
              </div>
              <div>
                <small>Cargo actual</small>
                <strong>{workerContext?.currentJobTitle ?? PENDING_LABEL}</strong>
              </div>
              <div>
                <small>Cargo destino</small>
                <strong>{selectedFolio?.jobPositionName ?? PENDING_LABEL}</strong>
              </div>

              <div>
                <small>Cupos disponibles</small>
                <strong>
                  {selectedFolio
                    ? `${selectedFolio.availableVacancies} de ${selectedFolio.requestedVacancies}`
                    : PENDING_LABEL}
                </strong>
              </div>
              <div>
                <small>Área actual</small>
                <strong>{workerContext?.currentAreaName ? workerContext.currentAreaName.replace(/\s*\([\d:]+\)\s*$/, "") : PENDING_LABEL}</strong>
              </div>
              <div>
                <small>Área destino</small>
                <strong>{selectedFolio?.contractName ?? PENDING_LABEL}</strong>
              </div>

              <div>
                <small>Requiere finiquito</small>
                <strong>{workerContext && selectedFolio && workerContext.currentCompanyName ? (requiresTermination ? "Sí" : "No") : PENDING_LABEL}</strong>
              </div>
              <div>
                <small>Turno actual</small>
                <strong>{resolveWorkerShiftLabel(workerContext?.currentShiftName)}</strong>
              </div>
              <div>
                <small>Turno destino</small>
                <strong>{selectedFolio?.shiftName ?? PENDING_LABEL}</strong>
              </div>
            </div>
            <p className="helper-copy">
              El folio destino define cargo, contrato, turno y cupo disponible. Backend vuelve a validar todo al guardar.
            </p>
          </div>
      </div>

      <div className="form-card mobility-requests-card">
        <div className="mobility-requests-toolbar">
          <div>
            <h3>Solicitudes visibles</h3>
            <p className="helper-copy">
              Historial de solicitudes según tu rol, gerencia o solicitudes propias.
            </p>
          </div>
          <TextField
            id="mobility-requests-search"
            label="Buscar solicitud"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Folio, trabajador, RUT, área o empresa"
          />
        </div>

        <div className="tracking-table-wrap tracking-table-wrap-full">
          <div className="tracking-table-scroll tracking-table-scroll-wide">
            <table className="tracking-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Estado</th>
                  <th>Trabajador</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Requiere finiquito</th>
                </tr>
              </thead>
              <tbody>
                {requestsQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="tracking-empty-state">
                      Cargando solicitudes de movilidad...
                    </td>
                  </tr>
                ) : null}

                {!requestsQuery.isLoading && requestsQuery.error ? (
                  <tr>
                    <td colSpan={6} className="tracking-empty-state">
                      {requestsQuery.error.message}
                    </td>
                  </tr>
                ) : null}

                {!requestsQuery.isLoading &&
                !requestsQuery.error &&
                filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="tracking-empty-state">
                      No hay solicitudes para el filtro actual.
                    </td>
                  </tr>
                ) : null}

                {!requestsQuery.isLoading && !requestsQuery.error
                  ? filteredRequests.map((request) => {
                      const isSelected = selectedRequestId === request.requestId;

                      return (
                        <tr
                          key={request.requestId}
                          className={`tracking-table-row-clickable ${isSelected ? "tracking-table-row-expanded" : ""}`}
                          onClick={() => setSelectedRequestId(request.requestId)}
                        >
                          <td>{request.folio}</td>
                          <td>
                            <span className="tracking-status-pill">{toStatusLabel(request.status)}</span>
                          </td>
                          <td>
                            <strong>{request.employeeFullName}</strong>
                            <br />
                            <span>{request.employeeDocumentNumber ? formatRut(request.employeeDocumentNumber) : "—"}</span>
                          </td>
                          <td>
                            <span className="dashboard-contract-inline">
                              {request.currentAreaName || "—"}
                              <br />
                              {resolveWorkerCompanyLabel(request.currentCompanyName)}
                              <br />
                              {request.currentShiftName ?? "Sin turno"}
                            </span>
                          </td>
                          <td>
                            <span className="dashboard-contract-inline">
                              {request.destinationAreaName}
                              <br />
                              {request.destinationCompanyName}
                              <br />
                              {request.destinationShiftName ?? "Sin turno"}
                            </span>
                          </td>
                          <td>{request.requiresTermination ? "Sí" : "No"}</td>
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedRequestId ? (
        <div className="form-card mobility-detail-card">
          {requestDetailQuery.isLoading ? <p className="helper-copy">Cargando detalle de la solicitud...</p> : null}
          {requestDetailQuery.error ? (
            <p className="form-status form-status-error">{requestDetailQuery.error.message}</p>
          ) : null}

          {requestDetailQuery.data ? (
            <>
              <div className="mobility-detail-header">
                <div>
                  <h3>{requestDetailQuery.data.request.folio}</h3>
                  <p className="helper-copy">
                    {toStatusLabel(requestDetailQuery.data.request.status)} · {requestDetailQuery.data.request.employeeFullName}
                  </p>
                </div>
                <span className="tracking-status-pill">
                  {requestDetailQuery.data.request.requiresTermination ? "Requiere finiquito" : "Sin finiquito"}
                </span>
              </div>

              <div className="expanded-case-detail-grid">
                <div className="expanded-detail-section">
                  <h4>Trabajador actual</h4>
                  <div className="expanded-detail-fields">
                    <div>
                      <small>Nombre</small>
                      <strong>{requestDetailQuery.data.request.employeeFullName}</strong>
                    </div>
                    <div>
                      <small>RUT</small>
                      <strong>
                        {requestDetailQuery.data.request.employeeDocumentNumber
                          ? formatRut(requestDetailQuery.data.request.employeeDocumentNumber)
                          : "—"}
                      </strong>
                    </div>
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
                      <strong>{resolveWorkerCompanyLabel(requestDetailQuery.data.request.currentCompanyName)}</strong>
                    </div>
                    <div>
                      <small>Turno actual</small>
                      <strong>{resolveWorkerShiftLabel(requestDetailQuery.data.request.currentShiftName)}</strong>
                    </div>
                  </div>
                </div>

                <div className="expanded-detail-section">
                  <h4>Destino solicitado</h4>
                  <div className="expanded-detail-fields">
                    <div>
                      <small>Cargo destino</small>
                      <strong>{requestDetailQuery.data.request.destinationJobTitle}</strong>
                    </div>
                    <div>
                      <small>Área destino</small>
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
                      <strong>{requestDetailQuery.data.request.destinationCompanyName}</strong>
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
                  <h4>Trazabilidad</h4>
                  <div className="expanded-detail-fields">
                    <div>
                      <small>Solicitó</small>
                      <strong>{requestDetailQuery.data.request.requesterName}</strong>
                    </div>
                    <div>
                      <small>Correo</small>
                      <strong>{requestDetailQuery.data.request.requesterEmail ?? "—"}</strong>
                    </div>
                    <div>
                      <small>Enviada</small>
                      <strong>{formatDateTimeLabel(requestDetailQuery.data.request.submittedAt, "—")}</strong>
                    </div>
                    <div>
                      <small>Aprobada</small>
                      <strong>{formatDateTimeLabel(requestDetailQuery.data.request.approvedAt, "—")}</strong>
                    </div>
                    <div>
                      <small>Rechazada</small>
                      <strong>{formatDateTimeLabel(requestDetailQuery.data.request.rejectedAt, "—")}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="expanded-detail-section">
                <h4>Motivo del cambio</h4>
                <p className="mobility-detail-copy">{requestDetailQuery.data.request.motive}</p>
              </div>

              <div className="mobility-history-grid">
                <div className="expanded-detail-section">
                  <h4>Historial de aprobaciones</h4>
                  <div className="mobility-history-list">
                    {requestDetailQuery.data.approvals.map((approval) => (
                      <div key={approval.id} className="mobility-history-item">
                        <div className="mobility-history-item-head">
                          <strong>{approval.stepName}</strong>
                          <span className="tracking-status-pill">{toStatusLabel(approval.status)}</span>
                        </div>
                        <span>{approval.approverName ?? "Sin aprobador asignado"}</span>
                        <span>Creada: {formatDateTimeLabel(approval.createdAt, "—")}</span>
                        <span>Resuelta: {formatDateTimeLabel(approval.decidedAt, "—")}</span>
                        {approval.decisionComment ? <p>{approval.decisionComment}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="expanded-detail-section">
                  <h4>Auditoría</h4>
                  <div className="mobility-history-list">
                    {requestDetailQuery.data.auditLog.map((event) => (
                      <div key={event.id} className="mobility-history-item">
                        <div className="mobility-history-item-head">
                          <strong>{toAuditLabel(event.actionType)}</strong>
                          <span>{formatDateTimeLabel(event.createdAt, "—")}</span>
                        </div>
                        <span>{event.actorName ?? event.actorUserId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
