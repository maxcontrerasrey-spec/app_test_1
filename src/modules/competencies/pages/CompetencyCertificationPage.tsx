import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell, SelectField, StandardWorkerLookupField, TextField } from "../../../shared/ui";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchCompetencyCatalogs,
  generateCompetencyPreviewPdf
} from "../services/competencyApi";
import { useCompetencyWorkerSearch } from "../hooks/useCompetencyQueries";
import type {
  CompetencyCatalogs,
  CompetencyInstructor,
  CompetencyPreviewPdfResult,
  CompetencyWorker
} from "../types";
import "../styles/competencies.css";

type FormState = {
  instructorId: string;
  brandId: string;
  typeId: string;
  modelIds: string[];
  trainingDate: string;
  trainingStartTime: string;
  trainingEndTime: string;
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
    instructorId: "",
    brandId: "",
    typeId: "",
    modelIds: [],
    trainingDate: todayDate(),
    trainingStartTime: "",
    trainingEndTime: "",
    theoreticalScore: "100",
    practicalScore: "100",
    finalScore: "100",
    notes: "",
    declarationAccepted: false
  };
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

function canManageInstructors(isSuperAdmin: boolean, catalogs: CompetencyCatalogs | null) {
  return isSuperAdmin || catalogs?.permissions.canAdmin === true;
}

export function CompetencyCertificationPage() {
  const { user, isSuperAdmin } = useAuth();
  const [catalogs, setCatalogs] = useState<CompetencyCatalogs | null>(null);
  const [form, setForm] = useState<FormState>(() => initialFormState());
  const [selectedWorker, setSelectedWorker] = useState<CompetencyWorker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastGeneration, setLastGeneration] = useState<CompetencyPreviewPdfResult | null>(null);

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
    !isSubmitting;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id || !selectedWorker || !selectedInstructor) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage("Generando PDF temporal de prueba.");
    setLastGeneration(null);

    try {
      const generation = generateCompetencyPreviewPdf({
        instructorName: selectedInstructor.fullName,
        instructorDocumentNumber: selectedInstructor.documentNumber,
        instructorProfileCode: selectedInstructor.profileCode,
        workerName: selectedWorker.fullName,
        workerDocumentNumber: selectedWorker.documentNumber,
        workerJobTitle: selectedWorker.jobTitle ?? "",
        modelSummary: selectedModelNames.join(", "),
        trainingDate: form.trainingDate,
        trainingStartTime: form.trainingStartTime,
        trainingEndTime: form.trainingEndTime
      });
      setLastGeneration(generation);
      setMessage(`PDF temporal ${generation.folio} generado sin guardar ni cargar a BUK.`);
      window.open(generation.objectUrl, "_blank", "noopener,noreferrer");
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

      <div className="competency-layout">
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
                }}
                disabled={isLoading || isSubmitting}
                useSearchQuery={useCompetencyWorkerSearch}
                loadingMessage="Buscando trabajadores BUK..."
                emptyMessage="No hay trabajadores activos que coincidan con la busqueda actual."
                minSearchLength={2}
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
              {isSubmitting ? "Generando..." : "Generar PDF de prueba"}
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
              <span>{statusLabel("generated")} sin guardado ni carga BUK</span>
              <button type="button" onClick={() => window.open(lastGeneration.objectUrl, "_blank", "noopener,noreferrer")}>
                Abrir PDF
              </button>
            </article>
          ) : null}
        </form>
      </div>
    </PageShell>
  );
}
