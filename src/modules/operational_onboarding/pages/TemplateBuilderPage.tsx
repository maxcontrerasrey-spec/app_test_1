import { useSearchParams, useNavigate } from "react-router-dom";
import {
  useTemplates,
  useTemplateTasks,
  useUpsertTemplateTask,
  useDeleteTemplateTask,
} from "../hooks/useTemplateQueries";
import type { OnboardingTemplateTask } from "../types";

export function TemplateBuilderPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const navigate = useNavigate();
  const { data: templates } = useTemplates();
  const { data: tasks, isLoading: tasksLoading } = useTemplateTasks(id || "");

  const upsertTaskMutation = useUpsertTemplateTask();
  const deleteTaskMutation = useDeleteTemplateTask();

  const template = templates?.find((t) => t.id === id);

  // Agrupar tareas por departamento
  const tasksByArea =
    tasks?.reduce(
      (acc, task) => {
        if (!acc[task.area_responsible]) {
          acc[task.area_responsible] = [];
        }
        acc[task.area_responsible].push(task);
        return acc;
      },
      {} as Record<string, OnboardingTemplateTask[]>,
    ) || {};

  const handleAddTask = async (area: string) => {
    if (!id) return;
    const taskName = prompt(`Nueva tarea para el área: ${area}`);
    if (!taskName) return;

    await upsertTaskMutation.mutateAsync({
      template_id: id,
      area_responsible: area,
      task_name: taskName,
      task_description: "",
      is_required: true,
      is_blocking: true,
      requires_evidence: false,
      evidence_type: null,
      sla_hours: 24,
      order_index: (tasksByArea[area]?.length || 0) + 1,
      is_active: true,
    });
  };

  const handleAddNewArea = () => {
    if (!id) return;
    const area = prompt("Nombre de la nueva Área/Departamento:");
    if (area) {
      handleAddTask(area);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!id || !confirm("¿Seguro que deseas eliminar esta tarea?")) return;
    await deleteTaskMutation.mutateAsync({ id: taskId, templateId: id });
  };

  if (!template) {
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
            {template.description ||
              "Agrega tareas a esta plantilla para definir el proceso de alta."}
          </span>
        </div>
        <div className="hr-incentives-history-actions">
          <button
            type="button"
            className="soft-primary-button"
            onClick={handleAddNewArea}
          >
            + Agregar Área
          </button>
          <button
            type="button"
            className="soft-primary-button"
            style={{ marginLeft: "0.5rem" }}
          >
            Editar Workflow
          </button>
        </div>
      </div>

      <div style={{ padding: "0 1.5rem 1.5rem" }}>
        {tasksLoading ? (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <p className="tracking-empty-state">Cargando tareas...</p>
          </div>
        ) : Object.keys(tasksByArea).length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <p className="tracking-empty-state">
              Aún no hay áreas ni tareas configuradas en esta plantilla.
            </p>
            <button
              type="button"
              className="soft-primary-button"
              style={{ marginTop: "1rem" }}
              onClick={handleAddNewArea}
            >
              Comenzar agregando un Área
            </button>
          </div>
        ) : (
          Object.entries(tasksByArea).map(([area, areaTasks]) => (
            <div key={area} style={{ marginBottom: "2rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
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
                  style={{ padding: "0.25rem 0.75rem", fontSize: "0.85rem" }}
                  onClick={() => handleAddTask(area)}
                >
                  + Añadir Tarea
                </button>
              </div>

              <div className="tracking-table-container">
                <table className="tracking-table hr-incentives-table">
                  <thead>
                    <tr>
                      <th>Nombre de la Tarea</th>
                      <th>Descripción</th>
                      <th>Condiciones</th>
                      <th style={{ width: "80px", textAlign: "right" }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaTasks.map((task) => (
                      <tr key={task.id}>
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
                            {task.is_blocking && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  background:
                                    "var(--status-danger-light, #fee2e2)",
                                  color: "var(--status-danger, #ef4444)",
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: "100px",
                                  fontWeight: 600,
                                }}
                              >
                                Bloqueante
                              </span>
                            )}
                            {task.requires_evidence && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  background:
                                    "var(--status-info-light, #e0f2fe)",
                                  color: "var(--status-info, #0284c7)",
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: "100px",
                                  fontWeight: 600,
                                }}
                              >
                                Evidencia
                              </span>
                            )}
                            {task.sla_hours && (
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
                                SLA: {task.sla_hours}h
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "1.1rem",
                              padding: "0.2rem",
                            }}
                            onClick={() =>
                              alert("Modal de Edición próximamente")
                            }
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "1.1rem",
                              padding: "0.2rem",
                              marginLeft: "0.5rem",
                            }}
                            onClick={() => handleDeleteTask(task.id)}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
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
