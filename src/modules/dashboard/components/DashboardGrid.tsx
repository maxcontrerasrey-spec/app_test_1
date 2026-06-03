import React from "react";
import type { DashboardDataBundle, ResolvedWidget } from "../types";
import { ActiveFoliosWidget } from "./widgets/ActiveFoliosWidget";
import { ApprovalTrackingWidget } from "./widgets/ApprovalTrackingWidget";
import { TasksWidget } from "./widgets/TasksWidget";

type WidgetComponentProps = {
  widget: ResolvedWidget;
  dashboardData?: DashboardDataBundle;
  onRefresh?: () => void;
};

const WidgetRegistry: Record<string, React.FC<WidgetComponentProps>> = {
  ApprovalTrackingWidget,
  TasksWidget
};

interface DashboardGridProps {
  widgets: ResolvedWidget[];
  isLoading: boolean;
  dashboardData?: DashboardDataBundle;
  onRefresh?: () => void;
}

function buildDerivedWidget(source: ResolvedWidget, id: string, name: string, componentKey: string): ResolvedWidget {
  return {
    ...source,
    id,
    name,
    component_key: componentKey
  };
}

export function DashboardGrid({ widgets, isLoading, dashboardData, onRefresh }: DashboardGridProps) {
  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <p className="helper-copy">Cargando tu centro de mando...</p>
      </div>
    );
  }

  const visibleWidgets = widgets.filter((w) => !w.hidden);
  const renderableWidgets = visibleWidgets.filter((w) => w.component_key === "TasksWidget");

  if (renderableWidgets.length === 0) {
    return (
      <article className="reference-card">
        <div className="section-head">
          <h3>Sin información</h3>
          <p className="helper-copy">No hay widgets activos para tu perfil.</p>
        </div>
      </article>
    );
  }

  const tasks = renderableWidgets;
  const sourceWidget = tasks[0] ?? null;
  const approvalTrackingWidget = sourceWidget
    ? buildDerivedWidget(
        sourceWidget,
        "dashboard-approval-tracking",
        "Seguimiento de aprobaciones",
        "ApprovalTrackingWidget"
      )
    : null;
  const activeFoliosWidget = sourceWidget
    ? buildDerivedWidget(
        sourceWidget,
        "dashboard-active-folios",
        "Folios en curso",
        "ActiveFoliosWidget"
      )
    : null;

  return (
    <div className="dashboard-grid">
      {tasks.length > 0 && (
        <div className="dashboard-zone dashboard-zone-full dashboard-module-section">
          <div className="dashboard-zone-column">
            {tasks.map((w) => {
              const Component = WidgetRegistry[w.component_key];
              return Component ? <Component key={w.id} widget={w} dashboardData={dashboardData} onRefresh={onRefresh} /> : null;
            })}
          </div>
        </div>
      )}

      {approvalTrackingWidget ? (
        <div className="dashboard-zone dashboard-zone-full dashboard-module-section">
          <div className="dashboard-zone-column">
            <ApprovalTrackingWidget widget={approvalTrackingWidget} dashboardData={dashboardData} />
          </div>
        </div>
      ) : null}

      {activeFoliosWidget ? (
        <div className="dashboard-zone dashboard-zone-full dashboard-module-section">
          <div className="dashboard-zone-column">
            <ActiveFoliosWidget widget={activeFoliosWidget} dashboardData={dashboardData} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
