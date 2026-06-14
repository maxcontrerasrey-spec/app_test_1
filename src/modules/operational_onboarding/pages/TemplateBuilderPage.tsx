import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useDeleteTemplateTask,
  useTemplateTasks,
  useTemplates,
  useUpdateTemplate,
  useUpsertTemplateTask,
} from "../hooks/useTemplateQueries";
import type {
  OnboardingTemplate,
  OnboardingTemplateInput,
  OnboardingTemplateTask,
  OnboardingTemplateTaskInput,
} from "../types";

type TemplateFormState = {
  name: string;
  description: string;
  cargo: string;
  area: string;
  contrato: string;
  faena: string;
  division: string;
  centro_costo: string;
  worker_type: string;
  is_active: boolean;
  comment: string;
};

type TaskFormState = {
  area_responsible: string;
  role_responsible: string;
  task_name: string;
  task_description: string;
  is_required: boolean;
  is_blocking: boolean;
  requires_evidence: boolean;
  evidence_type: string;
  sla_hours: string;
  is_active: boolean;
  comment: string;
};

function buildTemplateForm(template: OnboardingTemplate): TemplateFormState {
  return {
    name: template.name,
    description: template.description ?? "",
    cargo: template.cargo ?? "",
    area: template.area ?? "",
    contrato: template.contrato ?? "",
    faena: template.faena ?? "",
    division: template.division ?? "",
    centro_costo: template.centro_costo ?? "",
    worker_type: template.worker_type ?? "",
    is_active: template.is_active,
    comment: "",
  };
}

