import { useMemo } from "react";
import { hasFeatureAccess } from "../../auth/config/access";
import { useAuth } from "../../auth/context/AuthContext";
import { formatCurrencyValue, formatPercentValue as formatSharedPercentValue } from "../../../shared/lib/format";
import { useHrIncentivesAnalytics } from "../../incentives/hooks/useIncentivesQueries";
import {
  useBiHeadcountByContract,
  useBiPresenceSummaryToday,
  useBiRecruitmentDashboard,
  useBiWorkforceOverview
} from "../hooks/useBiQueries";
import { buildVacancyGapRows, computeVacancyCoverage, formatMetricValue } from "../lib/recruitmentAnalyticsChartConfig";
import { buildAbsenteeismByContractRows, computePresenceSummary } from "../lib/workforceChartConfig";
import { formatBiContractLabel } from "../lib/presentation";
import { ExecutiveWorkforceSummary } from "./ExecutiveWorkforceSummary";
import { ExecutiveRecruitmentSummary } from "./ExecutiveRecruitmentSummary";
import { ExecutiveIncentivesSummary } from "./ExecutiveIncentivesSummary";

const INCENTIVES_DEFAULT_FILTERS = { statuses: ["A"] };

type ManagementFocus = {
  key: string;
  title: string;
  contractLabel: string;
  value: string;
};

