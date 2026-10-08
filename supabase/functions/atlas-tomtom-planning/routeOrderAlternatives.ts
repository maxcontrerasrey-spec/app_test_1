type Candidate = { order: number[]; matrixDurationSeconds: number };

export type FeasibleCandidate<T> = Candidate & { route: T };
export type RoutedOrder<T> = Candidate & { route: T; alternativeApplied: boolean; alternativesEvaluated: number; alternativesFailed: number };

export function routeOrderAlternativeBudget(stopCount: number) {
  if (!Number.isInteger(stopCount) || stopCount < 2 || stopCount > 151) throw new Error("La cantidad de paradas no es válida.");
  if (stopCount <= 20) return 8;
  if (stopCount <= 50) return 6;
  if (stopCount <= 100) return 4;
  return 2;
}

/**
 * Produces a small, deterministic set of nearby orders for road-engine validation.
 * The duration matrix ranks candidates; Valhalla's route response decides feasibility.
 */
export function buildRouteOrderAlternatives(
  durations: number[][],
  seedOrder: number[],
  fixedDestinationIndex?: number,
  limit = 4,
  additionalSeedOrders: number[][] = [],
  excludedOrders: number[][] = []
): Candidate[] {
  const size = durations.length;
  if (size < 2 || durations.some((row) => row.length !== size)) throw new Error("La matriz de tiempos no es válida.");
  if (seedOrder.length !== size || new Set(seedOrder).size !== size || seedOrder.some((index) => !Number.isInteger(index) || index < 0 || index >= size)) {
    throw new Error("El orden de entrada no contiene todos los puntos.");
  }
  if (!Number.isInteger(limit) || limit < 1) throw new Error("El límite de alternativas no es válido.");
  if (additionalSeedOrders.some((order) => order.length !== size || new Set(order).size !== size || order.some((index) => !Number.isInteger(index) || index < 0 || index >= size))) {
    throw new Error("Una semilla de orden alternativo no contiene todos los puntos.");
  }
  if (additionalSeedOrders.some((order) => fixedDestinationIndex !== undefined && order.at(-1) !== fixedDestinationIndex)) {
    throw new Error("Una semilla alternativa mueve el destino fijado.");
  }
  if (excludedOrders.length > 8 || excludedOrders.some((order) => order.length !== size || new Set(order).size !== size || order.some((index) => !Number.isInteger(index) || index < 0 || index >= size))) {
    throw new Error("La lista de órdenes ya evaluados no es válida.");
  }
  if (excludedOrders.some((order) => fixedDestinationIndex !== undefined && order.at(-1) !== fixedDestinationIndex)) {
    throw new Error("Un orden ya evaluado mueve el destino fijado.");
  }
  if (fixedDestinationIndex !== undefined && (!Number.isInteger(fixedDestinationIndex) || fixedDestinationIndex <= 0 || fixedDestinationIndex >= size || seedOrder.at(-1) !== fixedDestinationIndex)) {
    throw new Error("El destino fijado debe permanecer al final del recorrido.");
  }

  const duration = (order: number[]) => {
    let total = 0;
    for (let index = 1; index < order.length; index += 1) {
      const leg = durations[order[index - 1]!]![order[index]!]!;
      if (!Number.isFinite(leg) || leg < 0) return Number.POSITIVE_INFINITY;
      total += leg;
    }
    return total;
  };

  const seeds = [seedOrder, ...additionalSeedOrders];
  const seedKeys = new Set([seedOrder.join(",")]);
  const excludedKeys = new Set(excludedOrders.map((order) => order.join(",")));
  const candidatePool: Candidate[] = [];
  const poolKeys = new Set<string>();
  const poolLimit = Math.max(32, Math.min(128, limit * 8));
  const add = (order: number[]) => {
    const key = order.join(",");
    if (seedKeys.has(key) || excludedKeys.has(key) || poolKeys.has(key)) return;
    if (fixedDestinationIndex !== undefined && order.at(-1) !== fixedDestinationIndex) return;
    const matrixDurationSeconds = duration(order);
    if (!Number.isFinite(matrixDurationSeconds)) return;
    if (candidatePool.length >= poolLimit && matrixDurationSeconds > candidatePool.at(-1)!.matrixDurationSeconds) return;
    let low = 0;
    let high = candidatePool.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      const existing = candidatePool[middle]!;
      if (existing.matrixDurationSeconds < matrixDurationSeconds
        || existing.matrixDurationSeconds === matrixDurationSeconds && existing.order.join(",") <= key) low = middle + 1;
      else high = middle;
    }
    candidatePool.splice(low, 0, { order, matrixDurationSeconds });
    poolKeys.add(key);
    if (candidatePool.length > poolLimit) {
      poolKeys.delete(candidatePool.pop()!.order.join(","));
    }
  };

  for (const seed of seeds) {
    // Keep distinct local optima themselves; alternatives need not be adjacent
    // to the single best matrix order to be useful to the full-route engine.
    add([...seed]);
    // Relocations cover a change of pickup/drop-off neighborhood without editing any address.
    const movableEnd = fixedDestinationIndex === undefined ? size : size - 1;
    for (let from = 0; from < movableEnd; from += 1) {
      for (let to = 0; to < movableEnd; to += 1) {
        if (from === to) continue;
        const order = [...seed];
        const [point] = order.splice(from, 1);
        order.splice(to, 0, point!);
        add(order);
      }
    }

    // Pair swaps add a distinct neighborhood when a single relocation is insufficient.
    for (let left = 0; left < movableEnd; left += 1) {
      for (let right = left + 1; right < movableEnd; right += 1) {
        const order = [...seed];
        [order[left], order[right]] = [order[right]!, order[left]!];
        add(order);
      }
    }
  }

  return candidatePool.slice(0, limit);
}

