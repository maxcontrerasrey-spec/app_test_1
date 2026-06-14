import { useOnboardingActivityLog } from "../../hooks/useOnboardingActivityLog";
import type { OnboardingActivityLogRow } from "../../hooks/useOnboardingActivityLog";

export function SequencesTab() {
  const { data: logs, isLoading, isError, error } = useOnboardingActivityLog();

  if (isLoading) {
    return (
      <section className="info-card">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p className="tracking-empty-state">
            Cargando bitácora de secuencias...
          </p>
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

  const renderLogItem = (log: OnboardingActivityLogRow) => {
    const candidateName = log.cases?.candidates
      ? `${log.cases.candidates.full_name}`
      : log.cases?.employees
        ? `${log.cases.employees.full_name}`
        : "Candidato Desconocido";

    const date = new Date(log.created_at).toLocaleString("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    let icon = "📝";
    if (log.action.includes("cread") || log.action.includes("created"))
      icon = "✨";
    if (log.action.includes("completad") || log.action.includes("completed"))
      icon = "✅";
    if (log.action.includes("rechazad") || log.action.includes("rejected"))
      icon = "❌";
    if (log.action.includes("bloqueo")) icon = "⛔";

    return (
      <div
        key={log.id}
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          position: "relative",
        }}
      >
        {/* Línea vertical para el timeline */}
        <div
          style={{
            position: "absolute",
            top: "2.5rem",
            bottom: "-1.5rem",
            left: "1rem",
            width: "2px",
            background: "var(--border-color)",
            zIndex: 0,
          }}
        ></div>

        <div
          style={{
            width: "2.2rem",
            height: "2.2rem",
            borderRadius: "50%",
            background: "var(--surface-color)",
            border: "2px solid var(--brand-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div
          style={{
            background: "var(--surface-sunken)",
            border: "1px solid var(--border-color)",
            padding: "1rem",
            borderRadius: "0.5rem",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "0.5rem",
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: "1rem",
                color: "var(--text-color)",
              }}
            >
              {log.action}
            </h4>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {date}
            </span>
          </div>

          <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
            Candidato/Empleado: <strong>{candidateName}</strong>
          </p>

          {log.tasks && (
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
              Tarea: <strong>{log.tasks.task_name}</strong>
            </p>
          )}

          {log.comment && (
            <p
              style={{
                margin: "0 0 0.5rem",
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              "{log.comment}"
            </p>
          )}

          <div
            style={{
              marginTop: "1rem",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <span>
              👤 Por:{" "}
              {log.profiles
                ? `${log.profiles.full_name}`
                : "Sistema Automático"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="info-card">
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Secuencias y Trazabilidad (Timeline)</h3>
          <span className="tracking-filter-caption">
            Bitácora auditada de todas las acciones, cambios de estado y flujos
            del sistema de alta operacional.
          </span>
        </div>
      </div>

      <div style={{ padding: "2rem" }}>
        {!logs || logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p className="tracking-empty-state">
              No hay registros de actividad aún.
            </p>
          </div>
        ) : (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            {logs.map(renderLogItem)}
          </div>
        )}
      </div>
    </section>
  );
}
