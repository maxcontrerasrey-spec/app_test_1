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
      {/* Zone 1: Critical Priorities */}
      {alerts.length > 0 && (
        <div className="dashboard-zone dashboard-zone--alerts">
          {alerts.map((w) => {
            const Component = WidgetRegistry[w.component_key];
            return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} /> : null;
          })}
        </div>
      )}

      {/* Zone 3: KPIs Row */}
      {kpis.length > 0 && (
        <div className="dashboard-zone dashboard-zone--kpis">
          {kpis.map((w) => {
            const Component = WidgetRegistry[w.component_key];
            return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onAction={onAction} /> : null;
          })}
        </div>
      )}

      {/* Zone 2 & 4 & 5: My Work & Actions & Insights split layout */}
      <div className="dashboard-split-layout">
        <div className="dashboard-col dashboard-col--main">
          {mainCol.map((w) => {
            const Component = WidgetRegistry[w.component_key];
            return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onAction={onAction} /> : null;
          })}
        </div>
        <div className="dashboard-col dashboard-col--side">
          {sideCol.map((w) => {
            const Component = WidgetRegistry[w.component_key];
            return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onAction={onAction} /> : null;
          })}
        </div>
      </div>
    </div>
  );
}
