import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../../../shared/ui";
import { BiOverviewCards } from "../components/BiOverviewCards";
import { BiHeadcountCharts } from "../components/BiHeadcountCharts";
import { BiDemographicsChart } from "../components/BiDemographicsChart";
import { BiPresenceAndExceptions } from "../components/BiPresenceAndExceptions";
import { BiTrendingExceptionsChart } from "../components/BiTrendingExceptionsChart";
import { BiRecruitmentFunnel } from "../components/BiRecruitmentFunnel";
import { BiRecruitmentAnalyticsView } from "../components/BiRecruitmentAnalyticsView";
import { IncentiveAnalyticsView } from "../../incentives/components/IncentiveAnalyticsView";
import { TextField, MultiSelectField } from "../../../shared/ui";
import {
  useBiHeadcountByContract,
  useBiHeadcountByJobTitle,
  useBiRecruitmentDashboard
} from "../hooks/useBiQueries";
import { formatBiContractLabel } from "../lib/presentation";
import type { BiFilters } from "../types";
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
    description: "KPIs operacionales de dotación, ausentismo, demografía y presencia."
  },
  {
    key: "incentivos",
    label: "Análisis de Incentivos",
    description: "Control gerencial del gasto extraordinario y desviaciones operacionales."
  },
  {
    key: "reclutamiento",
    label: "Reclutamiento",
    description: "Seguimiento ejecutivo de folios, candidatos, aprobaciones y movilidad interna."
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
  const [debouncedPeriodCode, setDebouncedPeriodCode] = useState("");
  const [contractCodeFilter, setContractCodeFilter] = useState<string[]>([]);
  const [jobTitleFilter, setJobTitleFilter] = useState<string[]>([]);
  const [managementFilter, setManagementFilter] = useState<string[]>([]);
  const dotacionFilters = useMemo<BiFilters>(
    () => ({
      periodCode: debouncedPeriodCode || undefined,
      contractCodes: contractCodeFilter,
      jobTitles: jobTitleFilter
    }),
    [contractCodeFilter, debouncedPeriodCode, jobTitleFilter]
  );
  const recruitmentFilters = useMemo<BiFilters>(
    () => ({
      periodCode: debouncedPeriodCode || undefined,
      managementNames: managementFilter,
      contractCodes: contractCodeFilter
    }),
    [contractCodeFilter, debouncedPeriodCode, managementFilter]
  );

  const { data: contractsData } = useBiHeadcountByContract(undefined, activeView === "dotacion");
  const { data: jobsData } = useBiHeadcountByJobTitle(undefined, activeView === "dotacion");
  const recruitmentAnalytics = useBiRecruitmentDashboard(
    recruitmentFilters,
    activeView === "reclutamiento"
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedPeriodCode(periodCodeFilter.trim()),
      400
    );
    return () => window.clearTimeout(timeoutId);
  }, [periodCodeFilter]);

  const jobTitlesByContractCode = useMemo(() => {
    const lookup = new Map<string, Set<string>>();

    jobsData?.forEach((item) => {
      const contractCode = item.areaName.trim();
      const jobTitle = item.jobTitle.trim();
      if (!contractCode || !jobTitle) {
        return;
      }

      const currentSet = lookup.get(contractCode) ?? new Set<string>();
      currentSet.add(jobTitle);
      lookup.set(contractCode, currentSet);
    });

    return lookup;
  }, [jobsData]);

  const contractLabelByCode = useMemo(() => {
    const lookup = new Map<string, string>();

    contractsData?.forEach((contract) => {
      const code = contract.areaName.trim();
      if (!code || lookup.has(code)) {
        return;
      }

      lookup.set(code, formatBiContractLabel(contract.areaName));
    });

    return lookup;
  }, [contractsData]);

  const contractsByJobTitle = useMemo(() => {
    const lookup = new Map<string, Set<string>>();

    jobsData?.forEach((item) => {
      const contractCode = item.areaName.trim();
      const jobTitle = item.jobTitle.trim();
      if (!contractCode || !jobTitle) {
        return;
      }

      const currentSet = lookup.get(jobTitle) ?? new Set<string>();
      currentSet.add(contractCode);
      lookup.set(jobTitle, currentSet);
    });

    return lookup;
  }, [jobsData]);

  const filteredContractCodes = useMemo(() => {
    const allContractCodes = [...contractLabelByCode.keys()];

    if (jobTitleFilter.length === 0) {
      return allContractCodes;
    }

    return allContractCodes.filter((contractCode) =>
      jobTitleFilter.every((jobTitle) => contractsByJobTitle.get(jobTitle)?.has(contractCode))
    );
  }, [contractLabelByCode, contractsByJobTitle, jobTitleFilter]);

  const filteredJobTitles = useMemo(() => {
    const allJobTitles = Array.from(
      new Set((jobsData ?? []).map((item) => item.jobTitle.trim()).filter(Boolean))
    );

    if (contractCodeFilter.length === 0) {
      return allJobTitles;
    }

    return allJobTitles.filter((jobTitle) =>
      contractCodeFilter.every((contractCode) =>
        jobTitlesByContractCode.get(contractCode)?.has(jobTitle)
      )
    );
  }, [contractCodeFilter, jobTitlesByContractCode, jobsData]);

  const dotacionContractOptions = useMemo(() => {
    if (filteredContractCodes.length === 0) return [];

    return filteredContractCodes
      .map((code) => ({ label: contractLabelByCode.get(code) ?? code, value: code }))
      .sort((left, right) =>
      left.label.localeCompare(right.label, "es", { sensitivity: "base" })
    );
  }, [contractLabelByCode, filteredContractCodes]);

  const dotacionJobOptions = useMemo(() => {
    if (filteredJobTitles.length === 0) return [];

    return [...filteredJobTitles]
      .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))
      .map(title => ({ label: title, value: title }));
  }, [filteredJobTitles]);

  const recruitmentContractOptions = useMemo(
    () =>
      (recruitmentAnalytics.data?.availableContracts ?? []).map((item) => ({
        label: item,
        value: item
      })),
    [recruitmentAnalytics.data?.availableContracts]
  );

  const recruitmentManagementOptions = useMemo(
    () =>
      (recruitmentAnalytics.data?.availableManagements ?? []).map((item) => ({
        label: item,
        value: item
      })),
    [recruitmentAnalytics.data?.availableManagements]
  );

  const contractOptions =
    activeView === "reclutamiento" ? recruitmentContractOptions : dotacionContractOptions;
  const secondaryOptions =
    activeView === "reclutamiento" ? recruitmentManagementOptions : dotacionJobOptions;

  useEffect(() => {
    if (activeView === "reclutamiento" && recruitmentAnalytics.isLoading) {
      return;
    }

    const allowedContractCodes = new Set(contractOptions.map((item) => item.value));
    setContractCodeFilter((current) =>
      current.filter((contractCode) => allowedContractCodes.has(contractCode))
    );
  }, [activeView, contractOptions, recruitmentAnalytics.isLoading]);

  useEffect(() => {
    if (activeView === "reclutamiento" && recruitmentAnalytics.isLoading) {
      return;
    }

    const allowedValues = new Set(secondaryOptions.map((item) => item.value));
    if (activeView === "reclutamiento") {
      setManagementFilter((current) => current.filter((value) => allowedValues.has(value)));
      return;
    }
    setJobTitleFilter((current) => current.filter((value) => allowedValues.has(value)));
  }, [activeView, recruitmentAnalytics.isLoading, secondaryOptions]);

  const activeViewMeta = useMemo(
    () => BI_VIEWS.find((item) => item.key === activeView) ?? BI_VIEWS[0],
    [activeView]
  );

  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Inteligencia de Negocios</h1>
        <p className="description bi-dashboard-description">
          {activeViewMeta.description}
        </p>
      </div>

      <section className="bi-view-switcher">
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

      {(activeView === "dotacion" || activeView === "reclutamiento") && (
        <>
          <section className="bi-filter-section">
            <div className="info-card">
              <div className="bi-analytics-filters">
                <TextField
                  id="hr-bi-analytics-period"
                  label="Periodo"
                  placeholder="Ej. 202606"
                  value={periodCodeFilter}
                  onChange={(e) => setPeriodCodeFilter(e.target.value)}
                  inputMode="numeric"
                />

                <MultiSelectField
                  id={
                    activeView === "reclutamiento"
                      ? "hr-bi-analytics-management"
                      : "hr-bi-analytics-contract"
                  }
                  label={activeView === "reclutamiento" ? "Gerencias" : "Contratos"}
                  options={
                    activeView === "reclutamiento" ? secondaryOptions : contractOptions
                  }
                  value={
                    activeView === "reclutamiento" ? managementFilter : contractCodeFilter
                  }
                  onChange={
                    activeView === "reclutamiento"
                      ? setManagementFilter
                      : setContractCodeFilter
                  }
                  placeholder={
                    activeView === "reclutamiento"
                      ? "Todas las gerencias"
                      : "Todos los contratos"
                  }
                />

                <MultiSelectField
                  id={
                    activeView === "reclutamiento"
                      ? "hr-bi-analytics-contract"
                      : "hr-bi-analytics-job"
                  }
                  label={activeView === "reclutamiento" ? "Contratos" : "Cargos"}
                  options={
                    activeView === "reclutamiento" ? contractOptions : secondaryOptions
                  }
                  value={
                    activeView === "reclutamiento" ? contractCodeFilter : jobTitleFilter
                  }
                  onChange={
                    activeView === "reclutamiento"
                      ? setContractCodeFilter
                      : setJobTitleFilter
                  }
                  placeholder={
                    activeView === "reclutamiento"
                      ? "Todos los contratos"
                      : "Todos los cargos"
                  }
                />

                <button
                  type="button"
                  title="Limpiar Filtros"
                  onClick={() => {
                    setPeriodCodeFilter("");
                    setContractCodeFilter([]);
                    setJobTitleFilter([]);
                    setManagementFilter([]);
                  }}
                  className="bi-filter-reset-button"
                >
                  <EraserIcon />
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {activeView === "dotacion" && (
        <div className="bi-dashboard-grid">
          <BiOverviewCards filters={dotacionFilters} />
          <BiHeadcountCharts filters={dotacionFilters} />
          <BiPresenceAndExceptions filters={dotacionFilters} />
          <div className="bi-chart-row">
            <BiDemographicsChart filters={dotacionFilters} />
            <BiRecruitmentFunnel filters={dotacionFilters} />
          </div>
          <BiTrendingExceptionsChart filters={dotacionFilters} />
        </div>
      )}

      {activeView === "incentivos" && (
        <div>
          <IncentiveAnalyticsView />
        </div>
      )}

      {activeView === "reclutamiento" && (
        <BiRecruitmentAnalyticsView
          dashboard={recruitmentAnalytics.data ?? null}
          isLoading={recruitmentAnalytics.isLoading}
          isError={recruitmentAnalytics.isError}
        />
      )}
    </PageShell>
  );
}