/** Selects the fastest road-engine-validated candidate; `null` means a U-turn was rejected. */
export async function selectFastestFeasibleAlternative<T extends { durationSeconds: number }>(
  candidates: Candidate[],
  evaluate: (order: number[]) => Promise<T | null>
): Promise<FeasibleCandidate<T> | null> {
  let best: FeasibleCandidate<T> | null = null;
  for (const candidate of candidates) {
    const route = await evaluate(candidate.order);
    if (!route) continue;
    if (!best || route.durationSeconds < best.route.durationSeconds || (route.durationSeconds === best.route.durationSeconds && candidate.matrixDurationSeconds < best.matrixDurationSeconds)) {
      best = { ...candidate, route };
    }
  }
  return best;
}

/** Compares the matrix seed with road-engine-calculated alternatives using actual route metrics. */
export async function selectFastestRoutedOrder<T extends { durationSeconds: number; distanceMeters: number }>(
  seed: Candidate,
  seedRoute: T,
  candidates: Candidate[],
  evaluate: (order: number[]) => Promise<T | null>,
  concurrency = 2
): Promise<RoutedOrder<T>> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("La concurrencia de rutas candidatas no es válida.");
  let best: RoutedOrder<T> = { ...seed, route: seedRoute, alternativeApplied: false, alternativesEvaluated: 0, alternativesFailed: 0 };
  let alternativesFailed = 0;
  for (let offset = 0; offset < candidates.length; offset += concurrency) {
    const batch = candidates.slice(offset, offset + concurrency);
    const results = await Promise.all(batch.map(async (candidate) => ({ candidate, route: await evaluate(candidate.order).catch(() => null) })));
    best.alternativesEvaluated += batch.length;
    alternativesFailed += results.filter(({ route }) => route === null).length;
    for (const { candidate, route } of results) {
      if (!route) continue;
      if (route.durationSeconds < best.route.durationSeconds
        || route.durationSeconds === best.route.durationSeconds && route.distanceMeters < best.route.distanceMeters) {
        best = { ...candidate, route, alternativeApplied: true, alternativesEvaluated: best.alternativesEvaluated, alternativesFailed };
      }
    }
  }
  return { ...best, alternativesEvaluated: candidates.length, alternativesFailed };
}
