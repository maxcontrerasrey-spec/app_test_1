type Candidate = { order: number[]; matrixDurationSeconds: number };

export type FeasibleCandidate<T> = Candidate & { route: T };

/**
 * Produces a small, deterministic set of nearby orders for road-engine validation.
 * The duration matrix ranks candidates; Valhalla's route response decides feasibility.
 */
export function buildRouteOrderAlternatives(
  durations: number[][],
  seedOrder: number[],
  fixedDestinationIndex?: number,
  limit = 4
): Candidate[] {
  const size = durations.length;
  if (size < 2 || durations.some((row) => row.length !== size)) throw new Error("La matriz de tiempos no es válida.");
  if (seedOrder.length !== size || new Set(seedOrder).size !== size || seedOrder.some((index) => !Number.isInteger(index) || index < 0 || index >= size)) {
    throw new Error("El orden de entrada no contiene todos los puntos.");
  }
  if (!Number.isInteger(limit) || limit < 1) throw new Error("El límite de alternativas no es válido.");
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

  const candidates = new Map<string, Candidate>();
  const add = (order: number[]) => {
    if (order.every((point, index) => point === seedOrder[index])) return;
    if (fixedDestinationIndex !== undefined && order.at(-1) !== fixedDestinationIndex) return;
    const matrixDurationSeconds = duration(order);
    if (!Number.isFinite(matrixDurationSeconds)) return;
    candidates.set(order.join(","), { order, matrixDurationSeconds });
  };

  // Relocations cover a change of pickup/drop-off neighborhood without editing any address.
  const movableEnd = fixedDestinationIndex === undefined ? size : size - 1;
  for (let from = 0; from < movableEnd; from += 1) {
    for (let to = 0; to < movableEnd; to += 1) {
      if (from === to) continue;
      const order = [...seedOrder];
      const [point] = order.splice(from, 1);
      order.splice(to, 0, point!);
      add(order);
    }
  }

  // Pair swaps add a distinct neighborhood when a single relocation is insufficient.
  for (let left = 0; left < movableEnd; left += 1) {
    for (let right = left + 1; right < movableEnd; right += 1) {
      const order = [...seedOrder];
      [order[left], order[right]] = [order[right]!, order[left]!];
      add(order);
    }
  }

  return [...candidates.values()]
    .sort((a, b) => a.matrixDurationSeconds - b.matrixDurationSeconds || a.order.join(",").localeCompare(b.order.join(",")))
    .slice(0, limit);
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
