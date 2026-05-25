import type { DashboardDataBundle, DashboardKpis, ResolvedWidget } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";

const emptyKpis: DashboardKpis = {
  total_vacancies: 0,
  active_cases: 0,
  pending_approvals: 0,
  ready_to_hire_cases: 0,
  expiring_documents: 0
};

export function KPIWidget({
  widget,
  dashboardData
}: {
  widget: ResolvedWidget;
  dashboardData?: DashboardDataBundle;
}) {
  const kpis = dashboardData?.kpisData ?? emptyKpis;
  const pendingApprovalsWidth = kpis.pending_approvals > 0 ? "50%" : "0%";
  const readyToHireWidth = kpis.ready_to_hire_cases > 0 ? "100%" : "0%";
  const expiringDocsWidth = kpis.expiring_documents > 0 ? "100%" : "0%";

  return (
    <DashboardWidgetFrame title={widget.name} className="widget-kpi">
      <div className="nx-kpi-grid">
        <div className="nx-kpi-box">
          <div className="nx-kpi-main">
            <span className="nx-kpi-value">{kpis.total_vacancies}</span>
            <span className="nx-kpi-label">Vacantes Activas</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Casos Activos</span>
            <div className="nx-bar-track">
              <div className="nx-bar-fill blue nx-bar-fill-full"></div>
            </div>
            <span className="nx-bar-value">{kpis.active_cases}</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Pendientes Aprob.</span>
            <div className="nx-bar-track">
              <div className="nx-bar-fill yellow" style={{ width: pendingApprovalsWidth }}></div>
            </div>
            <span className="nx-bar-value">{kpis.pending_approvals}</span>
          </div>
        </div>

        <div className="nx-kpi-box">
          <div className="nx-kpi-main">
            <span className="nx-kpi-value">{kpis.ready_to_hire_cases}</span>
            <span className="nx-kpi-label">Listos para contratar</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Ready</span>
            <div className="nx-bar-track">
              <div className="nx-bar-fill green" style={{ width: readyToHireWidth }}></div>
            </div>
            <span className="nx-bar-value">{kpis.ready_to_hire_cases}</span>
          </div>
          <div className="nx-bar-row">
            <span className="nx-bar-label">Docs por vencer</span>
            <div className="nx-bar-track">
              <div className="nx-bar-fill red" style={{ width: expiringDocsWidth }}></div>
            </div>
            <span className="nx-bar-value">{kpis.expiring_documents}</span>
          </div>
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}
