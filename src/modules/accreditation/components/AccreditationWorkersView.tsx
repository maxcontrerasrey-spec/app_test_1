import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SelectField, TextField } from "../../../shared/ui";
import {
  invalidateAccreditationQueries,
  useAccreditationSetupCatalogs,
  useAccreditationWorkers,
  useWorkerAccreditationProfile
} from "../hooks/useAccreditationQueries";
import {
  saveWorkerAccreditationDocument,
  uploadAccreditationDocumentToBuk
} from "../services/accreditationApi";
import type { AccreditationDocumentStatus } from "../types";

const statusOptions = [
  { value: "pending", label: "Pendiente" },
  { value: "submitted", label: "Cargado" },
  { value: "approved", label: "Aprobado" },
  { value: "rejected", label: "Rechazado" },
  { value: "expired", label: "Vencido" }
];

const accreditationStatusOptions = [
  { value: "pending", label: "Pendiente" },
  { value: "approved", label: "Acreditado" },
  { value: "expiring_soon", label: "Por vencer" },
  { value: "expired", label: "Vencido" }
];

export function AccreditationWorkersView() {
  const queryClient = useQueryClient();
  const setupQuery = useAccreditationSetupCatalogs();
  const [siteId, setSiteId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selectedWorkerKey, setSelectedWorkerKey] = useState<string | null>(null);
  const [selectedBukEmployeeId, setSelectedBukEmployeeId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    requirementId: "",
    status: "submitted" as AccreditationDocumentStatus,
    issueDate: "",
    expiryDate: "",
    reviewerNotes: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const normalizedSearch = search.trim().toLowerCase();
  const normalizedDigits = search.replace(/\D/g, "");
  const canQueryWorkers = Boolean(siteId) || normalizedSearch.length >= 2 || normalizedDigits.length >= 4;

  const workerQuery = useAccreditationWorkers({
    search,
    siteId: siteId || null,
    status: status || null,
    enabled: canQueryWorkers
  });

  const profileQuery = useWorkerAccreditationProfile({
    bukEmployeeId: selectedBukEmployeeId,
    siteId: selectedSiteId,
    enabled: Boolean(selectedBukEmployeeId && selectedSiteId)
  });

  const siteOptions = (setupQuery.data?.sites ?? [])
    .filter((site) => site.isActive)
    .map((site) => ({
      value: site.id,
      label: site.contractCode ? `${site.name} · ${site.contractCode}` : site.name
    }));

  const requirementOptions = useMemo(
    () =>
      (profileQuery.data?.documents ?? []).map((document) => ({
        value: document.requirementId,
        label: `${document.category} · ${document.requirementName}`
      })),
    [profileQuery.data?.documents]
  );

  useEffect(() => {
    if (profileQuery.data?.documents?.length && !documentForm.requirementId) {
      setDocumentForm((current) => ({
        ...current,
        requirementId: profileQuery.data?.documents[0]?.requirementId ?? ""
      }));
    }
  }, [documentForm.requirementId, profileQuery.data?.documents]);

  async function handleSaveDocument() {
    if (!selectedBukEmployeeId || !selectedSiteId || !documentForm.requirementId) {
      setFeedback("Selecciona una faena, trabajador y requisito antes de guardar.");
      return;
    }

    setIsSavingDocument(true);
    setFeedback(null);

    try {
      let bukDocumentId: string | null = null;
      let bukDocumentUrl: string | null = null;
      let bukDocumentName: string | null = null;
      let uploadPayload: Record<string, unknown> = {};

      if (selectedFile) {
        const uploadResult = await uploadAccreditationDocumentToBuk({
          employeeId: selectedBukEmployeeId,
          documentName: selectedFile.name,
          file: selectedFile
        });
        bukDocumentId = uploadResult.bukDocumentId;
        bukDocumentUrl = uploadResult.bukDocumentUrl;
        bukDocumentName = uploadResult.documentName;
        uploadPayload = uploadResult.payload;
      }

      await saveWorkerAccreditationDocument({
        bukEmployeeId: selectedBukEmployeeId,
        siteId: selectedSiteId,
        requirementId: documentForm.requirementId,
        status: documentForm.status,
        issueDate: documentForm.issueDate || null,
        expiryDate: documentForm.expiryDate || null,
        bukDocumentId,
        bukDocumentName,
        bukDocumentUrl,
        reviewerNotes: documentForm.reviewerNotes || null,
        metadata: {
          upload_source: selectedFile ? "buk_edge_function" : "manual_registry",
          buk_payload: uploadPayload
        }
      });

      await invalidateAccreditationQueries(queryClient);
      setSelectedFile(null);
      setDocumentForm((current) => ({
        ...current,
        status: "submitted",
        issueDate: "",
        expiryDate: "",
        reviewerNotes: ""
      }));
      setFeedback("Documento de acreditacion guardado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingDocument(false);
    }
  }

  return (
    <section className="tracking-panel accreditation-panel">
      <div className="field-grid accreditation-filter-grid">
        <SelectField
          id="accreditation-workers-site"
          label="Faena"
          value={siteId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            setSiteId(event.target.value);
            setSelectedBukEmployeeId("");
            setSelectedSiteId("");
            setSelectedWorkerKey(null);
          }}
          options={siteOptions}
          placeholder="Selecciona una faena"
        />
        <TextField
          id="accreditation-workers-search"
          label="Buscar trabajador"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nombre, RUT, contrato o cargo"
        />
        <SelectField
          id="accreditation-workers-status"
          label="Estado"
          value={status}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => setStatus(event.target.value)}
          options={accreditationStatusOptions}
          placeholder="Todos"
        />
      </div>

      {!siteId ? (
        <p className="tracking-filter-caption">
          Selecciona una faena para bootstrapear acreditaciones o busca un trabajador BUK por nombre o RUT.
        </p>
      ) : null}
      {feedback ? <p className="tracking-filter-caption">{feedback}</p> : null}
      {workerQuery.error ? (
        <p className="tracking-filter-caption" style={{ color: "var(--danger-700)" }}>
          {workerQuery.error.message}
        </p>
      ) : null}

      <div className="accreditation-workers-layout">
        <article className="info-card accreditation-list-card">
          <h3>Trabajadores</h3>
          <div className="accreditation-list-table">
            {(workerQuery.data ?? []).map((worker) => {
              const rowKey = `${worker.bukEmployeeId}:${worker.siteId ?? siteId}`;
              return (
                <button
                  type="button"
                  key={rowKey}
                  className={`accreditation-worker-row ${selectedWorkerKey === rowKey ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelectedWorkerKey(rowKey);
                    setSelectedBukEmployeeId(worker.bukEmployeeId);
                    setSelectedSiteId(worker.siteId ?? siteId);
                    setDocumentForm((current) => ({ ...current, requirementId: "" }));
                  }}
                >
                  <div>
                    <strong>{worker.fullName}</strong>
                    <p>
                      {worker.documentNumber ?? "Sin RUT"} · {worker.jobTitle ?? "Sin cargo"}
                    </p>
                    <small>{worker.areaName ?? worker.contractCode ?? worker.siteName ?? "Sin area"}</small>
                  </div>
                  <div className="accreditation-mini-stats">
                    <span className={`accreditation-status accreditation-status-${worker.accreditationStatus}`}>
                      {worker.accreditationStatus}
                    </span>
                    <span>{worker.approvedDocumentsTotal}/{worker.requiredDocumentsTotal} documentos</span>
                    <span>{worker.rosterPatternName ?? "Sin jornada activa"}</span>
                  </div>
                </button>
              );
            })}
            {canQueryWorkers && (workerQuery.data ?? []).length === 0 && !workerQuery.isLoading ? (
              <p className="tracking-filter-caption">No hay trabajadores para el filtro seleccionado.</p>
            ) : null}
          </div>
        </article>

        <article className="info-card accreditation-detail-card">
          <h3>Ficha de Acreditacion</h3>
          {profileQuery.isLoading ? <p className="tracking-filter-caption">Cargando detalle del trabajador...</p> : null}
          {!selectedBukEmployeeId ? (
            <p className="tracking-filter-caption">Selecciona un trabajador para revisar sus requisitos y documentos.</p>
          ) : null}

          {profileQuery.data ? (
            <>
              <div className="accreditation-detail-hero">
                <div>
                  <strong>{profileQuery.data.worker.fullName}</strong>
                  <p>
                    {profileQuery.data.worker.jobTitle ?? "Sin cargo"} · {profileQuery.data.worker.siteName}
                  </p>
                  <small>
                    {profileQuery.data.worker.documentNumber ?? "Sin RUT"} · {profileQuery.data.worker.contractCode ?? "Sin contrato"}
                  </small>
                </div>
                <div className="accreditation-mini-stats">
                  <span className={`accreditation-status accreditation-status-${profileQuery.data.worker.accreditationStatus}`}>
                    {profileQuery.data.worker.accreditationStatus}
                  </span>
                  <span>Vence: {profileQuery.data.worker.accreditationExpiryDate ?? "Sin fecha"}</span>
                </div>
              </div>

              <div className="accreditation-context-grid">
                <div>
                  <h4>Jornada vigente</h4>
                  <p>
                    {profileQuery.data.rosterContext
                      ? `${profileQuery.data.rosterContext.patternName} · desde ${profileQuery.data.rosterContext.startDate}`
                      : "Sin jornada activa en Jornadas y Turnos"}
                  </p>
                </div>
                <div>
                  <h4>Excepciones cercanas</h4>
                  <p>
                    {profileQuery.data.recentRosterExceptions.length > 0
                      ? profileQuery.data.recentRosterExceptions
                          .map((exception) => `${exception.exceptionType} ${exception.exceptionDate}`)
                          .join(" · ")
                      : "Sin excepciones recientes"}
                  </p>
                </div>
              </div>

              <div className="field-grid accreditation-document-form-grid">
                <SelectField
                  id="accreditation-document-requirement"
                  label="Requisito"
                  value={documentForm.requirementId}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setDocumentForm((current) => ({ ...current, requirementId: event.target.value }))
                  }
                  options={requirementOptions}
                  placeholder="Selecciona un requisito"
                />
                <SelectField
                  id="accreditation-document-status"
                  label="Estado documental"
                  value={documentForm.status}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setDocumentForm((current) => ({
                      ...current,
                      status: event.target.value as AccreditationDocumentStatus
                    }))
                  }
                  options={statusOptions}
                  placeholder="Selecciona estado"
                />
                <TextField
                  id="accreditation-document-issue-date"
                  label="Fecha emision"
                  value={documentForm.issueDate}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, issueDate: event.target.value }))}
                  type="date"
                />
                <TextField
                  id="accreditation-document-expiry-date"
                  label="Fecha vencimiento"
                  value={documentForm.expiryDate}
                  onChange={(event) => setDocumentForm((current) => ({ ...current, expiryDate: event.target.value }))}
                  type="date"
                />
                <TextField
                  id="accreditation-document-notes"
                  label="Observaciones"
                  value={documentForm.reviewerNotes}
                  onChange={(event) =>
                    setDocumentForm((current) => ({ ...current, reviewerNotes: event.target.value }))
                  }
                  placeholder="Comentario de revision o contexto"
                />
                <div className="field-group">
                  <label className="field-label" htmlFor="accreditation-document-file">
                    Archivo para BUK
                  </label>
                  <input
                    id="accreditation-document-file"
                    className="text-field"
                    type="file"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="approval-chip-row">
                <button
                  type="button"
                  className="approval-chip tracking-kpi-card-active"
                  onClick={() => void handleSaveDocument()}
                  disabled={isSavingDocument}
                >
                  {isSavingDocument ? "Guardando..." : "Guardar documento"}
                </button>
              </div>

              <div className="accreditation-document-checklist">
                <h4>Checklist documental</h4>
                {(profileQuery.data.documents ?? []).map((document) => (
                  <div key={document.requirementId} className="accreditation-document-row">
                    <div>
                      <strong>{document.requirementName}</strong>
                      <p>{document.category}</p>
                      <small>
                        {document.bukDocumentName ?? "Sin archivo BUK"} · vence {document.expiryDate ?? "N/A"}
                      </small>
                    </div>
                    <div className="accreditation-mini-stats">
                      <span className={`accreditation-status accreditation-status-${document.status}`}>
                        {document.status}
                      </span>
                      <span>{document.blocksAccreditation ? "Bloqueante" : "No bloqueante"}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="accreditation-audit-log">
                <h4>Bitacora de auditoria</h4>
                {(profileQuery.data.auditLog ?? []).slice(0, 12).map((entry) => (
                  <div key={entry.id} className="accreditation-audit-row">
                    <strong>{entry.eventSummary}</strong>
                    <p>{entry.actorName ?? "Sistema"} · {entry.createdAt}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </article>
      </div>
    </section>
  );
}
