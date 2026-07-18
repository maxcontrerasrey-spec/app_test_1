import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PageShell, SelectField, StandardWorkerLookupField, TextField } from "../../../shared/ui";
import { useAuth } from "../../auth/context/AuthContext";
import { importWithRetry } from "../../../shared/lib/lazyWithRetry";
import { formatDateForDisplay } from "../../../shared/lib/date";
import {
  fetchCompetencyModelWarnings,
  fetchCompetencyCatalogs,
  fetchCompetencyDashboard
} from "../services/competencyCoreApi";
import { useCompetencyWorkerSearch } from "../hooks/useCompetencyQueries";
import type {
  CompetencyCatalogs,
  CompetencyDashboardPayload,
  CompetencyDashboardRow,
  CompetencyInstructor,
  CompetencyModelWarning,
  CompetencyWorker
} from "../types";
import "../styles/competencies.css";

type FormState = {
  instructorId: string;
  modelRows: CompetencyModelRow[];
  trainingDate: string;
  trainingStartTime: string;
  trainingEndTime: string;
  theoreticalScore: string;
  practicalScore: string;
  declarationAccepted: boolean;
};

type CompetencyModelRow = {
  id: string;
  brandId: string;
  typeId: string;
  modelId: string;
};

type LastGeneration = {
  folio: string;
  documentUrl?: string | null;
  bukUploadStatus: string;
  bukDocumentUrl?: string | null;
};

type CompetencyTab = "new" | "summary";

function createModelRow(): CompetencyModelRow {
  return {
    id: crypto.randomUUID(),
    brandId: "",
    typeId: "",
    modelId: ""
  };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function initialFormState(): FormState {
  return {
    instructorId: "",
    modelRows: [createModelRow()],
    trainingDate: todayDate(),
    trainingStartTime: "",
    trainingEndTime: "",
    theoreticalScore: "100",
    practicalScore: "100",
    declarationAccepted: false
  };
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    "": "No informado",
    draft: "Borrador",
    submitted: "Emitida",
    completed: "Completada",
    generated: "Generado",
    uploaded_to_buk: "Cargado BUK",
    buk_upload_failed: "BUK pendiente",
    enabled: "Habilitado",
    expired: "Vencido",
    pending: "Pendiente",
    success: "Correcto",
    failed: "Fallido",
    not_started: "No iniciado"
  };
  return labels[value] ?? value;
}

function formatDateLabel(value: string | null | undefined) {
  return value ? formatDateForDisplay(value.slice(0, 10)) || "Sin fecha" : "Sin fecha";
}

