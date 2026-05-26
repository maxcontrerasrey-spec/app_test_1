import React from "react";
import type { DashboardDataBundle, ResolvedWidget } from "../types";
import { ActiveFoliosWidget } from "./widgets/ActiveFoliosWidget";
import { TasksWidget } from "./widgets/TasksWidget";
import { QuickActionsWidget } from "./widgets/QuickActionsWidget";

type WidgetComponentProps = {
  widget: ResolvedWidget;
  dashboardData?: DashboardDataBundle;
  onAction?: (actionType: string, payload: string) => void;
};

const WidgetRegistry: Record<string, React.FC<WidgetComponentProps>> = {
  TasksWidget,
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
  const quickActions = visibleWidgets.filter((w) => w.component_key === "QuickActionsWidget");
  const activeFoliosWidget: ResolvedWidget | null =
    tasks[0]
      ? {
          ...tasks[0],
          id: "dashboard-active-folios",
          name: "Folios en curso",
          component_key: "ActiveFoliosWidget"
        }
      : null;

  return (
    <div className="dashboard-grid">
      {tasks.length > 0 && (
        <div className="dashboard-zone dashboard-zone-full dashboard-module-section">
          <div className="dashboard-zone-column">
            {tasks.map((w) => {
              const Component = WidgetRegistry[w.component_key];
              return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onAction={onAction} /> : null;
            })}
          </div>
        </div>
      )}

      {activeFoliosWidget ? (
        <div className="dashboard-zone dashboard-zone-full dashboard-module-section">
          <div className="dashboard-zone-column">
            <ActiveFoliosWidget widget={activeFoliosWidget} dashboardData={dashboardData} />
          </div>
        </div>
      ) : null}

      {quickActions.length > 0 && (
        <div className="dashboard-secondary-row dashboard-split-layout-spaced dashboard-module-section">
          <div className="dashboard-col">
            {quickActions.map((w) => {
              const Component = WidgetRegistry[w.component_key];
              return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onAction={onAction} /> : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
