import { useCallback, useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { PageShell } from "../../../shared/ui";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { hasFeatureAccess, hasModuleAccess } from "../../auth/config/access";
import { useAuth } from "../../auth/context/AuthContext";
import { useHrIncentiveSetupCatalogs } from "../hooks/useIncentivesQueries";
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
  const { accessibleFeatures, accessibleModules, isSuperAdmin } = useAuth();
  const activeView = isHumanResourcesView(view) ? view : "incentivos";
  const visibleViews = useMemo(
    () =>
      HUMAN_RESOURCES_VIEWS.filter((item) => {
        if (isSuperAdmin) {
          return true;
        }

        if (!hasModuleAccess(accessibleModules, "recursos_humanos")) {
          return false;
        }

        if (item.key === "incentivos") {
          return hasFeatureAccess(accessibleFeatures, "hr_incentives_register");
        }

        if (item.key === "aprobaciones") {
          return hasFeatureAccess(accessibleFeatures, "hr_incentives_approvals");
        }

        if (item.key === "solicitudes") {
          return hasFeatureAccess(accessibleFeatures, "hr_incentives_history");
        }

        return hasFeatureAccess(accessibleFeatures, "hr_incentives_configuration");
      }),
    [accessibleFeatures, accessibleModules, isSuperAdmin]
  );
  const fallbackView = visibleViews[0]?.key ?? null;
  const setupCatalogsQuery = useHrIncentiveSetupCatalogs(
    Boolean(fallbackView) &&
      (activeView === "incentivos" || activeView === "solicitudes" || activeView === "configuracion")
  );
  const incentivesRealtimeSubscriptions = useMemo(() => {
    if (activeView === "configuracion" || activeView === "incentivos") {
      return [
        { table: "hr_incentive_allowed_job_titles" },
        { table: "hr_incentive_types" },
        { table: "hr_incentive_rate_rules" }
      ];
    }

    return [
      { table: "hr_incentive_requests" },
      { table: "hr_incentive_request_approvals" },
      { table: "hr_incentive_request_history" }
    ];
  }, [activeView]);

  const invalidateIncentives = useCallback(async () => {
    if (activeView === "configuracion" || activeView === "incentivos") {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.incentives.setupCatalogs()
      });
      return;
    }

    const invalidations = [
      queryClient.invalidateQueries({ queryKey: queryKeys.incentives.requestsRoot() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.incentives.requestDetailRoot() })
    ];

    if (activeView === "aprobaciones") {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: queryKeys.incentives.approvalsRoot() })
      );
    }

    await Promise.all(invalidations);
  }, [activeView, queryClient]);

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

  if (!visibleViews.some((item) => item.key === activeView)) {
    return <Navigate to={`/recursos-humanos/${fallbackView}`} replace />;
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
