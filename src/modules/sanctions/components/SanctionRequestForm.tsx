import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SelectField, TextField } from "../../../shared/ui";
import { useAuth } from "../../auth/context/AuthContext";
import {
  createHrSanctionRequest,
  uploadHrSanctionDocument
} from "../services/sanctionsApi";
import { invalidateHrSanctionQueries } from "../hooks/useSanctionsQueries";
import type {
  HrSanctionCause,
  HrSanctionDocumentType,
  HrSanctionMeasure,
  HrSanctionSetupCatalogs,
  HrSanctionWorker
} from "../types";
import { SanctionWorkerLookup } from "./SanctionWorkerLookup";

type SanctionRequestFormProps = {
  setupCatalogs: HrSanctionSetupCatalogs | undefined;
  isLoadingCatalogs: boolean;
};

const DOCUMENT_TYPE_OPTIONS: Array<{ value: HrSanctionDocumentType; label: string }> = [
  { value: "qav_report", label: "Informe QAV" },
  { value: "image", label: "Imagen" },
  { value: "video", label: "Video" },
  { value: "request_evidence", label: "Respaldo de solicitud" },
  { value: "other", label: "Otro respaldo" }
];

function toLocalDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function toIsoFromLocalDateTime(value: string) {
  return new Date(value).toISOString();
}

function getDefaultRegulatoryBasis(cause: HrSanctionCause | undefined) {
  return cause?.regulatoryBasis ?? "";
}

