import { useMemo } from "react";
import { Link } from "react-router";
import { useBiHeadcountByContract, useBiPresenceSummaryToday, useBiWorkforceOverview } from "../hooks/useBiQueries";
import { formatBiContractLabel } from "../lib/presentation";
import { formatMetricValue, formatPercentValue } from "../lib/recruitmentAnalyticsChartConfig";
import { buildAbsenteeismByContractRows } from "../lib/workforceChartConfig";

export function ExecutiveWorkforceSummary() {
  const overviewQuery = useBiWorkforceOverview();
  const presenceQuery = useBiPresenceSummaryToday();
  const contractQuery = useBiHeadcountByContract();

  const overview = overviewQuery.data;
  const presentToday =
    overview !== undefined
      ? overview.totalActiveEmployees - overview.onVacationToday - overview.onMedicalLeaveToday - overview.otherAbsencesToday
      : null;
  const presencePct =
    overview && overview.totalActiveEmployees > 0 && presentToday !== null
      ? (presentToday / overview.totalActiveEmployees) * 100
      : null;
  const absenteeismPct = presencePct !== null ? 100 - presencePct : null;

  // Mismo mapping contractCode -> nombre real usado por
  // BiAbsenteeismByContractChart (vista Dotación) para no mostrar códigos
  // crudos en una tarjeta gerencial (ver BiAbsenteeismByContractChart.tsx).
  const labelByContractCode = useMemo(() => {
    const lookup = new Map<string, string>();
    contractQuery.data?.forEach((item) => {
      if (!lookup.has(item.contractCode)) {
        lookup.set(item.contractCode, formatBiContractLabel(item.areaName || item.contractCode));
      }
    });
    return lookup;
  }, [contractQuery.data]);

  const topAbsenteeismContracts = useMemo(() => {
    if (!presenceQuery.data || presenceQuery.data.length === 0) return [];
    return buildAbsenteeismByContractRows(presenceQuery.data, labelByContractCode).slice(0, 5);
  }, [labelByContractCode, presenceQuery.data]);

  const isLoading = overviewQuery.isLoading || presenceQuery.isLoading;
  const isError = overviewQuery.isError || presenceQuery.isError;

  return (
    <article className="info-card bi-executive-block">
      <div className="bi-executive-block-header">
        <h3>Dotación y Asistencia</h3>
        <Link to="/bi/dotacion" className="bi-executive-detail-link">
          Ver detalle →
        </Link>
      </div>

      {isLoading ? (
        <div className="bi-loading-state">Cargando dotación...</div>
      ) : isError || !overview ? (
        <div className="bi-error-state">No se pudo cargar la dotación.</div>
      ) : (
        <>
          <div className="bi-executive-metric-row">
            <div className="bi-executive-metric">
              <span>Dotación activa</span>
              <strong>{formatMetricValue(overview.totalActiveEmployees)}</strong>
            </div>
            <div className="bi-executive-metric">
              <span>Presencia hoy</span>
              <strong>{presencePct !== null ? formatPercentValue(presencePct) : "—"}</strong>
            </div>
            <div className="bi-executive-metric">
              <span>Ausentismo hoy</span>
              <strong>{absenteeismPct !== null ? formatPercentValue(absenteeismPct) : "—"}</strong>
            </div>
            <div className="bi-executive-metric">
              <span>Licencias médicas</span>
              <strong>{formatMetricValue(overview.onMedicalLeaveToday)}</strong>
            </div>
          </div>

          {topAbsenteeismContracts.length > 0 ? (
            <div className="bi-executive-mini-ranking">
              <span className="bi-executive-mini-ranking-title">Top contratos con mayor ausentismo (hoy)</span>
              {topAbsenteeismContracts.map((row) => (
                <div key={row.contractCode} className="bi-executive-mini-ranking-row bi-executive-mini-ranking-row-detailed">
                  <span className="bi-executive-mini-ranking-label" title={row.label}>
                    {row.label}
                  </span>
                  <div className="bi-executive-mini-ranking-track">
                    <div
                      className="bi-executive-mini-ranking-fill bi-executive-mini-ranking-fill-pending"
                      style={{ width: `${Math.min(row.absenteeismPct, 100)}%` }}
                    />
                  </div>
                  <span className="bi-executive-mini-ranking-value">{formatPercentValue(row.absenteeismPct)}</span>
                  <span className="bi-executive-mini-ranking-caption">
                    {formatMetricValue(row.absentToday)} ausentes / {formatMetricValue(row.headcount)} personas
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
