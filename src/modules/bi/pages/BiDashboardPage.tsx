import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../../../shared/ui";
import { BiOverviewCards } from "../components/BiOverviewCards";
import { BiHeadcountCharts } from "../components/BiHeadcountCharts";
import { BiDemographicsChart } from "../components/BiDemographicsChart";
import { BiPresenceAndExceptions } from "../components/BiPresenceAndExceptions";
import { BiTrendingExceptionsChart } from "../components/BiTrendingExceptionsChart";
import { BiRecruitmentFunnel } from "../components/BiRecruitmentFunnel";
import { IncentiveAnalyticsView } from "../../incentives/components/IncentiveAnalyticsView";
import { TextField, MultiSelectField } from "../../../shared/ui";
import "../styles/bi.css";

const EraserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m13.3 6 5.6 5.6" />
  </svg>
);

const BI_VIEWS = [
  {
    key: "dotacion",
    label: "Analítica de Dotación (BUK)",
    description: "KPIs operacionales, ausentismo, demografía y flujo de reclutamiento."
  },
  {
    key: "incentivos",
    label: "Análisis de Incentivos",
    description: "Control gerencial del gasto extraordinario y desviaciones operacionales."
  }
] as const;

type BiViewKey = (typeof BI_VIEWS)[number]["key"];

function isBiView(value: string | undefined): value is BiViewKey {
  return BI_VIEWS.some((view) => view.key === value);
}

export function BiDashboardPage() {
  const navigate = useNavigate();
  const { view } = useParams();
  const activeView = isBiView(view) ? view : "dotacion";

  const [periodCodeFilter, setPeriodCodeFilter] = useState("");
  const [contractCodeFilter, setContractCodeFilter] = useState<string[]>([]);
  const [jobTitleFilter, setJobTitleFilter] = useState<string[]>([]);

  const activeViewMeta = useMemo(
    () => BI_VIEWS.find((item) => item.key === activeView) ?? BI_VIEWS[0],
    [activeView]
  );

  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Inteligencia de Negocios</h1>
        <p className="description" style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
          {activeViewMeta.description}
        </p>
      </div>

      <section style={{ marginBottom: "0.5rem" }}>
        <div className="approval-chip-row">
          {BI_VIEWS.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`approval-chip ${activeView === item.key ? "tracking-kpi-card-active" : ""}`}
              aria-current={activeView === item.key ? "page" : undefined}
              onClick={() => navigate(`/bi/${item.key}`)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {activeView === "dotacion" && (
        <>
          <section style={{ marginBottom: "1.5rem" }}>
            <div className="hr-incentives-analytics-filters">
              <TextField
                id="hr-bi-analytics-period"
                label="Periodo"
                placeholder="Ej. 202606"
                value={periodCodeFilter}
                onChange={(e) => setPeriodCodeFilter(e.target.value)}
              />

              <MultiSelectField
                id="hr-bi-analytics-contract"
                label="Contratos"
                options={[]}
                value={contractCodeFilter}
                onChange={setContractCodeFilter}
                placeholder="Todos los contratos"
              />

              <MultiSelectField
                id="hr-bi-analytics-job"
                label="Cargos"
                options={[]}
                value={jobTitleFilter}
                onChange={setJobTitleFilter}
                placeholder="Todos los cargos"
              />

              <button
                type="button"
                className="btn btn-secondary"
                title="Limpiar Filtros"
                onClick={() => {
                  setPeriodCodeFilter("");
                  setContractCodeFilter([]);
                  setJobTitleFilter([]);
                }}
                style={{
                  height: "3.2rem",
                  width: "3.2rem",
                  padding: "0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <EraserIcon />
              </button>
            </div>
          </section>

          <div className="bi-dashboard-grid">
            <BiOverviewCards />
            <BiHeadcountCharts />
            <BiPresenceAndExceptions />
            <div className="bi-chart-row">
              <BiDemographicsChart />
              <BiRecruitmentFunnel />
            </div>
            <BiTrendingExceptionsChart />
          </div>
        </>
      )}

      {activeView === "incentivos" && (
        <div>
          <IncentiveAnalyticsView />
        </div>
      )}
    </PageShell>
  );
}
