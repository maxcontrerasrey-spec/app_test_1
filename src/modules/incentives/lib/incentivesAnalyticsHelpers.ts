import type {
  HrIncentiveAnalyticsAmountByPeriodItem,
  HrIncentiveAnalyticsSummaryCards
} from "../types";

export type IncentivesAmountBreakdown = {
  totalAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
  /**
   * Todo lo que no quedo aprobado ni rechazado dentro del universo total
   * (solicitudes P/E pendientes de flujo, mas anuladas C). El RPC
   * `get_hr_incentives_analytics` no expone un conteo/monto separado para
   * "Anulado", asi que ese estado queda incluido aqui en vez de inventarlo.
   */
  pendingAmount: number;
  approvedPct: number;
  pendingPct: number;
  rejectedPct: number;
};

/**
 * El RPC no expone `approved_amount`/`rejected_amount` a nivel de
 * `summary_cards`, pero si los entrega por periodo dentro del mismo
 * payload (`total_amount_by_period[].approvedAmount/rejectedAmount`) bajo
 * exactamente los mismos filtros. Sumar esa serie evita una RPC nueva.
 */
export function computeIncentivesAmountBreakdown(
  summaryCards: HrIncentiveAnalyticsSummaryCards,
  totalAmountByPeriod: HrIncentiveAnalyticsAmountByPeriodItem[]
): IncentivesAmountBreakdown {
  const approvedAmount = totalAmountByPeriod.reduce((sum, item) => sum + item.approvedAmount, 0);
  const rejectedAmount = totalAmountByPeriod.reduce((sum, item) => sum + item.rejectedAmount, 0);
  const totalAmount = summaryCards.totalAmount;
  const pendingAmount = Math.max(totalAmount - approvedAmount - rejectedAmount, 0);

  return {
    totalAmount,
    approvedAmount,
    rejectedAmount,
    pendingAmount,
    approvedPct: totalAmount > 0 ? (approvedAmount / totalAmount) * 100 : 0,
    pendingPct: totalAmount > 0 ? (pendingAmount / totalAmount) * 100 : 0,
    rejectedPct: totalAmount > 0 ? (rejectedAmount / totalAmount) * 100 : 0
  };
}

export type AmountVariance = {
  deltaAmount: number;
  deltaPct: number | null;
};

/**
 * Variacion vs el punto anterior de una serie real ya cargada (periodos o
 * fechas). Devuelve null cuando no hay punto anterior real: nunca se
 * inventa una comparacion.
 */
export function computeAmountVariance(
  current: number | null | undefined,
  previous: number | null | undefined
): AmountVariance | null {
  if (typeof current !== "number" || typeof previous !== "number") {
    return null;
  }

  const deltaAmount = current - previous;
  const deltaPct = previous !== 0 ? (deltaAmount / Math.abs(previous)) * 100 : null;

  return { deltaAmount, deltaPct };
}

export function computeSharePct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}
