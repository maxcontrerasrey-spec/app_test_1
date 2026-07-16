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
  modelRows: CompetencyModelRow[];
  trainingDate: string;
  trainingStartTime: string;
  trainingEndTime: string;
  theoreticalScore: string;
  practicalScore: string;
  finalScore: string;
  notes: string;
  declarationAccepted: boolean;
};

type CompetencyModelRow = {
  id: string;
  brandId: string;
  typeId: string;
  modelId: string;
};

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
  const modelMap = useMemo(() => new Map((catalogs?.models ?? []).map((model) => [model.id, model])), [catalogs]);
  const selectedModels = useMemo(
    () => form.modelRows.map((row) => modelMap.get(row.modelId)).filter(Boolean),
    [form.modelRows, modelMap]
  );
  const selectedModelNames = useMemo(
    () => selectedModels.map((model) => `${model?.brandName} ${model?.typeName} ${model?.name}`),
    [selectedModels]
  );

  const canSubmit =
    Boolean(user?.id) &&
    Boolean(selectedWorker) &&
    Boolean(form.instructorId) &&
    selectedModels.length > 0 &&
    Boolean(form.trainingDate) &&
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
    setMessage("Generando PDF temporal de prueba.");
    setLastGeneration(null);

    try {
      const generation = await generateCompetencyPreviewPdf({
        instructorName: selectedInstructor.fullName,
        instructorDocumentNumber: selectedInstructor.documentNumber,
        instructorProfileCode: selectedInstructor.profileCode,
        workerName: selectedWorker.fullName,
        workerDocumentNumber: selectedWorker.documentNumber,
        workerJobTitle: selectedWorker.jobTitle ?? "",
        workerCompanyName: selectedWorker.companyName,
        authorizedModels: selectedModels.map((model) => ({
          brandName: model?.brandName ?? "",
          typeName: model?.typeName ?? "",
          modelName: model?.name ?? ""
        })),
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