function buildTaskForm(task?: OnboardingTemplateTask, preferredArea?: string): TaskFormState {
  return {
    area_responsible: task?.area_responsible ?? preferredArea ?? "",
    role_responsible: task?.role_responsible ?? "",
    task_name: task?.task_name ?? "",
    task_description: task?.task_description ?? "",
    is_required: task?.is_required ?? true,
    is_blocking: task?.is_blocking ?? true,
    requires_evidence: task?.requires_evidence ?? false,
    evidence_type: task?.evidence_type ?? "",
    sla_hours: task?.sla_hours != null ? String(task.sla_hours) : "24",
    is_active: task?.is_active ?? true,
    comment: "",
  };
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(value: string) {
  return value.trim();
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function TemplateBuilderPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const navigate = useNavigate();
  const { data: templates } = useTemplates();
  const { data: tasks, isLoading: tasksLoading } = useTemplateTasks(id || "");

  const updateTemplateMutation = useUpdateTemplate();
  const upsertTaskMutation = useUpsertTemplateTask();
  const deleteTaskMutation = useDeleteTemplateTask();

  const [templateForm, setTemplateForm] = useState<TemplateFormState | null>(null);
  const [newTaskForm, setNewTaskForm] = useState<TaskFormState>(() => buildTaskForm());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskForm, setEditingTaskForm] = useState<TaskFormState>(() => buildTaskForm());
  const [taskPendingDelete, setTaskPendingDelete] = useState<OnboardingTemplateTask | null>(null);
  const [deleteComment, setDeleteComment] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const template = templates?.find((entry) => entry.id === id) ?? null;

  useEffect(() => {
    if (template) {
      setTemplateForm(buildTemplateForm(template));
    }
  }, [template]);

  const tasksByArea = useMemo(
    () =>
      (tasks ?? []).reduce(
        (accumulator, task) => {
          if (!accumulator[task.area_responsible]) {
            accumulator[task.area_responsible] = [];
          }

          accumulator[task.area_responsible].push(task);
          return accumulator;
        },
        {} as Record<string, OnboardingTemplateTask[]>,
      ),
    [tasks],
  );

  const clearFeedback = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleTemplateFieldChange = <K extends keyof TemplateFormState>(
    field: K,
    value: TemplateFormState[K],
  ) => {
    setTemplateForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleNewTaskFieldChange = <K extends keyof TaskFormState>(
    field: K,
    value: TaskFormState[K],
  ) => {
    setNewTaskForm((current) => ({ ...current, [field]: value }));
  };

  const handleEditingTaskFieldChange = <K extends keyof TaskFormState>(
    field: K,
    value: TaskFormState[K],
  ) => {
    setEditingTaskForm((current) => ({ ...current, [field]: value }));
  };

  const buildTemplatePayload = (form: TemplateFormState): OnboardingTemplateInput => ({
    name: normalizeRequiredText(form.name),
    description: normalizeOptionalText(form.description),
    cargo: normalizeOptionalText(form.cargo),
    area: normalizeOptionalText(form.area),
    contrato: normalizeOptionalText(form.contrato),
    faena: normalizeOptionalText(form.faena),
    division: normalizeOptionalText(form.division),
    centro_costo: normalizeOptionalText(form.centro_costo),
    worker_type: normalizeOptionalText(form.worker_type),
    is_active: form.is_active,
    comment: normalizeOptionalText(form.comment),
  });

  const buildTaskPayload = (
    form: TaskFormState,
    templateId: string,
    orderIndex: number,
    taskId?: string | null,
  ): OnboardingTemplateTaskInput => ({
    id: taskId ?? null,
    template_id: templateId,
    area_responsible: normalizeRequiredText(form.area_responsible),
    role_responsible: normalizeOptionalText(form.role_responsible),
    task_name: normalizeRequiredText(form.task_name),
    task_description: normalizeOptionalText(form.task_description),
    is_required: form.is_required,
    is_blocking: form.is_blocking,
    requires_evidence: form.requires_evidence,
    evidence_type: form.requires_evidence ? normalizeOptionalText(form.evidence_type) : null,
    sla_hours: Number.parseInt(form.sla_hours, 10) || 24,
    order_index: orderIndex,
    is_active: form.is_active,
    comment: normalizeOptionalText(form.comment),
  });

  const handleSaveTemplate = async () => {
    if (!id || !templateForm) {
      return;
    }

    clearFeedback();

    if (!templateForm.name.trim()) {
      setErrorMessage("El nombre de la plantilla es obligatorio.");
      return;
    }

    try {
      const updatedTemplate = await updateTemplateMutation.mutateAsync({
        id,
        template: buildTemplatePayload(templateForm),
      });
      setTemplateForm(buildTemplateForm(updatedTemplate));
      setStatusMessage("Plantilla actualizada correctamente.");
    } catch (error) {
      setErrorMessage(readErrorMessage(error, "No fue posible guardar la plantilla."));
    }
  };

  const handleCreateTask = async () => {
    if (!id) {
      return;
    }

    clearFeedback();

    if (!newTaskForm.area_responsible.trim() || !newTaskForm.task_name.trim()) {
      setErrorMessage("Área y nombre de tarea son obligatorios.");
      return;
    }

    const areaName = normalizeRequiredText(newTaskForm.area_responsible);

    try {
      await upsertTaskMutation.mutateAsync(
        buildTaskPayload(
          newTaskForm,
          id,
          (tasksByArea[areaName]?.length ?? 0) + 1,
        ),
      );
      setNewTaskForm(buildTaskForm(undefined, areaName));
      setStatusMessage("Tarea agregada correctamente.");
    } catch (error) {
      setErrorMessage(readErrorMessage(error, "No fue posible guardar la tarea."));
    }
  };

  const handleEditTask = (task: OnboardingTemplateTask) => {
    clearFeedback();
    setEditingTaskId(task.id);
    setEditingTaskForm(buildTaskForm(task));
  };

  const handleUpdateTask = async (task: OnboardingTemplateTask) => {
    if (!id) {
      return;
    }

    clearFeedback();

    if (!editingTaskForm.area_responsible.trim() || !editingTaskForm.task_name.trim()) {
      setErrorMessage("Área y nombre de tarea son obligatorios.");
      return;
    }

    try {
      await upsertTaskMutation.mutateAsync(
        buildTaskPayload(editingTaskForm, id, task.order_index, task.id),
      );
      setEditingTaskId(null);
      setEditingTaskForm(buildTaskForm());
      setStatusMessage("Tarea actualizada correctamente.");
    } catch (error) {
      setErrorMessage(readErrorMessage(error, "No fue posible actualizar la tarea."));
    }
  };

  const handleConfirmDelete = async () => {
    if (!id || !taskPendingDelete) {
      return;
    }

    clearFeedback();

    try {
      await deleteTaskMutation.mutateAsync({
        id: taskPendingDelete.id,
        templateId: id,
        comment: normalizeOptionalText(deleteComment),
      });
      setTaskPendingDelete(null);
      setDeleteComment("");
      if (editingTaskId === taskPendingDelete.id) {
        setEditingTaskId(null);
        setEditingTaskForm(buildTaskForm());
      }
      setStatusMessage("Tarea eliminada correctamente.");
    } catch (error) {
      setErrorMessage(readErrorMessage(error, "No fue posible eliminar la tarea."));
    }
  };

  if (!template || !templateForm) {
    return (
      <section className="info-card">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p className="tracking-empty-state">
            Cargando constructor de plantilla...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="info-card">
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <button
            type="button"
            className="tracking-filter-caption"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              color: "var(--brand-primary)",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
            onClick={() => navigate("/alta-operacional/templates")}
          >
            ← Volver a Plantillas
          </button>
          <h3>Configuración de Workflow: {template.name}</h3>
          <span className="tracking-filter-caption">
            Administra la metadata, tareas, dependencias y trazabilidad de esta plantilla.
          </span>
        </div>
      </div>

      <div style={{ padding: "0 1.5rem 1.5rem", display: "grid", gap: "1.5rem" }}>
        {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}
        {statusMessage ? <p className="form-status form-status-success">{statusMessage}</p> : null}

        <div
          style={{
            border: "1px solid var(--border-color)",
            borderRadius: "0.75rem",
            padding: "1rem",
            background: "var(--surface-sunken)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>Metadata de la Plantilla</h4>
              <p className="tracking-filter-caption" style={{ margin: "0.35rem 0 0" }}>
                Esta configuración define el alcance y si la plantilla queda disponible para operación.
              </p>
            </div>
            <button
              type="button"
              className="soft-primary-button"
              onClick={handleSaveTemplate}
              disabled={updateTemplateMutation.isPending}
            >
              {updateTemplateMutation.isPending ? "Guardando..." : "Guardar plantilla"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.85rem",
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Nombre</span>
              <input
                className="search-input"
                value={templateForm.name}
                onChange={(event) => handleTemplateFieldChange("name", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Cargo</span>
              <input
                className="search-input"
                value={templateForm.cargo}
                onChange={(event) => handleTemplateFieldChange("cargo", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Área</span>
              <input
                className="search-input"
                value={templateForm.area}
                onChange={(event) => handleTemplateFieldChange("area", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Contrato</span>
              <input
                className="search-input"
                value={templateForm.contrato}
                onChange={(event) => handleTemplateFieldChange("contrato", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Faena</span>
              <input
                className="search-input"
                value={templateForm.faena}
                onChange={(event) => handleTemplateFieldChange("faena", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">División</span>
              <input
                className="search-input"
                value={templateForm.division}
                onChange={(event) => handleTemplateFieldChange("division", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Centro de costo</span>
              <input
                className="search-input"
                value={templateForm.centro_costo}
                onChange={(event) => handleTemplateFieldChange("centro_costo", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Tipo de trabajador</span>
              <input
                className="search-input"
                value={templateForm.worker_type}
                onChange={(event) => handleTemplateFieldChange("worker_type", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", gridColumn: "1 / -1" }}>
              <span className="tracking-filter-caption">Descripción</span>
              <textarea
                className="search-input"
                rows={3}
                value={templateForm.description}
                onChange={(event) => handleTemplateFieldChange("description", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", gridColumn: "1 / -1" }}>
              <span className="tracking-filter-caption">Comentario de auditoría (opcional)</span>
              <input
                className="search-input"
                value={templateForm.comment}
                onChange={(event) => handleTemplateFieldChange("comment", event.target.value)}
                placeholder="Ej: Se activó para conductores DMH"
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", gridColumn: "1 / -1" }}>
              <input
                type="checkbox"
                checked={templateForm.is_active}
                onChange={(event) => handleTemplateFieldChange("is_active", event.target.checked)}
              />
              <span className="tracking-filter-caption">Plantilla activa para nuevos casos</span>
            </label>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--border-color)",
            borderRadius: "0.75rem",
            padding: "1rem",
            background: "var(--surface-sunken)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>Nueva tarea</h4>
              <p className="tracking-filter-caption" style={{ margin: "0.35rem 0 0" }}>
                Define una tarea nueva. Si escribes un área no existente, se creará como nuevo bloque operativo.
              </p>
            </div>
            <button
              type="button"
              className="soft-primary-button"
              onClick={handleCreateTask}
              disabled={upsertTaskMutation.isPending}
            >
              {upsertTaskMutation.isPending ? "Guardando..." : "Agregar tarea"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.85rem",
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Área responsable</span>
              <input
                className="search-input"
                value={newTaskForm.area_responsible}
                onChange={(event) => handleNewTaskFieldChange("area_responsible", event.target.value)}
                placeholder="Ej: Operaciones"
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Rol responsable</span>
              <input
                className="search-input"
                value={newTaskForm.role_responsible}
                onChange={(event) => handleNewTaskFieldChange("role_responsible", event.target.value)}
                placeholder="Ej: Supervisor de contrato"
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", gridColumn: "1 / -1" }}>
              <span className="tracking-filter-caption">Nombre de la tarea</span>
              <input
                className="search-input"
                value={newTaskForm.task_name}
                onChange={(event) => handleNewTaskFieldChange("task_name", event.target.value)}
                placeholder="Ej: Validar credencial minera"
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", gridColumn: "1 / -1" }}>
              <span className="tracking-filter-caption">Descripción</span>
              <textarea
                className="search-input"
                rows={3}
                value={newTaskForm.task_description}
                onChange={(event) => handleNewTaskFieldChange("task_description", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">SLA (horas)</span>
              <input
                className="search-input"
                type="number"
                min={1}
                value={newTaskForm.sla_hours}
                onChange={(event) => handleNewTaskFieldChange("sla_hours", event.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="tracking-filter-caption">Tipo de evidencia</span>
              <input
                className="search-input"
                value={newTaskForm.evidence_type}
                onChange={(event) => handleNewTaskFieldChange("evidence_type", event.target.value)}
                disabled={!newTaskForm.requires_evidence}
                placeholder="Ej: PDF firmado"
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", gridColumn: "1 / -1" }}>
              <span className="tracking-filter-caption">Comentario de auditoría (opcional)</span>
              <input
                className="search-input"
                value={newTaskForm.comment}
                onChange={(event) => handleNewTaskFieldChange("comment", event.target.value)}
              />
            </label>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", gridColumn: "1 / -1" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={newTaskForm.is_required}
                  onChange={(event) => handleNewTaskFieldChange("is_required", event.target.checked)}
                />
                <span className="tracking-filter-caption">Requerida</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={newTaskForm.is_blocking}
                  onChange={(event) => handleNewTaskFieldChange("is_blocking", event.target.checked)}
                />
                <span className="tracking-filter-caption">Bloqueante</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={newTaskForm.requires_evidence}
                  onChange={(event) => handleNewTaskFieldChange("requires_evidence", event.target.checked)}
                />
                <span className="tracking-filter-caption">Requiere evidencia</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={newTaskForm.is_active}
                  onChange={(event) => handleNewTaskFieldChange("is_active", event.target.checked)}
                />
                <span className="tracking-filter-caption">Activa</span>
              </label>
            </div>
          </div>
        </div>

        {taskPendingDelete ? (
          <div className="form-status form-status-error" style={{ display: "grid", gap: "0.75rem" }}>
            <strong>Confirmar eliminación</strong>
            <span>
              Vas a eliminar la tarea <strong>{taskPendingDelete.task_name}</strong> del área{" "}
              <strong>{taskPendingDelete.area_responsible}</strong>.
            </span>
            <input
              className="search-input"
              value={deleteComment}
              onChange={(event) => setDeleteComment(event.target.value)}
              placeholder="Comentario de auditoría (opcional)"
            />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="soft-primary-button"
                style={{ background: "transparent", color: "var(--text-color)" }}
                onClick={() => {
                  setTaskPendingDelete(null);
                  setDeleteComment("");
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="soft-primary-button"
                onClick={handleConfirmDelete}
                disabled={deleteTaskMutation.isPending}
              >
                {deleteTaskMutation.isPending ? "Eliminando..." : "Confirmar eliminación"}
              </button>
            </div>
          </div>
        ) : null}

        {tasksLoading ? (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <p className="tracking-empty-state">Cargando tareas...</p>
          </div>
        ) : Object.keys(tasksByArea).length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <p className="tracking-empty-state">
              Aún no hay tareas configuradas en esta plantilla.
            </p>
          </div>
        ) : (
          Object.entries(tasksByArea).map(([area, areaTasks]) => (
            <div key={area} style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <h4 style={{ margin: 0, fontSize: "1.1rem" }}>
                  {area}{" "}
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "0.9rem",
                      fontWeight: "normal",
                    }}
                  >
                    ({areaTasks.length})
                  </span>
                </h4>
                <button
                  type="button"
                  className="soft-primary-button"
                  style={{ padding: "0.35rem 0.85rem", fontSize: "0.85rem" }}
                  onClick={() => {
                    clearFeedback();
                    setNewTaskForm(buildTaskForm(undefined, area));
                  }}
                >
                  Nueva tarea en esta área
                </button>
              </div>

              <div className="tracking-table-container">
                <table className="tracking-table hr-incentives-table">
                  <thead>
                    <tr>
                      <th>Nombre de la Tarea</th>
                      <th>Descripción</th>
                      <th>Condiciones</th>
                      <th style={{ width: "120px", textAlign: "right" }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaTasks.map((task) => {
                      const isEditing = editingTaskId === task.id;

                      return (
                        <Fragment key={task.id}>
                          <tr>
                            <td>
                              <strong>{task.task_name}</strong>
                            </td>
                            <td>
                              <span className="tracking-filter-caption">
                                {task.task_description || "-"}
                              </span>
                            </td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.5rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                {task.is_blocking ? (
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      background: "var(--status-danger-light, #fee2e2)",
                                      color: "var(--status-danger, #ef4444)",
                                      padding: "0.15rem 0.5rem",
                                      borderRadius: "100px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Bloqueante
                                  </span>
                                ) : null}
                                {task.requires_evidence ? (
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      background: "var(--status-info-light, #e0f2fe)",
                                      color: "var(--status-info, #0284c7)",
                                      padding: "0.15rem 0.5rem",
                                      borderRadius: "100px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Evidencia
                                  </span>
                                ) : null}
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    background: "var(--surface-sunken)",
                                    color: "var(--text-muted)",
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "100px",
                                    fontWeight: 600,
                                  }}
                                >
                                  SLA: {task.sla_hours ?? 24}h
                                </span>
                                {!task.is_active ? (
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      background: "var(--border-color)",
                                      color: "var(--text-muted)",
                                      padding: "0.15rem 0.5rem",
                                      borderRadius: "100px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Inactiva
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className="soft-primary-button"
                                style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                                onClick={() => handleEditTask(task)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="soft-primary-button"
                                style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem", marginLeft: "0.5rem" }}
                                onClick={() => {
                                  clearFeedback();
                                  setTaskPendingDelete(task);
                                  setDeleteComment("");
                                }}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                          {isEditing ? (
                            <tr className="tracking-table-expanded-row">
                              <td colSpan={4}>
                                <div
                                  style={{
                                    display: "grid",
                                    gap: "0.85rem",
                                    padding: "1rem 0",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: "1rem",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <h5 style={{ margin: 0 }}>Editar tarea</h5>
                                    <div style={{ display: "flex", gap: "0.75rem" }}>
                                      <button
                                        type="button"
                                        className="soft-primary-button"
                                        style={{ background: "transparent", color: "var(--text-color)" }}
                                        onClick={() => {
                                          setEditingTaskId(null);
                                          setEditingTaskForm(buildTaskForm());
                                        }}
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        type="button"
                                        className="soft-primary-button"
                                        onClick={() => handleUpdateTask(task)}
                                        disabled={upsertTaskMutation.isPending}
                                      >
                                        {upsertTaskMutation.isPending ? "Guardando..." : "Guardar cambios"}
                                      </button>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                      gap: "0.85rem",
                                    }}
                                  >
                                    <label style={{ display: "grid", gap: "0.35rem" }}>
                                      <span className="tracking-filter-caption">Área responsable</span>
                                      <input
                                        className="search-input"
                                        value={editingTaskForm.area_responsible}
                                        onChange={(event) =>
                                          handleEditingTaskFieldChange("area_responsible", event.target.value)
                                        }
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: "0.35rem" }}>
                                      <span className="tracking-filter-caption">Rol responsable</span>
                                      <input
                                        className="search-input"
                                        value={editingTaskForm.role_responsible}
                                        onChange={(event) =>
                                          handleEditingTaskFieldChange("role_responsible", event.target.value)
                                        }
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: "0.35rem", gridColumn: "1 / -1" }}>
                                      <span className="tracking-filter-caption">Nombre</span>
                                      <input
                                        className="search-input"
                                        value={editingTaskForm.task_name}
                                        onChange={(event) =>
                                          handleEditingTaskFieldChange("task_name", event.target.value)
                                        }
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: "0.35rem", gridColumn: "1 / -1" }}>
                                      <span className="tracking-filter-caption">Descripción</span>
                                      <textarea
                                        className="search-input"
                                        rows={3}
                                        value={editingTaskForm.task_description}
                                        onChange={(event) =>
                                          handleEditingTaskFieldChange("task_description", event.target.value)
                                        }
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: "0.35rem" }}>
                                      <span className="tracking-filter-caption">SLA (horas)</span>
                                      <input
                                        className="search-input"
                                        type="number"
                                        min={1}
                                        value={editingTaskForm.sla_hours}
                                        onChange={(event) =>
                                          handleEditingTaskFieldChange("sla_hours", event.target.value)
                                        }
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: "0.35rem" }}>
                                      <span className="tracking-filter-caption">Tipo de evidencia</span>
                                      <input
                                        className="search-input"
                                        value={editingTaskForm.evidence_type}
                                        onChange={(event) =>
                                          handleEditingTaskFieldChange("evidence_type", event.target.value)
                                        }
                                        disabled={!editingTaskForm.requires_evidence}
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: "0.35rem", gridColumn: "1 / -1" }}>
                                      <span className="tracking-filter-caption">Comentario de auditoría (opcional)</span>
                                      <input
                                        className="search-input"
                                        value={editingTaskForm.comment}
                                        onChange={(event) =>
                                          handleEditingTaskFieldChange("comment", event.target.value)
                                        }
                                      />
                                    </label>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "1rem",
                                        flexWrap: "wrap",
                                        gridColumn: "1 / -1",
                                      }}
                                    >
                                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <input
                                          type="checkbox"
                                          checked={editingTaskForm.is_required}
                                          onChange={(event) =>
                                            handleEditingTaskFieldChange("is_required", event.target.checked)
                                          }
                                        />
                                        <span className="tracking-filter-caption">Requerida</span>
                                      </label>
                                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <input
                                          type="checkbox"
                                          checked={editingTaskForm.is_blocking}
                                          onChange={(event) =>
                                            handleEditingTaskFieldChange("is_blocking", event.target.checked)
                                          }
                                        />
                                        <span className="tracking-filter-caption">Bloqueante</span>
                                      </label>
                                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <input
                                          type="checkbox"
                                          checked={editingTaskForm.requires_evidence}
                                          onChange={(event) =>
                                            handleEditingTaskFieldChange("requires_evidence", event.target.checked)
                                          }
                                        />
                                        <span className="tracking-filter-caption">Requiere evidencia</span>
                                      </label>
                                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <input
                                          type="checkbox"
                                          checked={editingTaskForm.is_active}
                                          onChange={(event) =>
                                            handleEditingTaskFieldChange("is_active", event.target.checked)
                                          }
                                        />
                                        <span className="tracking-filter-caption">Activa</span>
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
