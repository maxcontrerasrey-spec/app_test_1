import React from "react";
import type { DashboardDataBundle, ResolvedWidget } from "../types";
import { AlertsWidget } from "./widgets/AlertsWidget";
import { TasksWidget } from "./widgets/TasksWidget";
import { KPIWidget } from "./widgets/KPIWidget";
import { QuickActionsWidget } from "./widgets/QuickActionsWidget";

type WidgetComponentProps = {
  widget: ResolvedWidget;
  dashboardData?: DashboardDataBundle;
  onAction?: (actionType: string, payload: string) => void;
};

const WidgetRegistry: Record<string, React.FC<WidgetComponentProps>> = {
  AlertsWidget,
  TasksWidget,
  KPIWidget,
  QuickActionsWidget,
};

interface DashboardGridProps {
  widgets: ResolvedWidget[];
  isLoading: boolean;
  dashboardData?: DashboardDataBundle;
  onAction?: (actionType: string, payload: string) => void;
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

  const tasks = visibleWidgets.filter((w) => w.component_key === "TasksWidget");
  const mainSecondary = visibleWidgets.filter(
    (w) => !["TasksWidget", "AlertsWidget", "QuickActionsWidget", "TimelineWidget"].includes(w.component_key)
  );
  const sideCol = visibleWidgets
    .filter((w) => ["QuickActionsWidget", "AlertsWidget"].includes(w.component_key))
    .sort((a, b) => {
      const order: Record<string, number> = {
        QuickActionsWidget: 1,
        AlertsWidget: 2
      };
      return (order[a.component_key] ?? 99) - (order[b.component_key] ?? 99);
    });

  return (
    <div className="dashboard-grid">
      {tasks.length > 0 ? (
        <div className="dashboard-zone dashboard-zone-full">
          <div className="dashboard-zone-column">
            {tasks.map((w) => {
              const Component = WidgetRegistry[w.component_key];
              return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onAction={onAction} /> : null;
            })}
          </div>
        </div>
      ) : null}

      {(mainSecondary.length > 0 || sideCol.length > 0) && (
        <div className="dashboard-split-layout dashboard-split-layout-spaced">
          <div className="dashboard-col dashboard-col--main">
            {mainSecondary.map((w) => {
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
      )}
    </div>
  );
}
