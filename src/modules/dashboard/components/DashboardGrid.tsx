import React from "react";
import type { ResolvedWidget } from "../types";
import { AlertsWidget } from "./widgets/AlertsWidget";
import { TasksWidget } from "./widgets/TasksWidget";
import { KPIWidget } from "./widgets/KPIWidget";
import { QuickActionsWidget } from "./widgets/QuickActionsWidget";
import { TimelineWidget } from "./widgets/TimelineWidget";

// Component mapping registry
const WidgetRegistry: Record<string, React.FC<any>> = {
  AlertsWidget,
  TasksWidget,
  KPIWidget,
  QuickActionsWidget,
  TimelineWidget,
};

interface DashboardGridProps {
  widgets: ResolvedWidget[];
  isLoading: boolean;
  dashboardData?: {
    tasksData: any[];
    alertsData: any[];
    kpisData: any;
  };
  onAction?: (actionType: string, payload: any) => void;
}

export function DashboardGrid({ widgets, isLoading, dashboardData, onAction }: DashboardGridProps) {
  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <p className="helper-copy">Cargando tu centro de mando...</p>
      </div>
    );
  }

  const visibleWidgets = widgets.filter((w) => !w.hidden);

  if (visibleWidgets.length === 0) {
    return (
      <article className="reference-card">
        <div className="section-head">
          <h3>Sin información</h3>
          <p className="helper-copy">No hay widgets activos para tu perfil.</p>
        </div>
      </article>
    );
  }

  // Z-Pattern Layout strategy
  const alerts = visibleWidgets.filter((w) => w.component_key === "AlertsWidget");
  const kpis = visibleWidgets.filter((w) => w.component_key === "KPIWidget");
  const mainCol = visibleWidgets.filter((w) => w.component_key === "TasksWidget");
  const sideCol = visibleWidgets.filter((w) => ["QuickActionsWidget", "TimelineWidget"].includes(w.component_key));

  return (
    <div className="dashboard-grid">
      {/* Zone 1: Alerts and Tasks (Side by Side) */}
      <div className="dashboard-zone" style={{ display: 'flex', gap: 'var(--spacing-6)' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          {alerts.map((w) => {
            const Component = WidgetRegistry[w.component_key];
            return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onAction={onAction} /> : null;
          })}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          {mainCol.map((w) => {
            const Component = WidgetRegistry[w.component_key];
            return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onAction={onAction} /> : null;
          })}
        </div>
      </div>

      {/* Zone 2: Other Widgets (Quick Actions, Timeline, etc) */}
      {sideCol.length > 0 && (
        <div className="dashboard-split-layout" style={{ marginTop: 'var(--spacing-6)' }}>
          <div className="dashboard-col dashboard-col--main">
            {/* Empty space or future widgets */}
          </div>
          <div className="dashboard-col dashboard-col--side">
            {sideCol.map((w) => {
              const Component = WidgetRegistry[w.component_key];
              return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onAction={onAction} /> : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
