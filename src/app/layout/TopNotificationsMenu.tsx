import { useMemo } from "react";
import type { RefObject } from "react";
import { useNavigate } from "react-router-dom";
import type { DashboardTaskItem } from "../../modules/dashboard/types";
import {
  buildNotificationPreview,
  buildTaskSummary,
  resolveTaskNavigationPath
} from "../../modules/dashboard/lib/taskPresentation";

type TopNotificationsMenuProps = {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  tasks: DashboardTaskItem[];
  containerRef: RefObject<HTMLDivElement>;
};

export function TopNotificationsMenu({
  isOpen,
  onToggle,
  onClose,
  tasks,
  containerRef
}: TopNotificationsMenuProps) {
  const navigate = useNavigate();
  const pendingTasksCount = tasks.length;
  const pendingTaskPreview = useMemo(() => buildNotificationPreview(tasks), [tasks]);

  return (
    <div className="top-notifications-wrap" ref={containerRef}>
      <button
        type="button"
        className={`top-notifications-button ${isOpen ? "top-notifications-button-open" : ""}`}
        onClick={onToggle}
        aria-label={`Notificaciones${pendingTasksCount ? `, ${pendingTasksCount} tareas pendientes` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {pendingTasksCount > 0 ? (
          <span className="top-notifications-badge" aria-hidden="true">
            {pendingTasksCount > 99 ? "99+" : pendingTasksCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="top-notifications-menu" role="menu" aria-label="Resumen de tareas pendientes">
          <div className="top-notifications-header">
            <strong>Tareas pendientes</strong>
            <span>{pendingTasksCount > 0 ? `${pendingTasksCount} en cola` : "Sin pendientes"}</span>
          </div>

          {pendingTaskPreview.length > 0 ? (
            <div className="top-notifications-list">
              {pendingTaskPreview.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="top-notifications-item"
                  onClick={() => {
                    onClose();
                    navigate(resolveTaskNavigationPath(task));
                  }}
                >
                  <div className="top-notifications-item-copy">
                    <strong>{task.folio ?? ("step_name" in task ? task.step_name : null) ?? "Tarea pendiente"}</strong>
                    <span>{buildTaskSummary(task)}</span>
                  </div>
                  <small>{task.status_label}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="top-notifications-empty">No tienes tareas pendientes.</div>
          )}

          <button
            type="button"
            className="top-notifications-footer"
            onClick={() => {
              onClose();
              navigate("/");
            }}
          >
            Ver panel de inicio
          </button>
        </div>
      ) : null}
    </div>
  );
}
