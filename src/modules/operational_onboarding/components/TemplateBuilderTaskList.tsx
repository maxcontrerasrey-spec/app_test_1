import { Fragment, type Dispatch, type SetStateAction } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { OnboardingTemplateTask, OnboardingTemplateTaskInput } from "../types";
import { buildTaskForm, type TaskFormState } from "../lib/templateBuilderForms";

type TemplateBuilderTaskListProps = {
  tasksLoading: boolean;
  tasksByArea: Record<string, OnboardingTemplateTask[]>;
  editingTaskId: string | null;
  editingTaskForm: TaskFormState;
  upsertTaskMutation: UseMutationResult<OnboardingTemplateTask, Error, OnboardingTemplateTaskInput, unknown>;
  clearFeedback: () => void;
  setNewTaskForm: Dispatch<SetStateAction<TaskFormState>>;
  setEditingTaskId: Dispatch<SetStateAction<string | null>>;
  setEditingTaskForm: Dispatch<SetStateAction<TaskFormState>>;
  setTaskPendingDelete: Dispatch<SetStateAction<OnboardingTemplateTask | null>>;
  setDeleteComment: Dispatch<SetStateAction<string>>;
  handleEditTask: (task: OnboardingTemplateTask) => void;
  handleUpdateTask: (task: OnboardingTemplateTask) => Promise<void>;
  handleEditingTaskFieldChange: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
};

export function TemplateBuilderTaskList({
  tasksLoading,
  tasksByArea,
  editingTaskId,
  editingTaskForm,
  upsertTaskMutation,
  clearFeedback,
  setNewTaskForm,
  setEditingTaskId,
  setEditingTaskForm,
  setTaskPendingDelete,
  setDeleteComment,
  handleEditTask,
  handleUpdateTask,
  handleEditingTaskFieldChange
}: TemplateBuilderTaskListProps) {
  return (
    <>
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
    </>
  );
}
