import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../../../shared/ui";
import { useHrIncentiveSetupCatalogs } from "../hooks/useIncentivesQueries";
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
  const { view } = useParams();
  const activeView = isHumanResourcesView(view) ? view : "incentivos";
  const setupCatalogsQuery = useHrIncentiveSetupCatalogs();

  const activeViewMeta = useMemo(
    () => HUMAN_RESOURCES_VIEWS.find((item) => item.key === activeView) ?? HUMAN_RESOURCES_VIEWS[0],
    [activeView]
  );

  if (view && !isHumanResourcesView(view)) {
    return <Navigate to="/recursos-humanos/incentivos" replace />;
  }

  return (
    <PageShell className="hr-incentives-page">
      <section className="hr-incentives-hero">
        <div className="hr-incentives-hero-copy">
          <span className="eyebrow">Recursos Humanos</span>
          <h2>Incentivos operativos</h2>
          <p>{activeViewMeta.description}</p>
        </div>
      </section>

      <div className="control-tabs-row hr-incentives-tabs">
        {HUMAN_RESOURCES_VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`control-tab ${activeView === item.key ? "active" : ""}`}
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
    </PageShell>
  );
}
