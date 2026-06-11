import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/context/AuthContext";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
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
import type { InternalMobilityEligibleWorker } from "../types";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
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
  const { displayName, jobTitle, email, user } = useAuth();
  const [selectedWorker, setSelectedWorker] = useState<InternalMobilityEligibleWorker | null>(null);
  const [destinationJobTitle, setDestinationJobTitle] = useState("");
  const [destinationContractId, setDestinationContractId] = useState("");
  const [destinationShiftId, setDestinationShiftId] = useState("");
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
  const destinationOptions = setupCatalogs?.destinations ?? [];
  const jobTitleOptions = setupCatalogs?.bukJobTitles ?? [];
  const shiftOptions = setupCatalogs?.shiftCatalog ?? [];

  const selectedDestination =
    destinationOptions.find((destination) => String(destination.contractId) === destinationContractId) ??
    null;

  const requiresTermination =
    workerContext && selectedDestination && workerContext.currentCompanyName
      ? workerContext.currentCompanyName !== selectedDestination.companyName
      : false;

  useEffect(() => {
    if (!selectedWorker) {
      setDestinationJobTitle("");
      setDestinationContractId("");
      setDestinationShiftId("");
      setMotive("");
      setRequesterSigned(false);
      return;
    }

    setSubmitError(null);
    setSubmitMessage(null);
    setDestinationJobTitle("");
    setDestinationContractId("");
    setDestinationShiftId("");
    setMotive("");
    setRequesterSigned(false);
  }, [selectedWorker?.bukEmployeeId]);

  useEffect(() => {
    if (!workerContext) {
      return;
    }

    setDestinationJobTitle((current) => current || workerContext.currentJobTitle);
    setDestinationContractId((current) =>
      current || (workerContext.matchedDestinationContractId ? String(workerContext.matchedDestinationContractId) : "")
    );
    setDestinationShiftId((current) => {
      if (current) {
        return current;
      }

      if (!workerContext.currentShiftName) {
        return "";
      }

      const matchedShift = shiftOptions.find(
        (shift) =>
          shift.name.trim().toLowerCase() === workerContext.currentShiftName?.trim().toLowerCase() ||
          shift.code.trim().toLowerCase() === workerContext.currentShiftName?.trim().toLowerCase()
      );

      return matchedShift ? String(matchedShift.id) : "";
    });
  }, [shiftOptions, workerContext]);

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
    Boolean(destinationJobTitle.trim()) &&
    Boolean(destinationContractId) &&
    Boolean(destinationShiftId) &&
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
        destinationContractId: Number(destinationContractId),
        destinationJobTitle: destinationJobTitle.trim(),
        destinationShiftId: Number(destinationShiftId),
        motive: motive.trim(),
        requesterSigned
      });

      setSubmitMessage(
        `Solicitud ${result.folio} guardada. Quedó enviada a Gerente de Area como primera etapa de aprobación.`
      );
      setSelectedRequestId(result.requestId);
      setSelectedWorker(null);
      setDestinationJobTitle("");
      setDestinationContractId("");
      setDestinationShiftId("");
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

      <div className="hiring-layout-grid">
        <div className="hiring-main-column">
          <div className="form-card">
            <div className="requester-grid">
              <TextField id="mobility-requester-name" label="Nombre solicitante" value={displayName} readOnly />
              <TextField id="mobility-requester-job" label="Cargo solicitante" value={jobTitle} readOnly />
            </div>

            <h3 style={{ marginTop: "1.5rem", marginBottom: "0.5rem", fontSize: "1.05rem", color: "var(--text-primary)" }}>Trabajador a movilizar</h3>
            <div className="contract-grid">
              <InternalMobilityWorkerLookup
                id="mobility-worker-search"
                label="Trabajador"
                placeholder="Buscar trabajador activo..."
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

            {workerContextQuery.error ? (
              <div className="form-status form-status-error" style={{ marginTop: "1rem" }}>
                {workerContextQuery.error.message}
              </div>
            ) : null}

            <h3 style={{ marginTop: "1.5rem", marginBottom: "0.5rem", fontSize: "1.05rem", color: "var(--text-primary)" }}>Condiciones actuales</h3>
            <div className="contract-grid">
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
            </div>
            <div className="field-group" style={{ marginTop: "1rem" }}>
              <TextField
                id="mobility-current-company"
                label="Empresa actual"
                value={selectedWorker ? workerContext?.currentCompanyName ?? "No resuelta" : ""}
                readOnly
              />
            </div>
            <div className="field-group" style={{ marginTop: "1rem" }}>
              <TextField
                id="mobility-current-shift"
                label="Turno actual"
                value={selectedWorker ? workerContext?.currentShiftName ?? "No resuelto" : ""}
                readOnly
              />
            </div>

            <h3 style={{ marginTop: "1.5rem", marginBottom: "0.5rem", fontSize: "1.05rem", color: "var(--text-primary)" }}>Condiciones destino</h3>
            <div className="contract-grid">
              <SelectField
                id="mobility-destination-job"
                label="Cargo nuevo"
                value={destinationJobTitle}
                onChange={(event) => setDestinationJobTitle(event.target.value)}
                disabled={!selectedWorker || setupCatalogsQuery.isLoading}
                options={jobTitleOptions.map((item) => ({ value: item, label: item }))}
                placeholder="Selecciona el cargo destino"
              />
              <SelectField
                id="mobility-destination-area"
                label="Contrato / Área nuevo"
                value={destinationContractId}
                onChange={(event) => setDestinationContractId(event.target.value)}
                disabled={!selectedWorker || setupCatalogsQuery.isLoading}
                options={destinationOptions.map((item) => ({
                  value: String(item.contractId),
                  label: item.label
                }))}
                placeholder="Selecciona el destino"
              />
            </div>
            <div className="field-group" style={{ marginTop: "1rem" }}>
              <SelectField
                id="mobility-destination-shift"
                label="Turno nuevo"
                value={destinationShiftId}
                onChange={(event) => setDestinationShiftId(event.target.value)}
                disabled={!selectedWorker || setupCatalogsQuery.isLoading}
                options={shiftOptions.map((item) => ({
                  value: String(item.id),
                  label: item.name
                }))}
                placeholder="Selecciona el turno destino"
              />
            </div>
            <div className="field-group" style={{ marginTop: "1rem" }}>
              <TextField
                id="mobility-destination-company"
                label="Empresa destino"
                value={selectedDestination?.companyName ?? ""}
                readOnly
              />
            </div>

            {workerContext && selectedDestination && requiresTermination ? (
              <div className="mobility-company-alert">
                <strong>Atención:</strong> Esta movilidad implica un cambio de empresa. Será necesario
                gestionar un finiquito especial antes de materializar el traslado.
              </div>
            ) : null}

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
        </div>

        <aside className="hiring-sidebar">
          <div className="form-card hiring-summary-card">
            <h3>Resumen de movilidad</h3>
            <div className="summary-grid">
              <div>
                <small>Trabajador</small>
                <strong>{workerContext?.fullName ?? "Pendiente"}</strong>
              </div>
              <div>
                <small>Empresa actual</small>
                <strong>{workerContext?.currentCompanyName ?? "No resuelta"}</strong>
              </div>
              <div>
                <small>Empresa destino</small>
                <strong>{selectedDestination?.companyName ?? "Pendiente"}</strong>
              </div>
              <div>
                <small>Requiere finiquito</small>
                <strong>
                  {workerContext && selectedDestination && workerContext.currentCompanyName
                    ? (requiresTermination ? "Sí" : "No")
                    : "Pendiente"}
                </strong>
              </div>
              <div>
                <small>Cargo actual</small>
                <strong>{workerContext?.currentJobTitle ?? "Pendiente"}</strong>
              </div>
              <div>
                <small>Cargo destino</small>
                <strong>{destinationJobTitle || "Pendiente"}</strong>
              </div>
              <div>
                <small>Área actual</small>
                <strong>{workerContext?.currentAreaName ?? "Pendiente"}</strong>
              </div>
              <div>
                <small>Área destino</small>
                <strong>{selectedDestination?.areaName ?? "Pendiente"}</strong>
              </div>
              <div>
                <small>Turno actual</small>
                <strong>{workerContext?.currentShiftName ?? "No resuelto"}</strong>
              </div>
              <div>
                <small>Turno destino</small>
                <strong>
                  {shiftOptions.find((item) => String(item.id) === destinationShiftId)?.name || "Pendiente"}
                </strong>
              </div>
            </div>
            <p className="helper-copy">
              El cálculo de empresa y finiquito se validará nuevamente en backend al guardar.
            </p>
          </div>
        </aside>
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
                              {request.currentCompanyName ?? "No resuelta"}
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
                      <strong>{requestDetailQuery.data.request.currentCompanyName ?? "No resuelta"}</strong>
                    </div>
                    <div>
                      <small>Turno actual</small>
                      <strong>{requestDetailQuery.data.request.currentShiftName ?? "No resuelto"}</strong>
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
                      <strong>{requestDetailQuery.data.request.requesterEmail ?? email}</strong>
                    </div>
                    <div>
                      <small>Enviada</small>
                      <strong>{formatDateTime(requestDetailQuery.data.request.submittedAt)}</strong>
                    </div>
                    <div>
                      <small>Aprobada</small>
                      <strong>{formatDateTime(requestDetailQuery.data.request.approvedAt)}</strong>
                    </div>
                    <div>
                      <small>Rechazada</small>
                      <strong>{formatDateTime(requestDetailQuery.data.request.rejectedAt)}</strong>
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
                        <span>Creada: {formatDateTime(approval.createdAt)}</span>
                        <span>Resuelta: {formatDateTime(approval.decidedAt)}</span>
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
                          <span>{formatDateTime(event.createdAt)}</span>
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
