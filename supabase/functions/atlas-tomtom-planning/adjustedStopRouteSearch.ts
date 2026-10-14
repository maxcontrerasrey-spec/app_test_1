import { buildRouteOrderAlternatives, selectFastestRoutedOrder, type RoutedOrder } from "./routeOrderAlternatives.ts";

type CompleteRoute = { durationSeconds: number; distanceMeters: number };

export const MAX_ADJUSTED_STOP_ROUTE_CANDIDATES = 3;

function matrixDurationForOrder(matrix: number[][], order: number[]) {
  return order.slice(1).reduce((total, point, index) => {
    const leg = matrix[order[index]!]?.[point];
    return Number.isFinite(leg) && leg! >= 0 ? total + leg! : Number.POSITIVE_INFINITY;
  }, 0);
}

/**
 * The matrix only ranks snapped-stop orders. Compare a small set of those orders
 * by their complete Valhalla route while keeping the already-routed access order
 * as a fallback and as the selection baseline.
 */
export async function selectFastestAdjustedStopRoute<T extends CompleteRoute>(args: {
  matrix: number[][];
  matrixSeedOrder: number[];
  baselineOrder: number[];
  baselineRoute: T;
  fixedDestinationIndex?: number;
  candidateBudget?: number;
  evaluate: (order: number[]) => Promise<T | null>;
}): Promise<RoutedOrder<T>> {
  const candidateBudget = args.candidateBudget ?? MAX_ADJUSTED_STOP_ROUTE_CANDIDATES;
  if (!Number.isInteger(candidateBudget) || candidateBudget < 1 || candidateBudget > 8) {
    throw new Error("El presupuesto de órdenes para accesos ajustados no es válido.");
  }

  const seedKey = args.matrixSeedOrder.join(",");
  const baselineKey = args.baselineOrder.join(",");
  const seed = {
    order: args.matrixSeedOrder,
    matrixDurationSeconds: matrixDurationForOrder(args.matrix, args.matrixSeedOrder)
  };
  const nearbyOrders = buildRouteOrderAlternatives(
    args.matrix,
    args.matrixSeedOrder,
    args.fixedDestinationIndex,
    candidateBudget,
    [],
    [args.baselineOrder]
  );
  const candidates = [
    ...(seedKey === baselineKey ? [] : [seed]),
    ...nearbyOrders
  ].slice(0, candidateBudget);

  return selectFastestRoutedOrder(
    {
      order: args.baselineOrder,
      matrixDurationSeconds: matrixDurationForOrder(args.matrix, args.baselineOrder)
    },
    args.baselineRoute,
    candidates,
    args.evaluate
  );
}
