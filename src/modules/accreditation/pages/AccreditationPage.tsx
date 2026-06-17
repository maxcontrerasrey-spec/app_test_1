import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../../../shared/ui";
import { AccreditationDashboardView } from "../components/AccreditationDashboardView";
import { AccreditationSettingsView } from "../components/AccreditationSettingsView";
import { AccreditationWorkersView } from "../components/AccreditationWorkersView";
import "../styles/accreditation.css";

const ACCREDITATION_VIEWS = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Control del universo acreditado, por vencer y vencido por faena."
  },
  {
    key: "workers",
    label: "Trabajadores",
    description: "Detalle documental, upload a BUK y trazabilidad por trabajador."
  },
  {
    key: "settings",
    label: "Configuracion",
    description: "Mantenedores de faenas, requisitos y matriz por cargo."
  }
] as const;

type AccreditationViewKey = (typeof ACCREDITATION_VIEWS)[number]["key"];

function isAccreditationView(value: string | undefined): value is AccreditationViewKey {
  return ACCREDITATION_VIEWS.some((view) => view.key === value);
}

export function AccreditationPage() {
  const navigate = useNavigate();
  const { view } = useParams();
  const activeView = isAccreditationView(view) ? view : "dashboard";
  const [dashboardSiteId, setDashboardSiteId] = useState("");
  const [dashboardJobTitle, setDashboardJobTitle] = useState("");

  const activeMeta = useMemo(
    () => ACCREDITATION_VIEWS.find((item) => item.key === activeView) ?? ACCREDITATION_VIEWS[0],
    [activeView]
  );

  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Acreditacion de Personas</h1>
        <p className="description accreditation-description">{activeMeta.description}</p>
      </div>

      <section className="accreditation-tab-shell">
        <div className="approval-chip-row">
          {ACCREDITATION_VIEWS.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`approval-chip ${activeView === item.key ? "tracking-kpi-card-active" : ""}`}
              aria-current={activeView === item.key ? "page" : undefined}
              onClick={() => navigate(`/recursos-humanos/acreditacion/${item.key}`)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {activeView === "dashboard" ? (
        <AccreditationDashboardView
          siteId={dashboardSiteId}
          jobTitle={dashboardJobTitle}
          onSiteIdChange={setDashboardSiteId}
          onJobTitleChange={setDashboardJobTitle}
        />
      ) : null}
      {activeView === "workers" ? <AccreditationWorkersView /> : null}
      {activeView === "settings" ? <AccreditationSettingsView /> : null}
    </PageShell>
  );
}
