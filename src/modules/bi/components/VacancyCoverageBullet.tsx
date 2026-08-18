import { formatMetricValue, formatPercentValue, type VacancyCoverage } from "../lib/recruitmentAnalyticsChartConfig";

type VacancyCoverageBulletProps = {
  coverage: VacancyCoverage;
  hiredCount?: number;
  mobilityCount?: number;
  compact?: boolean;
};

/**
 * Bullet/progress bar de cobertura de vacantes. Se usa tanto en el detalle
 * de Reclutamiento como en el bloque de Resumen Ejecutivo para no divergir
 * en la formula ni en la lectura visual (lección: mismo denominador que
 * las tarjetas superiores).
 */
export function VacancyCoverageBullet({
  coverage,
  hiredCount,
  mobilityCount,
  compact = false
}: VacancyCoverageBulletProps) {
  if (coverage.requested <= 0) {
    return <div className="bi-empty-state">Sin cupos solicitados para el filtro.</div>;
  }

  const showBreakdown = typeof hiredCount === "number" && typeof mobilityCount === "number";

  return (
    <div className={`bi-coverage-bullet ${compact ? "bi-coverage-bullet-compact" : ""}`}>
      <div className="bi-coverage-bullet-header">
        <span>
          {formatMetricValue(coverage.filled)} / {formatMetricValue(coverage.requested)} cubiertas
        </span>
        <strong>{formatPercentValue(coverage.coveragePct)}</strong>
      </div>
      <div
        className="bi-coverage-bullet-track"
        role="img"
        aria-label={`Cobertura ${formatPercentValue(coverage.coveragePct)}`}
      >
        <div className="bi-coverage-bullet-fill" style={{ width: `${Math.min(coverage.coveragePct, 100)}%` }} />
      </div>
      <div className="bi-coverage-bullet-footer">
        <span>{formatMetricValue(coverage.missing)} vacantes pendientes</span>
        {showBreakdown ? (
          <span className="bi-coverage-bullet-breakdown">
            Contratación: {formatMetricValue(hiredCount!)} · Movilidad interna: {formatMetricValue(mobilityCount!)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
