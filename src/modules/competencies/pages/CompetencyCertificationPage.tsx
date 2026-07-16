import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell, SelectField, TextField } from "../../../shared/ui";
import { useAuth } from "../../auth/context/AuthContext";
import {
  createCompetencyDocumentUrl,
  createCompetencyRequest,
  fetchCompetencyCatalogs,
  fetchCompetencyDashboard,
  generateCompetencyCertificate,
  searchCompetencyWorkers,
  uploadCompetencyEvaluationFile
} from "../services/competencyApi";
import type {
  CompetencyCatalogs,
  CompetencyDashboardPayload,
  CompetencyGenerationResult,
  CompetencyWorker
} from "../types";
import "../styles/competencies.css";

const emptyDashboard: CompetencyDashboardPayload = {
  summary: {
    total: 0,
    enabled: 0,
    pendingBuk: 0,
    expired: 0
  },
  recent: []
};

type FormState = {
  workerSearch: string;
  instructorId: string;
  brandId: string;
  typeId: string;
  modelIds: string[];
  trainingDate: string;
  trainingStartTime: string;
  trainingEndTime: string;
  trainingLocation: string;
  theoreticalScore: string;
  practicalScore: string;
  finalScore: string;
  notes: string;
  declarationAccepted: boolean;
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function initialFormState(): FormState {
  return {
    workerSearch: "",
    instructorId: "",
    brandId: "",
    typeId: "",
    modelIds: [],
    trainingDate: todayDate(),
    trainingStartTime: "",
    trainingEndTime: "",
    trainingLocation: "",
    theoreticalScore: "100",
    practicalScore: "100",
    finalScore: "100",
    notes: "",
    declarationAccepted: false
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return [day, month, year].filter(Boolean).join("-");
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
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

function buildErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function CompetencyCertificationPage() {
  const { user, isSuperAdmin } = useAuth();
  const [catalogs, setCatalogs] = useState<CompetencyCatalogs | null>(null);
  const [dashboard, setDashboard] = useState<CompetencyDashboardPayload>(emptyDashboard);
  const [form, setForm] = useState<FormState>(() => initialFormState());
  const [selectedWorker, setSelectedWorker] = useState<CompetencyWorker | null>(null);
  const [workerResults, setWorkerResults] = useState<CompetencyWorker[]>([]);
  const [evaluationFile, setEvaluationFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastGeneration, setLastGeneration] = useState<CompetencyGenerationResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialState() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [nextCatalogs, nextDashboard] = await Promise.all([
          fetchCompetencyCatalogs(),
          fetchCompetencyDashboard()
        ]);

        if (!isMounted) return;

        setCatalogs(nextCatalogs);
        setDashboard(nextDashboard);
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

  const visibleModels = useMemo(() => {
    const models = catalogs?.models ?? [];
    return models.filter((model) => {
      const matchesBrand = !form.brandId || model.brandId === form.brandId;
      const matchesType = !form.typeId || model.typeId === form.typeId;
      return matchesBrand && matchesType;
    });
  }, [catalogs, form.brandId, form.typeId]);

  const selectedModelNames = useMemo(() => {
    const modelMap = new Map((catalogs?.models ?? []).map((model) => [model.id, model]));
    return form.modelIds
      .map((id) => modelMap.get(id))
      .filter(Boolean)
      .map((model) => `${model?.brandName} ${model?.typeName} ${model?.name}`);
  }, [catalogs, form.modelIds]);

  const canSubmit =
    Boolean(user?.id) &&
    Boolean(selectedWorker) &&
    Boolean(form.instructorId) &&
    form.modelIds.length > 0 &&
    Boolean(form.trainingDate) &&
    Boolean(evaluationFile) &&
    form.declarationAccepted &&
    !isSubmitting;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleWorkerSearch() {
    const query = form.workerSearch.trim();
    setSelectedWorker(null);
    setLastGeneration(null);
    setWorkerResults([]);

    if (query.length < 3) {
      setErrorMessage("Ingresa al menos 3 caracteres para buscar trabajador.");
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const results = await searchCompetencyWorkers(query);
      setWorkerResults(results);
      if (results.length === 0) {
        setMessage("No se encontraron trabajadores activos sincronizados desde BUK.");
      }
    } catch (error) {
      setErrorMessage(buildErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  }

  function toggleModel(modelId: string) {
    setForm((current) => {
      const exists = current.modelIds.includes(modelId);
      return {
        ...current,
        modelIds: exists
          ? current.modelIds.filter((id) => id !== modelId)
          : [...current.modelIds, modelId]
      };
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setEvaluationFile(event.target.files?.[0] ?? null);
    setLastGeneration(null);
  }

  async function refreshDashboard() {
    const nextDashboard = await fetchCompetencyDashboard();
    setDashboard(nextDashboard);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id || !selectedWorker || !evaluationFile) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage("Cargando evaluacion y generando certificado.");
    setLastGeneration(null);

    try {
      const uploadedEvaluation = await uploadCompetencyEvaluationFile(evaluationFile, user.id);
      const request = await createCompetencyRequest({
        workerBukEmployeeId: selectedWorker.bukEmployeeId,
        instructorId: form.instructorId,
        modelIds: form.modelIds,
        trainingDate: form.trainingDate,
        trainingStartTime: form.trainingStartTime,
        trainingEndTime: form.trainingEndTime,
        trainingLocation: form.trainingLocation,
        theoreticalScore: Number(form.theoreticalScore),
        practicalScore: Number(form.practicalScore),
        finalScore: Number(form.finalScore),
        evaluationDate: new Date().toISOString(),
        evaluationFilePath: uploadedEvaluation.path,
        evaluationFileName: uploadedEvaluation.name,
        evaluationMimeType: uploadedEvaluation.mimeType,
        evaluationSizeBytes: uploadedEvaluation.sizeBytes,
        evaluationSha256: uploadedEvaluation.sha256,
        declarationAccepted: form.declarationAccepted,
        notes: form.notes
      });
      const generation = await generateCompetencyCertificate(request.requestId);
      setLastGeneration(generation);
      setMessage(
        generation.bukUploadStatus === "success"
          ? `Certificado ${generation.folio} generado y cargado en BUK.`
          : `Certificado ${generation.folio} generado; carga BUK pendiente de reintento.`
      );
      setForm(initialFormState());
      setSelectedWorker(null);
      setWorkerResults([]);
      setEvaluationFile(null);
      await refreshDashboard();
    } catch (error) {
      setErrorMessage(buildErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDownload(path: string) {
    try {
      const url = await createCompetencyDocumentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(buildErrorMessage(error));
    }
  }

  const noInstructorConfigured = !isLoading && (catalogs?.instructors.length ?? 0) === 0;

  return (
    <PageShell>
      <div className="minimal-page-header competency-header">
        <h1>Certificacion de Competencias</h1>
        <p className="description">
          Emision controlada de certificados para conductores, con evaluacion privada, folio, vigencia y carga documental a BUK.
        </p>
      </div>

      <section className="competency-summary-grid" aria-label="Resumen de certificaciones">
        <article className="competency-metric">
          <span>Total</span>
          <strong>{dashboard.summary.total}</strong>
        </article>
        <article className="competency-metric">
          <span>Habilitados</span>
          <strong>{dashboard.summary.enabled}</strong>
        </article>
        <article className="competency-metric">
          <span>BUK pendiente</span>
          <strong>{dashboard.summary.pendingBuk}</strong>
        </article>
        <article className="competency-metric">
          <span>Vencidos</span>
          <strong>{dashboard.summary.expired}</strong>
        </article>
      </section>

      {errorMessage ? <div className="form-error competency-alert">{errorMessage}</div> : null}
      {message ? <div className="competency-alert competency-alert-info">{message}</div> : null}

      <div className="competency-layout">
        <form className="competency-form-panel" onSubmit={handleSubmit}>
          <div className="competency-section-heading">
            <h2>Nueva certificacion</h2>
            <span>{isSuperAdmin || catalogs?.permissions.canAdmin ? "Modo administrador" : "Modo instructor"}</span>
          </div>

          <fieldset className="competency-fieldset" disabled={isLoading || isSubmitting || noInstructorConfigured}>
            <div className="competency-worker-search">
              <TextField
                id="competency-worker-search"
                label="Trabajador BUK"
                value={form.workerSearch}
                onChange={(event) => updateField("workerSearch", event.target.value)}
                placeholder="Buscar por nombre, RUT, cargo o ID BUK"
              />
              <button
                type="button"
                className="primary-action-button competency-search-button"
                onClick={handleWorkerSearch}
                disabled={isSearching}
              >
                {isSearching ? "Buscando..." : "Buscar"}
              </button>
            </div>

            {workerResults.length > 0 ? (
              <div className="competency-worker-results" aria-label="Resultados de trabajadores">
                {workerResults.map((worker) => (
                  <button
                    type="button"
                    key={worker.bukEmployeeId}
                    className={`competency-worker-row ${
                      selectedWorker?.bukEmployeeId === worker.bukEmployeeId ? "is-selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedWorker(worker);
                      updateField("workerSearch", worker.fullName);
                    }}
                  >
                    <strong>{worker.fullName}</strong>
                    <span>{[worker.documentNumber, worker.jobTitle, worker.areaName].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {selectedWorker ? (
              <div className="competency-selected-worker">
                <strong>{selectedWorker.fullName}</strong>
                <span>
                  {[selectedWorker.documentNumber, selectedWorker.jobTitle, selectedWorker.contractCode].filter(Boolean).join(" · ")}
                </span>
              </div>
            ) : null}

            <div className="competency-grid-two">
              <SelectField
                id="competency-instructor"
                label="Instructor"
                value={form.instructorId}
                onChange={(event) => updateField("instructorId", event.target.value)}
                options={instructorOptions}
                disabled={instructorOptions.length <= 1}
              />
              <TextField
                id="competency-training-date"
                label="Fecha de capacitacion"
                type="date"
                value={form.trainingDate}
                onChange={(event) => updateField("trainingDate", event.target.value)}
              />
            </div>

            <div className="competency-grid-two">
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

            <TextField
              id="competency-location"
              label="Lugar"
              value={form.trainingLocation}
              onChange={(event) => updateField("trainingLocation", event.target.value)}
              placeholder="Faena, terminal o sala de capacitacion"
            />

            <div className="competency-grid-two">
              <SelectField
                id="competency-brand"
                label="Marca"
                value={form.brandId}
                onChange={(event) => updateField("brandId", event.target.value)}
                options={brandOptions}
                placeholder="Todas las marcas"
              />
              <SelectField
                id="competency-type"
                label="Tipo"
                value={form.typeId}
                onChange={(event) => updateField("typeId", event.target.value)}
                options={typeOptions}
                placeholder="Todos los tipos"
              />
            </div>

            <div className="competency-model-box">
              <div className="competency-model-box-header">
                <strong>Modelos autorizados</strong>
                <span>{form.modelIds.length} seleccionados</span>
              </div>
              <div className="competency-model-list">
                {visibleModels.map((model) => (
                  <label key={model.id} className="competency-model-option">
                    <input
                      type="checkbox"
                      checked={form.modelIds.includes(model.id)}
                      onChange={() => toggleModel(model.id)}
                    />
                    <span>{`${model.brandName} ${model.typeName} ${model.name}`}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="competency-grid-three">
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
              <TextField
                id="competency-score-final"
                label="Final %"
                type="number"
                min="0"
                step="1"
                value={form.finalScore}
                onChange={(event) => updateField("finalScore", event.target.value)}
              />
            </div>

            <div className="competency-file-field">
              <label className="field-label" htmlFor="competency-evaluation-file">Evaluacion respaldada</label>
              <input
                id="competency-evaluation-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={handleFileChange}
              />
              <span>{evaluationFile ? `${evaluationFile.name} · ${(evaluationFile.size / 1024 / 1024).toFixed(2)} MB` : "PDF, JPG o PNG hasta 15 MB."}</span>
            </div>

            <label className="competency-declaration">
              <input
                type="checkbox"
                checked={form.declarationAccepted}
                onChange={(event) => updateField("declarationAccepted", event.target.checked)}
              />
              <span>Confirmo que la evaluacion teorica y practica fue aprobada con 100% y corresponde al trabajador seleccionado.</span>
            </label>

            <div className="competency-notes-field">
              <label className="field-label" htmlFor="competency-notes">Notas internas</label>
              <textarea
                id="competency-notes"
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                rows={3}
              />
            </div>

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
        </form>

        <section className="competency-dashboard-panel">
          <div className="competency-section-heading">
            <h2>Resumen y seguimiento</h2>
            <button type="button" className="secondary-action-button" onClick={refreshDashboard} disabled={isLoading}>
              Actualizar
            </button>
          </div>

          {lastGeneration ? (
            <article className="competency-last-result">
              <strong>{lastGeneration.folio}</strong>
              <span>{statusLabel(lastGeneration.bukUploadStatus)}</span>
              {lastGeneration.pdfPath ? (
                <button type="button" onClick={() => handleDownload(lastGeneration.pdfPath)}>
                  Abrir PDF
                </button>
              ) : null}
            </article>
          ) : null}

          <div className="competency-table-wrapper">
            <table className="competency-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Trabajador</th>
                  <th>Equipos</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent.map((row) => (
                  <tr key={row.certificateId}>
                    <td>{row.folio}</td>
                    <td>
                      <strong>{row.workerFullName}</strong>
                      <span>{row.workerDocumentNumber}</span>
                    </td>
                    <td>{row.modelSummary}</td>
                    <td>
                      <span className={`competency-status-pill competency-status-${row.bukUploadStatus}`}>
                        {statusLabel(row.certificateStatus)}
                      </span>
                    </td>
                    <td>{formatDate(row.validUntil)}</td>
                    <td>
                      {row.pdfPath ? (
                        <button type="button" className="competency-link-button" onClick={() => handleDownload(row.pdfPath!)}>
                          Abrir
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
                {dashboard.recent.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Sin certificados emitidos para el alcance actual.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
