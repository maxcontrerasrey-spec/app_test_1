import { useCallback, useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "../../../shared/ui";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import {
  invalidateHrIncentiveQueries,
  useHrIncentiveSetupCatalogs
} from "../hooks/useIncentivesQueries";
import { IncentiveRegistrationForm } from "../components/IncentiveRegistrationForm";
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
  const activeView = isHumanResourcesView(view) ? view : "incentivos";
  const setupCatalogsQuery = useHrIncentiveSetupCatalogs();

  const activeViewMeta = useMemo(
    () => HUMAN_RESOURCES_VIEWS.find((item) => item.key === activeView) ?? HUMAN_RESOURCES_VIEWS[0],
    [activeView]
  );
  const incentivesRealtimeSubscriptions = useMemo(
    () => [
      { table: "hr_incentive_allowed_job_titles" },
      { table: "hr_incentive_types" },
      { table: "hr_incentive_rate_rules" },
      { table: "hr_incentive_requests" },
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

  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Incentivos Extraordinarios</h1>
      </div>

      <section className="tracking-panel">
        <div className="approval-chip-row">
          {HUMAN_RESOURCES_VIEWS.map((item) => (
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
