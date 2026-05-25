import type { DashboardDataBundle, DashboardTaskItem, ResolvedWidget } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";

type TasksWidgetProps = {
  widget: ResolvedWidget;
  dashboardData?: DashboardDataBundle;
  onAction?: (actionType: string, payload: string) => void;
};

function getPriorityClass(priority: string) {
  if (priority === "Crítica") return "nx-priority-critical";
  if (priority === "Alta") return "nx-priority-warning";
  return "nx-priority-normal";
}

export function TasksWidget({ widget, dashboardData, onAction }: TasksWidgetProps) {
  const tasks = dashboardData?.tasksData ?? [];

  return (
    <DashboardWidgetFrame title={widget.name} className="widget-tasks widget-fill-height">
      <div className="nx-table-wrapper">
        <table className="nx-table">
          <thead>
            <tr>
              <th>Elemento ({tasks.length})</th>
              <th>Estado</th>
              <th className="nx-td-numeric">Prioridad</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="nx-table-empty">
                  Excelente, no tienes tareas pendientes.
                </td>
              </tr>
            ) : (
              tasks.map((task: DashboardTaskItem) => {
                const dotClass = task.status_code === "pending" ? "pending" :
                  task.status_code === "sourcing" ? "running" : "healthy";
                const isApproval = task.id.startsWith("approval_");

                return (
                  <tr 
                    key={task.id} 
                    className={onAction && isApproval ? "nx-table-row-actionable" : ""}
                    onClick={() => {
                      if (onAction && isApproval) {
                        onAction("OPEN_APPROVAL", task.id.replace("approval_", ""));
                      }
                    }}
                  >
                    <td className="nx-td-primary" title={task.title}>
                      {task.title}
                      <div className="nx-td-secondary">
                        {task.subtitle}
                      </div>
                    </td>
                    <td>
                      <span className="nx-status">
                        <span className={`nx-dot ${dotClass}`}></span> {task.status_label}
                      </span>
                    </td>
                    <td className={`nx-td-numeric ${getPriorityClass(task.priority)}`}>
                      {task.priority}
                    </td>
                    <td className="nx-td-action">
                      {isApproval ? (
                        <button 
                          className="soft-primary-button nx-inline-action-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onAction) {
                              onAction("OPEN_APPROVAL", task.id.replace("approval_", ""));
                            }
                          }}
                        >
                          Revisar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </DashboardWidgetFrame>
  );
}
