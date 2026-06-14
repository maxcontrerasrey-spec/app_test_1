import { useOnboardingTasks } from "../../hooks/useOnboardingTasks";
import type { OnboardingTaskRow } from "../../hooks/useOnboardingTasks";

export function TasksTab() {
  const { data: tasks, isLoading, isError, error } = useOnboardingTasks();

  if (isLoading) {
    return (
      <section className="info-card">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p className="tracking-empty-state">Cargando tareas...</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="info-card">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p className="form-status form-status-error">
            {(error as Error).message}
          </p>
        </div>
      </section>
    );
  }

  const pendingTasks =
    tasks?.filter((t) => t.status === "pending") || [];
  const inProgressTasks =
    tasks?.filter((t) => t.status === "in_progress") || [];
  const completedTasks =
    tasks?.filter(
      (t) =>
        t.status === "completed" ||
        t.status === "not_applicable" ||
        t.status === "rejected" ||
        t.status === "expired",
    ) || [];

  const renderTaskCard = (task: OnboardingTaskRow) => {
    const candidateName = task.cases?.candidates
      ? `${task.cases.candidates.full_name}`
      : task.cases?.employees
        ? `${task.cases.employees.full_name}`
        : "Candidato Desconocido";

    return (
      <div
        key={task.id}
        style={{
          background: "var(--surface-color, #ffffff)",
          border: "1px solid var(--border-color)",
          borderRadius: "0.5rem",
          padding: "1rem",
          marginBottom: "1rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "0.5rem",
          }}
        >
          <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
            {task.task_name}
          </h4>
        </div>

        <p
          style={{
            margin: "0 0 0.5rem",
            fontSize: "0.85rem",
            color: "var(--text-muted)",
          }}
        >
          Para: <strong>{candidateName}</strong>
        </p>

        {task.task_description && (
          <p
            style={{
              margin: "0 0 1rem",
              fontSize: "0.8rem",
              color: "var(--text-color)",
            }}
          >
            {task.task_description}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: "1rem",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              background: "var(--surface-sunken)",
              padding: "0.2rem 0.5rem",
              borderRadius: "4px",
              fontWeight: 600,
            }}
          >
            {task.area_responsible}
          </span>
          {task.is_blocking && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--status-danger)",
                fontWeight: 600,
              }}
            >
              • Bloqueante
            </span>
          )}
          {task.status === "expired" && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--status-danger)",
                fontWeight: 600,
              }}
            >
              • Vencida
            </span>
          )}
          {task.status === "not_applicable" && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              • No aplica
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        height: "100%",
      }}
    >
      <div
        className="tracking-toolbar"
        style={{
          background: "var(--surface-color)",
          padding: "1rem 1.5rem",
          borderRadius: "0.5rem",
          border: "1px solid var(--border-color)",
        }}
      >
        <div className="tracking-toolbar-copy">
          <h3>Tablero de Tareas</h3>
          <span className="tracking-filter-caption">
            Gestiona y haz seguimiento a las tareas operacionales en curso.
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "var(--surface-sunken, #f8fafc)",
            padding: "1rem",
            borderRadius: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "1rem",
                color: "var(--text-color)",
              }}
            >
              Pendientes
            </h3>
            <span
              style={{
                background: "var(--border-color)",
                padding: "0.1rem 0.6rem",
                borderRadius: "1rem",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {pendingTasks.length}
            </span>
          </div>
          <div>
            {pendingTasks.length === 0 ? (
              <p
                className="tracking-empty-state"
                style={{ fontSize: "0.85rem" }}
              >
                No hay tareas pendientes.
              </p>
            ) : (
              pendingTasks.map(renderTaskCard)
            )}
          </div>
        </div>

        <div
          style={{
            background: "var(--surface-sunken, #f8fafc)",
            padding: "1rem",
            borderRadius: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "1rem",
                color: "var(--brand-primary)",
              }}
            >
              En Progreso
            </h3>
            <span
              style={{
                background: "var(--brand-primary-light, #e0e7ff)",
                color: "var(--brand-primary)",
                padding: "0.1rem 0.6rem",
                borderRadius: "1rem",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {inProgressTasks.length}
            </span>
          </div>
          <div>
            {inProgressTasks.length === 0 ? (
              <p
                className="tracking-empty-state"
                style={{ fontSize: "0.85rem" }}
              >
                No hay tareas en progreso.
              </p>
            ) : (
              inProgressTasks.map(renderTaskCard)
            )}
          </div>
        </div>

        <div
          style={{
            background: "var(--surface-sunken, #f8fafc)",
            padding: "1rem",
            borderRadius: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "1rem",
                color: "var(--status-success)",
              }}
            >
              Completadas
            </h3>
            <span
              style={{
                background: "var(--status-success-light, #dcfce7)",
                color: "var(--status-success)",
                padding: "0.1rem 0.6rem",
                borderRadius: "1rem",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {completedTasks.length}
            </span>
          </div>
          <div>
            {completedTasks.length === 0 ? (
              <p
                className="tracking-empty-state"
                style={{ fontSize: "0.85rem" }}
              >
                No hay tareas completadas.
              </p>
            ) : (
              completedTasks.map(renderTaskCard)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