export function BiExecutiveSummary() {
  const { accessibleFeatures, isSuperAdmin } = useAuth();
  const canSeeDotacion = isSuperAdmin || hasFeatureAccess(accessibleFeatures, "bi_dotacion");
  const canSeeReclutamiento = isSuperAdmin || hasFeatureAccess(accessibleFeatures, "bi_reclutamiento");
  const canSeeIncentivos = isSuperAdmin || hasFeatureAccess(accessibleFeatures, "bi_incentivos");

  const overviewQuery = useBiWorkforceOverview(undefined, canSeeDotacion);
  const presenceQuery = useBiPresenceSummaryToday(undefined, canSeeDotacion);
  const contractQuery = useBiHeadcountByContract(undefined, canSeeDotacion);
  const recruitmentQuery = useBiRecruitmentDashboard(undefined, canSeeReclutamiento);
  const incentivesQuery = useHrIncentivesAnalytics(INCENTIVES_DEFAULT_FILTERS, canSeeIncentivos);

  // La presencia se toma del helper compartido sobre
  // get_bi_presence_summary_today, no de restar los tres conteos por tipo
  // del overview: esos se solapan si un empleado tiene dos excepciones el
  // mismo día. Ver computePresenceSummary.
  const presenceSummary = useMemo(
    () => computePresenceSummary(presenceQuery.data ?? []),
    [presenceQuery.data]
  );

  const workforceKpis = useMemo(() => {
    if (!canSeeDotacion || !overviewQuery.data) return null;
    const overview = overviewQuery.data;

    return {
      activeEmployees: overview.totalActiveEmployees,
      presencePct: presenceSummary?.presencePct ?? null,
      hiredThisMonth: overview.hiredThisMonth
    };
  }, [canSeeDotacion, overviewQuery.data, presenceSummary]);

  const recruitmentKpis = useMemo(() => {
    if (!canSeeReclutamiento || !recruitmentQuery.data) return null;
    const coverage = computeVacancyCoverage(
      recruitmentQuery.data.summary.requestedVacancies,
      recruitmentQuery.data.summary.filledVacancies
    );
    return { pendingVacancies: coverage.missing, coveragePct: coverage.coveragePct };
  }, [canSeeReclutamiento, recruitmentQuery.data]);

  const incentivesKpis = useMemo(() => {
    if (!canSeeIncentivos || !incentivesQuery.data) return null;
    return {
      totalAmount: incentivesQuery.data.summaryCards.totalAmount,
      approvalRate: incentivesQuery.data.summaryCards.approvalRate
    };
  }, [canSeeIncentivos, incentivesQuery.data]);

  // Mismo mapping contractCode -> nombre real usado en
  // ExecutiveWorkforceSummary/BiAbsenteeismByContractChart, para no
  // duplicar la resolución de etiquetas de contrato.
  const labelByContractCode = useMemo(() => {
    const lookup = new Map<string, string>();
    contractQuery.data?.forEach((item) => {
      if (!lookup.has(item.contractCode)) {
        lookup.set(item.contractCode, formatBiContractLabel(item.areaName || item.contractCode));
      }
    });
    return lookup;
  }, [contractQuery.data]);

  // Focos de Gestión: hechos comparativos ya calculados por otros bloques
  // (el máximo de un ranking real), nunca umbrales inventados como
  // "crítico > X%" sin regla de negocio explícita (sección 4.2 del brief).
  // Cada foco se omite si la sección no está autorizada o si no hay datos
  // suficientes para calcularlo con confianza.
  const managementFoci = useMemo<ManagementFocus[]>(() => {
    const foci: ManagementFocus[] = [];

    if (canSeeDotacion && presenceQuery.data && presenceQuery.data.length > 0) {
      const topAbsenteeism = buildAbsenteeismByContractRows(presenceQuery.data, labelByContractCode)[0];
      if (topAbsenteeism && topAbsenteeism.absenteeismPct > 0) {
        foci.push({
          key: "absenteeism",
          title: "Mayor ausentismo hoy",
          contractLabel: topAbsenteeism.label,
          value: `${formatSharedPercentValue(topAbsenteeism.absenteeismPct)} (${formatMetricValue(topAbsenteeism.absentToday)}/${formatMetricValue(topAbsenteeism.headcount)})`
        });
      }
    }

    if (canSeeReclutamiento && recruitmentQuery.data && recruitmentQuery.data.vacanciesByContract.length > 0) {
      const topGap = buildVacancyGapRows(recruitmentQuery.data.vacanciesByContract)[0];
      if (topGap && topGap.missing > 0) {
        foci.push({
          key: "vacancy-gap",
          title: "Mayor brecha de contratación",
          contractLabel: topGap.label,
          value: `${formatMetricValue(topGap.missing)} vacantes pendientes`
        });
      }
    }

    if (canSeeIncentivos && incentivesQuery.data && incentivesQuery.data.amountByContract.length > 0) {
      const topAmount = [...incentivesQuery.data.amountByContract].sort(
        (left, right) => right.totalAmount - left.totalAmount
      )[0];
      if (topAmount && topAmount.totalAmount > 0) {
        foci.push({
          key: "incentives-amount",
          title: "Mayor monto de incentivos",
          contractLabel: formatBiContractLabel(topAmount.areaName || topAmount.contractCode),
          value: formatCurrencyValue(topAmount.totalAmount)
        });
      }
    }

    return foci;
  }, [
    canSeeDotacion,
    canSeeIncentivos,
    canSeeReclutamiento,
    incentivesQuery.data,
    labelByContractCode,
    presenceQuery.data,
    recruitmentQuery.data
  ]);

  const hasAnyBlock = canSeeDotacion || canSeeReclutamiento || canSeeIncentivos;

  if (!hasAnyBlock) {
    return (
      <div className="bi-empty-state">No tienes datos habilitados para el Resumen Ejecutivo.</div>
    );
  }

  return (
    <div className="bi-dashboard-grid">
      <div className="tracking-kpi-row bi-executive-kpi-row">
        {canSeeDotacion ? (
          <>
            <article className="tracking-kpi-card tracking-kpi-card-bi-blue bi-overview-kpi-card">
              <span>Dotación Activa</span>
              <strong>{workforceKpis ? formatMetricValue(workforceKpis.activeEmployees) : "—"}</strong>
            </article>
            <article className="tracking-kpi-card tracking-kpi-card-bi-green bi-overview-kpi-card">
              <span>Presencia</span>
              <strong>
                {workforceKpis && workforceKpis.presencePct !== null
                  ? formatSharedPercentValue(workforceKpis.presencePct)
                  : "—"}
              </strong>
            </article>
          </>
        ) : null}

        {canSeeReclutamiento ? (
          <>
            <article className="tracking-kpi-card tracking-kpi-card-bi-yellow bi-overview-kpi-card">
              <span>Vacantes Pendientes</span>
              <strong>{recruitmentKpis ? formatMetricValue(recruitmentKpis.pendingVacancies) : "—"}</strong>
              {/* Oferta contra demanda: solo si el usuario ve ambas
                  secciones, porque contratados viene de bi_dotacion y las
                  vacantes de bi_reclutamiento. */}
              {workforceKpis ? (
                <small className="bi-kpi-caption">
                  {formatMetricValue(workforceKpis.hiredThisMonth)} contratados este mes
                </small>
              ) : null}
            </article>
            <article className="tracking-kpi-card tracking-kpi-card-bi-green bi-overview-kpi-card">
              <span>Cobertura</span>
              <strong>{recruitmentKpis ? formatSharedPercentValue(recruitmentKpis.coveragePct) : "—"}</strong>
            </article>
          </>
        ) : null}

        {canSeeIncentivos ? (
          <>
            <article className="tracking-kpi-card tracking-kpi-card-bi-gray bi-overview-kpi-card">
              <span>Incentivos Registrados</span>
              <strong>{incentivesKpis ? formatCurrencyValue(incentivesKpis.totalAmount) : "—"}</strong>
            </article>
            <article className="tracking-kpi-card tracking-kpi-card-bi-green bi-overview-kpi-card">
              <span>Aprobación</span>
              <strong>{incentivesKpis ? formatSharedPercentValue(incentivesKpis.approvalRate) : "—"}</strong>
            </article>
          </>
        ) : null}
      </div>

      {managementFoci.length > 0 ? (
        <div className="info-card bi-focus-card">
          <h3 className="bi-chart-title">Focos de Gestión</h3>
          <div className="bi-focus-grid">
            {managementFoci.map((focus) => (
              <div key={focus.key} className="bi-focus-item">
                <span className="bi-focus-item-title">{focus.title}</span>
                <span className="bi-focus-item-contract" title={focus.contractLabel}>
                  {focus.contractLabel}
                </span>
                <strong className="bi-focus-item-value">{focus.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="bi-executive-blocks-grid">
        {canSeeDotacion ? <ExecutiveWorkforceSummary /> : null}
        {canSeeReclutamiento ? <ExecutiveRecruitmentSummary /> : null}
        {canSeeIncentivos ? <ExecutiveIncentivesSummary /> : null}
      </div>
    </div>
  );
}