export function SanctionRequestForm({
  setupCatalogs,
  isLoadingCatalogs
}: SanctionRequestFormProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedWorker, setSelectedWorker] = useState<HrSanctionWorker | null>(null);
  const [causeId, setCauseId] = useState("");
  const [measureId, setMeasureId] = useState("");
  const [incidentAt, setIncidentAt] = useState(toLocalDateTimeValue());
  const [incidentPlace, setIncidentPlace] = useState("");
  const [equipmentNumber, setEquipmentNumber] = useState("");
  const [description, setDescription] = useState("");
  const [regulatoryBasis, setRegulatoryBasis] = useState("");
  const [documentType, setDocumentType] = useState<HrSanctionDocumentType>("qav_report");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const causes = setupCatalogs?.causes ?? [];
  const measures = setupCatalogs?.measures ?? [];
  const selectedCause = useMemo(
    () => causes.find((cause) => cause.id === causeId),
    [causeId, causes]
  );
  const selectedMeasure = useMemo(
    () => measures.find((measure) => measure.id === measureId),
    [measureId, measures]
  );
  const causeOptions = useMemo(
    () => causes.map((cause) => ({ value: cause.id, label: cause.name })),
    [causes]
  );
  const measureOptions = useMemo(
    () => measures.map((measure) => ({ value: measure.id, label: measure.name })),
    [measures]
  );
  const documentTypeOptions = useMemo(
    () => DOCUMENT_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    []
  );

  function handleCauseChange(nextCauseId: string) {
    const nextCause = causes.find((cause) => cause.id === nextCauseId);
    setCauseId(nextCauseId);
    setRegulatoryBasis(getDefaultRegulatoryBasis(nextCause));
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setErrorMessage(null);

    if (!user?.id) {
      setErrorMessage("No hay sesión activa para crear la solicitud.");
      return;
    }

    if (!selectedWorker) {
      setErrorMessage("Selecciona el trabajador asociado a la infracción.");
      return;
    }

    if (!causeId || !measureId) {
      setErrorMessage("Selecciona causal y medida solicitada.");
      return;
    }

    if (!incidentAt || !incidentPlace.trim()) {
      setErrorMessage("Indica fecha, hora y lugar de ocurrencia.");
      return;
    }

    if (!regulatoryBasis.trim()) {
      setErrorMessage("Indica el fundamento normativo aplicable.");
      return;
    }

    if (description.trim().length < 20) {
      setErrorMessage("La descripción debe contener al menos 20 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createHrSanctionRequest(
        {
          bukEmployeeId: selectedWorker.bukEmployeeId,
          causeId,
          measureId,
          incidentAt: toIsoFromLocalDateTime(incidentAt),
          incidentPlace,
          equipmentNumber: equipmentNumber.trim() || null,
          regulatoryBasis: regulatoryBasis.trim() || null,
          description
        },
        crypto.randomUUID()
      );

      for (const file of files) {
        await uploadHrSanctionDocument({
          requestId: result.requestId,
          file,
          documentType,
          userId: user.id
        });
      }

      await invalidateHrSanctionQueries(queryClient);
      setFeedback(
        `Solicitud creada con folio ${result.folio}${result.isOutOfDeadline ? " (fuera del plazo ideal de 48 horas)" : ""}.`
      );
      setSelectedWorker(null);
      setCauseId("");
      setMeasureId("");
      setIncidentAt(toLocalDateTimeValue());
      setIncidentPlace("");
      setEquipmentNumber("");
      setDescription("");
      setRegulatoryBasis("");
      setFiles([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible crear la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="sanctions-form" onSubmit={handleSubmit}>
      <div className="sanctions-section-heading">
        <div>
          <h2>Nueva solicitud</h2>
          <p>
            Ingresa la infracción con respaldo. RRLL revisará, emitirá la carta y cerrará
            el proceso con firma, DT o correo certificado según corresponda.
          </p>
        </div>
      </div>

      {feedback ? <div className="form-success-message">{feedback}</div> : null}
      {errorMessage ? <div className="form-error-message">{errorMessage}</div> : null}

      <SanctionWorkerLookup
        selectedWorker={selectedWorker}
        onSelect={setSelectedWorker}
        disabled={isSubmitting}
      />

      {selectedWorker ? (
        <div className="sanctions-worker-card" aria-live="polite">
          <span className="micro-label">Trabajador seleccionado</span>
          <strong>{selectedWorker.fullName}</strong>
          <div className="sanctions-worker-meta">
            <span className="tracking-status-pill">{selectedWorker.documentNumber}</span>
            <span>{selectedWorker.jobTitle || "Sin cargo"}</span>
            <span>{selectedWorker.areaName || selectedWorker.contractCode || "Sin contrato"}</span>
          </div>
        </div>
      ) : null}

      <div className="sanctions-form-grid">
        <SelectField
          id="sanction-cause"
          label="Causal"
          value={causeId}
          onChange={(event) => handleCauseChange(event.target.value)}
          options={causeOptions}
          placeholder={isLoadingCatalogs ? "Cargando causales" : "Seleccionar causal"}
          disabled={isLoadingCatalogs || isSubmitting}
        />

        <SelectField
          id="sanction-measure"
          label="Medida solicitada"
          value={measureId}
          onChange={(event) => setMeasureId(event.target.value)}
          options={measureOptions}
          placeholder={isLoadingCatalogs ? "Cargando medidas" : "Seleccionar medida"}
          disabled={isLoadingCatalogs || isSubmitting}
        />

        <TextField
          id="sanction-incident-at"
          label="Fecha y hora de ocurrencia"
          type="datetime-local"
          value={incidentAt}
          onChange={(event) => setIncidentAt(event.target.value)}
          disabled={isSubmitting}
        />

        <TextField
          id="sanction-incident-place"
          label="Lugar de la infracción"
          value={incidentPlace}
          onChange={(event) => setIncidentPlace(event.target.value)}
          placeholder="Ej: Ruta, faena, terminal o sector"
          disabled={isSubmitting}
        />

        <TextField
          id="sanction-equipment-number"
          label="N° de equipo"
          value={equipmentNumber}
          onChange={(event) => setEquipmentNumber(event.target.value)}
          placeholder="Ej: 1198"
          disabled={isSubmitting}
        />

        <SelectField
          id="sanction-document-type"
          label="Tipo de respaldo"
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value as HrSanctionDocumentType)}
          options={documentTypeOptions}
          disabled={isSubmitting}
          includePlaceholder={false}
        />
      </div>

      {selectedCause ? (
        <div className="sanctions-cause-context">
          <strong>{selectedCause.description}</strong>
          <span>{selectedCause.templateTitle ? `Formato base: ${selectedCause.templateTitle}` : "Formato de carta pendiente de confirmar."}</span>
        </div>
      ) : null}

      <label className="field-group sanctions-full-field" htmlFor="sanction-regulatory-basis">
        <span className="field-label">Fundamento normativo</span>
        <textarea
          id="sanction-regulatory-basis"
          className="text-field sanctions-textarea"
          value={regulatoryBasis}
          onChange={(event) => setRegulatoryBasis(event.target.value)}
          rows={3}
          disabled={isSubmitting}
          required
        />
      </label>

      <label className="field-group sanctions-full-field" htmlFor="sanction-description">
        <span className="field-label">Descripción detallada de la infracción</span>
        <textarea
          id="sanction-description"
          className="text-field sanctions-textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
          placeholder="Describe los hechos, hora, fuente de respaldo, impacto operacional y antecedentes relevantes."
          disabled={isSubmitting}
          required
        />
      </label>

      <label className="field-group sanctions-full-field" htmlFor="sanction-documents">
        <span className="field-label">Respaldos</span>
        <input
          id="sanction-documents"
          className="text-field sanctions-file-input"
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,video/mp4,video/quicktime"
          onChange={handleFilesChange}
          disabled={isSubmitting}
        />
        <small>PDF, JPG, PNG, MP4 o MOV. Se guardan en bucket privado.</small>
      </label>

      {selectedMeasure?.requiresDtFiling || selectedMeasure?.requiresCertifiedMailOnRefusal ? (
        <div className="sanctions-rule-alert">
          Esta medida puede requerir comprobante de Dirección del Trabajo y/o correo certificado si
          el trabajador se niega a firmar.
        </div>
      ) : null}

      <div className="sanctions-actions">
        <p className="form-status">
          La solicitud queda trazada con folio interno y revisión posterior de RRLL.
        </p>
        <button type="submit" className="soft-primary-button approval-button-approve" disabled={isSubmitting}>
          {isSubmitting ? "Creando..." : "Crear solicitud"}
        </button>
      </div>
    </form>
  );
}
