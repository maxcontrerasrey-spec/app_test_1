import { useCallback, useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "../../../shared/ui";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { hasModuleAccess } from "../../auth/config/access";
import { useAuth } from "../../auth/context/AuthContext";
import {
  invalidateHrIncentiveQueries,
  useHrIncentiveSetupCatalogs
} from "../hooks/useIncentivesQueries";
import { canViewHrIncentiveAnalytics } from "../lib/analyticsAccess";
import { IncentiveRegistrationForm } from "../components/IncentiveRegistrationForm";
import { IncentiveApprovalsView } from "../components/IncentiveApprovalsView";
import { IncentiveRequestsView } from "../components/IncentiveRequestsView";
import { IncentiveSetupView } from "../components/IncentiveSetupView";
import "../styles/incentives.css";

const HUMAN_RESOURCES_VIEWS = [
  {
    key: "incentivos",
    label: "Registrar incentivo",
    description: "Genera incentivos sobre trabajadores elegibles y calcula el monto desde reglas."
  },
  {
    key: "aprobaciones",
    label: "Aprobaciones",
    description:
      "Resuelve la doble aprobación de incentivos pendientes por administrador de contrato y gerencia."
  },
  {
    key: "solicitudes",
    label: "Historial",
    description: "Consulta incentivos ya registrados, su monto y su trazabilidad básica."
  },
  {
    key: "configuracion",
    label: "Configuración base",
    description: "Administra cargos elegibles, tipos de incentivo y reglas de cálculo."
  }
] as const;

type HumanResourcesViewKey = (typeof HUMAN_RESOURCES_VIEWS)[number]["key"];

function isHumanResourcesView(value: string | undefined): value is HumanResourcesViewKey {
  return HUMAN_RESOURCES_VIEWS.some((view) => view.key === value);
}

export function HumanResourcesDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { view } = useParams();
  const { accessibleModules, appRoles, isSuperAdmin } = useAuth();
  const activeView = isHumanResourcesView(view) ? view : "incentivos";
  const canViewAnalytics = canViewHrIncentiveAnalytics({ appRoles, isSuperAdmin });
  const canManageStandardViews =
    isSuperAdmin || hasModuleAccess(accessibleModules, "recursos_humanos");
  const visibleViews = useMemo(
    () => (canManageStandardViews ? HUMAN_RESOURCES_VIEWS : []),
    [canManageStandardViews]
  );
  const fallbackView = canManageStandardViews ? "incentivos" : null;
  const setupCatalogsQuery = useHrIncentiveSetupCatalogs(
    canManageStandardViews &&
      (activeView === "incentivos" || activeView === "solicitudes" || activeView === "configuracion")
  );

  const activeViewMeta = useMemo(
    () => visibleViews.find((item) => item.key === activeView) ?? visibleViews[0] ?? HUMAN_RESOURCES_VIEWS[0],
    [activeView, visibleViews]
  );
  const incentivesRealtimeSubscriptions = useMemo(
    () => [
      { table: "hr_incentive_allowed_job_titles" },
      { table: "hr_incentive_types" },
      { table: "hr_incentive_rate_rules" },
      { table: "hr_incentive_requests" },
      { table: "hr_incentive_request_approvals" },
      { table: "hr_incentive_request_history" },
      { table: "employees" }
    ],
    []
  );

  const invalidateIncentives = useCallback(async () => {
    await invalidateHrIncentiveQueries(queryClient);
  }, [queryClient]);

  useRealtimeQueryInvalidation({
    channelName: `hr-incentives:${activeView}`,
    invalidate: invalidateIncentives,
    subscriptions: incentivesRealtimeSubscriptions
  });

  if (view && !isHumanResourcesView(view)) {
    return <Navigate to="/recursos-humanos/incentivos" replace />;
  }

  if (!fallbackView) {
    return <Navigate to="/sin-acceso" replace />;
  }



  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Incentivos Extraordinarios</h1>
      </div>

      <section className="tracking-panel">
        <div className="approval-chip-row">
          {visibleViews.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`approval-chip ${activeView === item.key ? "tracking-kpi-card-active" : ""}`}
              onClick={() => navigate(`/recursos-humanos/${item.key}`)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {activeView === "incentivos" ? (
          <IncentiveRegistrationForm setupCatalogsQuery={setupCatalogsQuery} />
        ) : null}

        {activeView === "aprobaciones" ? <IncentiveApprovalsView /> : null}

        {activeView === "solicitudes" ? (
          <IncentiveRequestsView setupCatalogsQuery={setupCatalogsQuery} />
        ) : null}

        {activeView === "configuracion" ? (
          <IncentiveSetupView setupCatalogsQuery={setupCatalogsQuery} />
        ) : null}
      </section>
    </PageShell>
  );
}
