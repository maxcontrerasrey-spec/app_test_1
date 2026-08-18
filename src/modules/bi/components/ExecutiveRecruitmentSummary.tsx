import { useMemo } from "react";
import { Link } from "react-router";
import { useBiRecruitmentDashboard } from "../hooks/useBiQueries";
import {
  buildVacancyGapRows,
  computeVacancyCoverage,
  formatMetricValue
} from "../lib/recruitmentAnalyticsChartConfig";
import { VacancyCoverageBullet } from "./VacancyCoverageBullet";

export function ExecutiveRecruitmentSummary() {
  const dashboardQuery = useBiRecruitmentDashboard();
  const dashboard = dashboardQuery.data;

  const coverage = useMemo(() => {
    if (!dashboard) return null;
    return computeVacancyCoverage(dashboard.summary.requestedVacancies, dashboard.summary.filledVacancies);
  }, [dashboard]);

  const topGapRows = useMemo(() => {
    if (!dashboard || dashboard.vacanciesByContract.length === 0) return [];
    return buildVacancyGapRows(dashboard.vacanciesByContract)
      .filter((row) => row.missing > 0)
      .slice(0, 5);
  }, [dashboard]);

  return (
    <article className="info-card bi-executive-block">
      <div className="bi-executive-block-header">
        <h3>Reclutamiento</h3>
        <Link to="/bi/reclutamiento" className="bi-executive-detail-link">
          Ver detalle →
        </Link>
      </div>

      {dashboardQuery.isLoading ? (
        <div className="bi-loading-state">Cargando reclutamiento...</div>
      ) : dashboardQuery.isError || !dashboard || !coverage ? (
        <div className="bi-error-state">No se pudo cargar el reclutamiento.</div>
      ) : (
        <>
          <VacancyCoverageBullet coverage={coverage} compact />

          {topGapRows.length > 0 ? (
            <div className="bi-executive-mini-ranking">
              <span className="bi-executive-mini-ranking-title">Top contratos con mayor brecha</span>
              {topGapRows.map((row) => (
                <div key={row.label} className="bi-executive-mini-ranking-row">
                  <span className="bi-executive-mini-ranking-label" title={row.label}>
                    {row.label}
                  </span>
                  <div className="bi-executive-mini-ranking-track">
                    <div
                      className="bi-executive-mini-ranking-fill bi-executive-mini-ranking-fill-gap"
                      style={{ width: `${Math.min((row.missing / topGapRows[0].missing) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="bi-executive-mini-ranking-value">{formatMetricValue(row.missing)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
