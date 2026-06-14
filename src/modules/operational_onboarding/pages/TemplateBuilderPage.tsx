import { useState } from "react";
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
    return <div className="module-page-layout">Cargando constructor...</div>;
  }

  return (
    <div className="builder-layout">
      <header className="builder-header">
        <div className="builder-title-row">
          <button
            className="back-btn"
            onClick={() => navigate("/alta-operacional/templates")}
            title="Volver a la galería"
          >
            ← Volver
          </button>
          <h1>Configuración de Workflow: {template.name}</h1>
        </div>
        <p className="text-gray-500 mb-4">{template.description}</p>

        <div className="flex gap-4">
          <button className="btn-primary" onClick={handleAddNewArea}>
            + Agregar Área
          </button>
          <button className="btn-secondary">
            Editar Detalles del Workflow
          </button>
        </div>
      </header>

      <div className="departments-board">
        {tasksLoading ? (
          <div>Cargando tareas del workflow...</div>
        ) : Object.keys(tasksByArea).length === 0 ? (
          <div className="empty-lane">
            <p>
              Aún no hay áreas ni tareas configuradas. Comienza agregando un
              área.
            </p>
          </div>
        ) : (
          Object.entries(tasksByArea).map(([area, areaTasks]) => (
            <div key={area} className="department-lane">
              <div className="department-header">
                <h3>
                  {area}{" "}
                  <span className="text-gray-400 font-normal ml-2">
                    ({areaTasks.length})
                  </span>
                </h3>
                <button
                  className="btn-secondary text-sm py-1"
                  onClick={() => handleAddTask(area)}
                >
                  + Añadir Tarea
                </button>
              </div>
              <div className="department-tasks">
                {areaTasks.map((task) => (
                  <div key={task.id} className="task-card">
                    <div className="task-card-header">
                      <h4 className="task-title">{task.task_name}</h4>
                      <div className="task-actions">
                        <button
                          className="icon-btn"
                          onClick={() => alert("Modal de Edición próximamente")}
                        >
                          ✏️
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {task.task_description && (
                      <p className="text-sm text-gray-500 line-clamp-2 m-0">
                        {task.task_description}
                      </p>
                    )}
                    <div className="task-badges">
                      {task.is_blocking && (
                        <span className="task-badge badge-blocking">
                          Bloqueante
                        </span>
                      )}
                      {task.requires_evidence && (
                        <span className="task-badge badge-evidence">
                          Evidencia: {task.evidence_type || "Archivo"}
                        </span>
                      )}
                      {task.sla_hours && (
                        <span className="task-badge badge-sla">
                          SLA: {task.sla_hours}h
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
