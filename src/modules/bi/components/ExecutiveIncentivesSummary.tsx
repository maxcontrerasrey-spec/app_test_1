import { useMemo } from "react";
import { Link } from "react-router";
import { formatCurrencyValue, formatPercentValue } from "../../../shared/lib/format";
import { useHrIncentivesAnalytics } from "../../incentives/hooks/useIncentivesQueries";
import { computeIncentivesAmountBreakdown } from "../../incentives/lib/incentivesAnalyticsHelpers";
import { SegmentedStatusBar, type SegmentedStatusSegment } from "./SegmentedStatusBar";

// Mismo shape de filtros por defecto que usa IncentiveAnalyticsView
// (statuses: ["A"] = todos los estados) para que React Query reutilice el
// cache si el usuario ya visitó /bi/incentivos sin filtros.
const DEFAULT_FILTERS = { statuses: ["A"] };

export function ExecutiveIncentivesSummary() {
  const analyticsQuery = useHrIncentivesAnalytics(DEFAULT_FILTERS);
  const data = analyticsQuery.data;

  const breakdown = useMemo(() => {
    if (!data) return null;
    return computeIncentivesAmountBreakdown(data.summaryCards, data.totalAmountByPeriod);
  }, [data]);

  const statusSegments = useMemo<SegmentedStatusSegment[] | null>(() => {
    if (!data || data.summaryCards.requestCount === 0) return null;
    const pendingCount = Math.max(
      data.summaryCards.requestCount - data.summaryCards.approvedCount - data.summaryCards.rejectedCount,
      0
    );

    return [
      { key: "approved", label: "Aprobadas", value: data.summaryCards.approvedCount, tone: "approved" },
      { key: "pending", label: "Pendientes", value: pendingCount, tone: "pending" },
      { key: "rejected", label: "Rechazadas", value: data.summaryCards.rejectedCount, tone: "rejected" }
    ];
  }, [data]);

  const topContracts = data?.amountByContract.slice(0, 3) ?? [];

  return (
    <article className="info-card bi-executive-block">
      <div className="bi-executive-block-header">
        <h3>Incentivos</h3>
        <Link to="/bi/incentivos" className="bi-executive-detail-link">
          Ver detalle →
        </Link>
      </div>

      {analyticsQuery.isLoading ? (
        <div className="bi-loading-state">Cargando incentivos...</div>
      ) : analyticsQuery.isError || !data || !breakdown ? (
        <div className="bi-error-state">No se pudo cargar la analítica de incentivos.</div>
      ) : (
        <>
          <div className="bi-executive-metric-row">
            <div className="bi-executive-metric">
              <span>Monto registrado</span>
              <strong>{formatCurrencyValue(breakdown.totalAmount)}</strong>
            </div>
            <div className="bi-executive-metric">
              <span>Aprobado</span>
              <strong>{formatPercentValue(breakdown.approvedPct)}</strong>
            </div>
            <div className="bi-executive-metric">
              <span>Pendiente</span>
              <strong>{formatPercentValue(breakdown.pendingPct)}</strong>
            </div>
            <div className="bi-executive-metric">
              <span>Rechazado</span>
              <strong>{formatPercentValue(breakdown.rejectedPct)}</strong>
            </div>
          </div>

          {statusSegments ? <SegmentedStatusBar segments={statusSegments} /> : null}

          {topContracts.length > 0 ? (
            <div className="bi-executive-mini-ranking">
              <span className="bi-executive-mini-ranking-title">Top contratos por monto</span>
              {topContracts.map((contract) => (
                <div key={contract.contractCode} className="bi-executive-mini-ranking-row">
                  <span className="bi-executive-mini-ranking-label" title={contract.areaName ?? contract.contractCode}>
                    {contract.areaName ?? contract.contractCode}
                  </span>
                  <div className="bi-executive-mini-ranking-track">
                    <div
                      className="bi-executive-mini-ranking-fill bi-executive-mini-ranking-fill-neutral"
                      style={{
                        width: `${Math.min((contract.totalAmount / topContracts[0].totalAmount) * 100, 100)}%`
                      }}
                    />
                  </div>
                  <span className="bi-executive-mini-ranking-value">{formatCurrencyValue(contract.totalAmount)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