function getCertificateValidity(row: CompetencyDashboardRow) {
  if (row.certificateStatus === "revoked" || row.certificateStatus === "annulled") {
    return { label: "Revocado", tone: "danger" };
  }

  if (row.certificateStatus === "replaced") {
    return { label: "Reemplazado", tone: "warning" };
  }

  if (!row.validUntil) {
    return { label: "Sin vigencia", tone: "neutral" };
  }

  const [year, month, day] = row.validUntil.slice(0, 10).split("-").map(Number);
  const validUntilDate = new Date(year, month - 1, day);
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.ceil((validUntilDate.getTime() - todayDate.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return { label: "Vencido", tone: "danger" };
  }

  if (diffDays <= 30) {
    return { label: `Vence en ${diffDays} dias`, tone: "warning" };
  }

  return { label: "Vigente", tone: "success" };
}

function buildErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function canManageInstructors(isSuperAdmin: boolean, catalogs: CompetencyCatalogs | null) {
  return isSuperAdmin || catalogs?.permissions.canAdmin === true;
}

const ALLOWED_EVALUATION_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_EVALUATION_SIZE_BYTES = 15 * 1024 * 1024;

function validateEvaluationEvidence(file: File | null) {
  if (!file) {
    throw new Error("Debes cargar el examen teorico/evaluacion respaldada antes de generar el certificado.");
  }

  if (!ALLOWED_EVALUATION_MIME_TYPES.has(file.type)) {
    throw new Error("Solo se permiten examenes o evaluaciones en PDF, JPG o PNG.");
  }

  if (file.size <= 0 || file.size > MAX_EVALUATION_SIZE_BYTES) {
    throw new Error("El archivo de examen/evaluacion debe pesar entre 1 byte y 15 MB.");
  }
}

function CompetencyCertificateSummaryPanel({
  dashboard,
  isLoading,
  errorMessage,
  onRetry
}: {
  dashboard: CompetencyDashboardPayload | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  const summary = dashboard?.summary;
  const recent = dashboard?.recent ?? [];

  return (
    <section className="competency-summary-panel" aria-label="Resumen de certificados generados">
      <div className="competency-section-heading">
        <h2>Resumen de Certificados</h2>
        <span>Generacion y vigencia</span>
      </div>

      {errorMessage ? (
        <div className="competency-alert">
          {errorMessage}
          <button type="button" className="competency-inline-action" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : null}

      <div className="competency-summary-grid" aria-busy={isLoading}>
        <article>
          <span>Total certificados</span>
          <strong>{isLoading ? "-" : summary?.total ?? 0}</strong>
          <small>Registros creados</small>
        </article>
        <article>
          <span>Generados</span>
          <strong>{isLoading ? "-" : summary?.generated ?? summary?.enabled ?? 0}</strong>
          <small>PDF emitido o cargado</small>
        </article>
        <article>
          <span>Por vencer</span>
          <strong>{isLoading ? "-" : summary?.expiring30 ?? 0}</strong>
          <small>Proximos 30 dias</small>
        </article>
        <article>
          <span>Vencidos</span>
          <strong>{isLoading ? "-" : summary?.expired ?? 0}</strong>
          <small>Fuera de vigencia</small>
        </article>
        <article>
          <span>Pendiente BUK</span>
          <strong>{isLoading ? "-" : summary?.pendingBuk ?? 0}</strong>
          <small>Carga documental</small>
        </article>
      </div>

      <div className="competency-validity-card">
        <div className="competency-validity-card__header">
          <div>
            <h3>Certificados recientes</h3>
            <p>Ultimos 50 registros visibles segun permisos del usuario.</p>
          </div>
          <button type="button" className="competency-inline-action" onClick={onRetry} disabled={isLoading}>
            Actualizar
          </button>
        </div>

        {isLoading ? (
          <div className="competency-summary-empty">Cargando resumen de certificados...</div>
        ) : recent.length === 0 ? (
          <div className="competency-summary-empty">No hay certificados generados para mostrar.</div>
        ) : (
          <div className="competency-summary-table" role="table" aria-label="Vigencia de certificados recientes">
            <div className="competency-summary-table__head" role="row">
              <span>Folio</span>
              <span>Trabajador</span>
              <span>Modelos</span>
              <span>Vigencia</span>
              <span>Estado</span>
            </div>
            {recent.map((row) => {
              const validity = getCertificateValidity(row);

              return (
                <div className="competency-summary-table__row" role="row" key={row.certificateId}>
                  <strong>{row.folio}</strong>
                  <span>
                    {row.workerFullName}
                    <small>{row.workerDocumentNumber}</small>
                  </span>
                  <span>{row.modelSummary || "Sin modelos informados"}</span>
                  <span>
                    {formatDateLabel(row.validUntil)}
                    <small className={`competency-validity-badge competency-validity-badge--${validity.tone}`}>
                      {validity.label}
                    </small>
                  </span>
                  <span>
                    {statusLabel(row.certificateStatus)}
                    <small>{statusLabel(row.bukUploadStatus)}</small>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function CompetencyCertificationPage() {
  const { user, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<CompetencyTab>("new");
  const [catalogs, setCatalogs] = useState<CompetencyCatalogs | null>(null);
  const [dashboard, setDashboard] = useState<CompetencyDashboardPayload | null>(null);
  const [form, setForm] = useState<FormState>(() => initialFormState());
  const [selectedWorker, setSelectedWorker] = useState<CompetencyWorker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dashboardErrorMessage, setDashboardErrorMessage] = useState<string | null>(null);
  const [modelWarnings, setModelWarnings] = useState<CompetencyModelWarning[]>([]);
  const [warningError, setWarningError] = useState<string | null>(null);
  const [lastGeneration, setLastGeneration] = useState<LastGeneration | null>(null);
  const [evaluationFile, setEvaluationFile] = useState<File | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialState() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextCatalogs = await fetchCompetencyCatalogs();

        if (!isMounted) return;

        setCatalogs(nextCatalogs);
        setForm((current) => ({
          ...current,
          instructorId:
            current.instructorId ||
            (nextCatalogs.instructors.length === 1 ? nextCatalogs.instructors[0]?.id ?? "" : "")
        }));
      } catch (error) {
        if (isMounted) {
          setErrorMessage(buildErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialState();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsDashboardLoading(true);
    setDashboardErrorMessage(null);

    try {
      const nextDashboard = await fetchCompetencyDashboard();
      setDashboard(nextDashboard);
    } catch (error) {
      setDashboardErrorMessage(buildErrorMessage(error));
    } finally {
      setIsDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "summary" && !dashboard && !isDashboardLoading) {
      void loadDashboard();
    }
  }, [activeTab, dashboard, isDashboardLoading, loadDashboard]);

  const brandOptions = useMemo(
    () => (catalogs?.brands ?? []).map((item) => ({ value: item.id, label: item.name })),
    [catalogs]
  );

  const typeOptions = useMemo(
    () => (catalogs?.types ?? []).map((item) => ({ value: item.id, label: item.name })),
    [catalogs]
  );

  const instructorOptions = useMemo(
    () =>
      (catalogs?.instructors ?? []).map((item) => ({
        value: item.id,
        label: `${item.fullName} · ${item.profileCode}`
      })),
    [catalogs]
  );

  const selectedInstructor = useMemo<CompetencyInstructor | null>(
    () => (catalogs?.instructors ?? []).find((instructor) => instructor.id === form.instructorId) ?? null,
    [catalogs, form.instructorId]
  );

  const instructorIsEditable = canManageInstructors(isSuperAdmin, catalogs) && instructorOptions.length > 1;
  const modelMap = useMemo(() => new Map((catalogs?.models ?? []).map((model) => [model.id, model])), [catalogs]);
  const selectedModels = useMemo(
    () => form.modelRows.map((row) => modelMap.get(row.modelId)).filter(Boolean),
    [form.modelRows, modelMap]
  );
  const selectedModelIds = useMemo(
    () => form.modelRows.map((row) => row.modelId).filter(Boolean),
    [form.modelRows]
  );
  const selectedModelNames = useMemo(
    () => selectedModels.map((model) => `${model?.brandName} ${model?.typeName} ${model?.name}`),
    [selectedModels]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadWarnings() {
      if (!selectedWorker?.bukEmployeeId || selectedModelIds.length === 0 || !form.trainingDate) {
        setModelWarnings([]);
        setWarningError(null);
        return;
      }

      try {
        const warnings = await fetchCompetencyModelWarnings({
          workerBukEmployeeId: selectedWorker.bukEmployeeId,
          modelIds: selectedModelIds,
          trainingDate: form.trainingDate
        });

        if (isMounted) {
          setModelWarnings(warnings);
          setWarningError(null);
        }
      } catch (error) {
        if (isMounted) {
          setModelWarnings([]);
          setWarningError(buildErrorMessage(error));
        }
      }
    }

    loadWarnings();
    return () => {
      isMounted = false;
    };
  }, [form.trainingDate, selectedModelIds, selectedWorker?.bukEmployeeId]);

  const canSubmit =
    Boolean(user?.id) &&
    Boolean(selectedWorker) &&
    Boolean(form.instructorId) &&
    selectedModels.length > 0 &&
    Boolean(form.trainingDate) &&
    Boolean(evaluationFile) &&
    form.declarationAccepted &&
    !isSubmitting;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateModelRow(rowId: string, patch: Partial<Omit<CompetencyModelRow, "id">>) {
    setForm((current) => {
      return {
        ...current,
        modelRows: current.modelRows.map((row) =>
          row.id === rowId
            ? {
                ...row,
                ...patch,
                typeId: patch.brandId !== undefined ? "" : patch.typeId ?? row.typeId,
                modelId: patch.brandId !== undefined || patch.typeId !== undefined ? "" : patch.modelId ?? row.modelId
              }
            : row
        )
      };
    });
  }

  function addModelRow() {
    setForm((current) => ({ ...current, modelRows: [...current.modelRows, createModelRow()] }));
  }

  function removeModelRow(rowId: string) {
    setForm((current) => ({
      ...current,
      modelRows: current.modelRows.length === 1 ? current.modelRows : current.modelRows.filter((row) => row.id !== rowId)
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id || !selectedWorker || !selectedInstructor) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage(null);
    setLastGeneration(null);

    try {
      if (Number(form.theoreticalScore) !== 100 || Number(form.practicalScore) !== 100) {
        throw new Error("No se puede generar el certificado: la evaluacion teorica y practica deben ser 100%.");
      }

      if (!form.declarationAccepted) {
        throw new Error("Debes confirmar que la evaluacion corresponde al trabajador seleccionado.");
      }

      validateEvaluationEvidence(evaluationFile);

      if (!evaluationFile) {
        throw new Error("Debes cargar el examen teorico/evaluacion respaldada antes de generar el certificado.");
      }

      setMessage("Cargando evaluación y generando certificado productivo.");
      const {
        createCompetencyDocumentUrl,
        createCompetencyRequest,
        generateCompetencyCertificate,
        uploadCompetencyEvaluationFile
      } = await importWithRetry("competency-api", () => import("../services/competencyApi"));
      const evaluationUpload = await uploadCompetencyEvaluationFile(evaluationFile, user.id);
      const request = await createCompetencyRequest({
        workerBukEmployeeId: selectedWorker.bukEmployeeId,
        instructorId: selectedInstructor.id,
        modelIds: selectedModelIds,
        trainingDate: form.trainingDate,
        trainingStartTime: form.trainingStartTime,
        trainingEndTime: form.trainingEndTime,
        trainingLocation: "",
        theoreticalScore: Number(form.theoreticalScore),
        practicalScore: Number(form.practicalScore),
        finalScore: 100,
        evaluationDate: new Date().toISOString(),
        evaluationFilePath: evaluationUpload.path,
        evaluationFileName: evaluationUpload.name,
        evaluationMimeType: evaluationUpload.mimeType,
        evaluationSizeBytes: evaluationUpload.sizeBytes,
        evaluationSha256: evaluationUpload.sha256,
        declarationAccepted: form.declarationAccepted
      });
      const generation = await generateCompetencyCertificate(request.requestId);
      let documentUrl = generation.bukDocumentUrl ?? null;
      if (!documentUrl && generation.bukUploadStatus !== "success") {
        documentUrl = await createCompetencyDocumentUrl(generation.pdfPath);
      }
      setLastGeneration({ ...generation, documentUrl });
      setMessage(
        generation.bukUploadStatus === "success"
          ? `Certificado ${generation.folio} generado y cargado correctamente en BUK.`
          : `Certificado ${generation.folio} generado. Revisa estado BUK: ${generation.bukUploadStatus}.`
      );
      void loadDashboard();
      if (documentUrl) {
        window.open(documentUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setErrorMessage(buildErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const noInstructorConfigured = !isLoading && (catalogs?.instructors.length ?? 0) === 0;

  return (
    <PageShell>
      <div className="minimal-page-header competency-header">
        <h1>Certificacion de Competencias</h1>
      </div>

      {errorMessage ? <div className="form-error competency-alert">{errorMessage}</div> : null}
      {message ? <div className="competency-alert competency-alert-info">{message}</div> : null}
      {modelWarnings.length > 0 ? (
        <div className="competency-alert" role="alert">
          Ya existe un certificado vigente para este trabajador en{" "}
          {modelWarnings
            .map((warning) => `${warning.brandName} ${warning.typeName} ${warning.modelName} (folio ${warning.folio}, vigente hasta ${warning.validUntil ?? "sin fecha"})`)
            .join(" · ")}
          . Puedes continuar, pero revisa si corresponde emitir un nuevo certificado.
        </div>
      ) : null}
      {warningError ? <div className="competency-alert">{warningError}</div> : null}

      <div className="approval-chip-row competency-view-tabs" role="tablist" aria-label="Secciones de certificacion de competencias">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "new"}
          className={`approval-chip ${activeTab === "new" ? "tracking-kpi-card-active" : ""}`}
          onClick={() => setActiveTab("new")}
        >
          Nueva certificacion
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "summary"}
          className={`approval-chip ${activeTab === "summary" ? "tracking-kpi-card-active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          Resumen de Certificados
        </button>
      </div>

      <div className="competency-layout">
        {activeTab === "summary" ? (
          <CompetencyCertificateSummaryPanel
            dashboard={dashboard}
            isLoading={isDashboardLoading}
            errorMessage={dashboardErrorMessage}
            onRetry={loadDashboard}
          />
        ) : (
          <form className="competency-form-panel" onSubmit={handleSubmit}>
            <div className="competency-section-heading">
              <h2>Nueva certificacion</h2>
              <span>{canManageInstructors(isSuperAdmin, catalogs) ? "Modo administrador" : "Modo instructor"}</span>
            </div>

          <fieldset className="competency-fieldset" disabled={isLoading || isSubmitting || noInstructorConfigured}>
            <div className="competency-grid-three">
              <SelectField
                id="competency-instructor"
                label="Instructor"
                value={form.instructorId}
                onChange={(event) => updateField("instructorId", event.target.value)}
                options={instructorOptions}
                disabled={!instructorIsEditable}
              />
              <TextField
                id="competency-instructor-document"
                label="RUT instructor"
                value={selectedInstructor?.documentNumber ?? ""}
                readOnly
              />
              <TextField
                id="competency-instructor-profile"
                label="Codigo perfil"
                value={selectedInstructor?.profileCode ?? ""}
                readOnly
              />
            </div>

            <div className="competency-grid-three competency-worker-line">
              <StandardWorkerLookupField
                id="competency-worker-search"
                label="Trabajador BUK"
                placeholder="Buscar por nombre, RUT, cargo o ID BUK"
                selectedWorker={selectedWorker}
                onSelect={(worker) => {
                  setSelectedWorker(worker);
                  setLastGeneration(null);
                  setMessage(null);
                  setModelWarnings([]);
                  setWarningError(null);
                }}
                disabled={isLoading || isSubmitting}
                useSearchQuery={useCompetencyWorkerSearch}
                loadingMessage="Buscando trabajadores BUK..."
                emptyMessage="No hay trabajadores activos que coincidan con la busqueda actual."
                minSearchLength={2}
                includeCompanyName
              />
              <TextField
                id="competency-worker-document"
                label="RUT trabajador"
                value={selectedWorker?.documentNumber ?? ""}
                readOnly
              />
              <TextField
                id="competency-worker-job"
                label="Cargo trabajador"
                value={selectedWorker?.jobTitle ?? ""}
                readOnly
              />
            </div>

            <div className="competency-grid-three">
              <TextField
                id="competency-training-date"
                label="Fecha de capacitacion"
                type="date"
                value={form.trainingDate}
                onChange={(event) => updateField("trainingDate", event.target.value)}
              />
              <TextField
                id="competency-training-start"
                label="Inicio"
                type="time"
                value={form.trainingStartTime}
                onChange={(event) => updateField("trainingStartTime", event.target.value)}
              />
              <TextField
                id="competency-training-end"
                label="Termino"
                type="time"
                value={form.trainingEndTime}
                onChange={(event) => updateField("trainingEndTime", event.target.value)}
              />
            </div>

            <div className="competency-model-box">
              <div className="competency-model-box-header">
                <strong>Modelos autorizados</strong>
                <button type="button" className="competency-add-model-button" onClick={addModelRow}>
                  + Agregar modelo
                </button>
              </div>
              {form.modelRows.map((row, index) => {
                const typeIdsForBrand = new Set(
                  (catalogs?.models ?? [])
                    .filter((model) => !row.brandId || model.brandId === row.brandId)
                    .map((model) => model.typeId)
                );
                const filteredTypeOptions = typeOptions.filter((option) => typeIdsForBrand.has(option.value));
                const filteredModelOptions = (catalogs?.models ?? [])
                  .filter((model) => (!row.brandId || model.brandId === row.brandId) && (!row.typeId || model.typeId === row.typeId))
                  .map((model) => ({ value: model.id, label: model.name }));

                return (
                  <div className="competency-model-row" key={row.id}>
                    <SelectField
                      id={`competency-brand-${row.id}`}
                      label={index === 0 ? "Marca" : "Marca adicional"}
                      value={row.brandId}
                      onChange={(event) => updateModelRow(row.id, { brandId: event.target.value })}
                      options={brandOptions}
                    />
                    <SelectField
                      id={`competency-type-${row.id}`}
                      label="Tipo"
                      value={row.typeId}
                      onChange={(event) => updateModelRow(row.id, { typeId: event.target.value })}
                      options={filteredTypeOptions}
                      disabled={!row.brandId}
                    />
                    <SelectField
                      id={`competency-model-${row.id}`}
                      label="Modelo"
                      value={row.modelId}
                      onChange={(event) => updateModelRow(row.id, { modelId: event.target.value })}
                      options={filteredModelOptions}
                      disabled={!row.brandId || !row.typeId}
                    />
                    <button
                      type="button"
                      className="competency-remove-model-button"
                      onClick={() => removeModelRow(row.id)}
                      disabled={form.modelRows.length === 1}
                      aria-label="Eliminar modelo autorizado"
                    >
                      -
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="competency-grid-two">
              <TextField
                id="competency-score-theoretical"
                label="Teorico %"
                type="number"
                min="0"
                step="1"
                value={form.theoreticalScore}
                onChange={(event) => updateField("theoreticalScore", event.target.value)}
              />
              <TextField
                id="competency-score-practical"
                label="Practico %"
                type="number"
                min="0"
                step="1"
                value={form.practicalScore}
                onChange={(event) => updateField("practicalScore", event.target.value)}
              />
            </div>

            <label className="competency-file-field" htmlFor="competency-evaluation-file">
              <span>Examen teorico / evaluacion respaldada</span>
              <input
                id="competency-evaluation-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required
                onChange={(event) => {
                  setEvaluationFile(event.target.files?.[0] ?? null);
                  setLastGeneration(null);
                  setMessage(null);
                }}
              />
            </label>

            <label className="competency-declaration">
              <input
                type="checkbox"
                required
                checked={form.declarationAccepted}
                onChange={(event) => updateField("declarationAccepted", event.target.checked)}
              />
              <span>Confirmo que la evaluacion teorica y practica fue aprobada con 100% y corresponde al trabajador seleccionado.</span>
            </label>

            {selectedModelNames.length > 0 ? (
              <p className="competency-selection-summary">{selectedModelNames.join(" · ")}</p>
            ) : null}

            <button type="submit" className="primary-action-button competency-submit-button" disabled={!canSubmit}>
              {isSubmitting ? "Generando..." : "Generar certificado y cargar a BUK"}
            </button>
          </fieldset>

          {noInstructorConfigured ? (
            <div className="competency-alert">
              No hay instructor activo vinculado a tu cuenta. Un administrador de certificaciones debe asignar el instructor antes de emitir.
            </div>
          ) : null}

          {lastGeneration ? (
            <article className="competency-last-result">
              <strong>{lastGeneration.folio}</strong>
              <span>{lastGeneration.bukUploadStatus === "success" ? "Cargado en BUK" : statusLabel(lastGeneration.bukUploadStatus)}</span>
              {lastGeneration.documentUrl ? (
                <button type="button" onClick={() => window.open(lastGeneration.documentUrl ?? "", "_blank", "noopener,noreferrer")}>
                  {lastGeneration.bukDocumentUrl ? "Abrir en BUK" : "Abrir PDF"}
                </button>
              ) : null}
            </article>
          ) : null}
          </form>
        )}
      </div>
    </PageShell>
  );
}
