import type { DashboardAlertItem, DashboardDataBundle, ResolvedWidget } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";

export function AlertsWidget({
  widget,
  dashboardData
}: {
  widget: ResolvedWidget;
  dashboardData?: DashboardDataBundle;
}) {
  const alerts = dashboardData?.alertsData ?? [];

  return (
    <DashboardWidgetFrame title={widget.name} className="widget-alert widget-fill-width">
      <div className="nx-alerts-grid">
        {alerts.length === 0 ? (
          <p className="helper-copy widget-empty-copy">
            No hay alertas activas en este momento.
          </p>
        ) : (
          alerts.map((alert: DashboardAlertItem) => (
            <div key={alert.id} className={`nx-alert-item ${alert.severity}`}>
              <p className="nx-alert-title">{alert.title}</p>
              <p className="nx-alert-desc">{alert.description}</p>
              <p className="nx-alert-meta">Generado: {new Date(alert.created_at).toLocaleDateString()} · {alert.source}</p>
            </div>
          ))
        )}
      </div>
    </DashboardWidgetFrame>
  );
}
