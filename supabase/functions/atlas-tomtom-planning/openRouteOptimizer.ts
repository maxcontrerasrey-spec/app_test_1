/** Deterministic open-path optimizer for a directed Valhalla duration matrix. */
const EXACT_SEARCH_MAX_STOPS = 12;

type ScoredOrder = { order: number[]; durationSeconds: number };

function solveExactly(
  durations: number[][],
  fixedDestinationIndex: number | undefined,
  leg: (from: number, to: number) => number
): ScoredOrder {
  const size = durations.length;
  const nodes = Array.from({ length: size }, (_, index) => index)
    .filter((index) => index !== fixedDestinationIndex);
  const count = nodes.length;
  const stateCount = 1 << count;
  const values = new Float64Array(stateCount * count).fill(Number.POSITIVE_INFINITY);
  const parents = new Int16Array(stateCount * count).fill(-2);

  for (let node = 0; node < count; node += 1) {
    const state = 1 << node;
    values[state * count + node] = 0;
    parents[state * count + node] = -1;
  }

  for (let state = 1; state < stateCount; state += 1) {
    for (let last = 0; last < count; last += 1) {
      if (!(state & (1 << last))) continue;
      const previousState = state ^ (1 << last);
      if (previousState === 0) continue;
      let best = Number.POSITIVE_INFINITY;
      let bestPrevious = -1;
      for (let previous = 0; previous < count; previous += 1) {
        if (!(previousState & (1 << previous))) continue;
        const candidate = values[previousState * count + previous]! + leg(nodes[previous]!, nodes[last]!);
        if (candidate < best || candidate === best && nodes[previous]! < (bestPrevious < 0 ? Number.POSITIVE_INFINITY : nodes[bestPrevious]!)) {
          best = candidate;
          bestPrevious = previous;
        }
      }
      values[state * count + last] = best;
      parents[state * count + last] = bestPrevious;
    }
  }

  const fullState = stateCount - 1;
  let last = -1;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let candidateLast = 0; candidateLast < count; candidateLast += 1) {
    const candidateCost = values[fullState * count + candidateLast]!
      + (fixedDestinationIndex === undefined ? 0 : leg(nodes[candidateLast]!, fixedDestinationIndex));
    if (candidateCost < bestCost || candidateCost === bestCost && nodes[candidateLast]! < (last < 0 ? Number.POSITIVE_INFINITY : nodes[last]!)) {
      bestCost = candidateCost;
      last = candidateLast;
    }
  }
  if (last < 0 || !Number.isFinite(bestCost)) throw new Error("Valhalla no encontró conexiones transitables entre todos los puntos.");

  const reversed: number[] = [];
  let state = fullState;
  while (last >= 0) {
    reversed.push(nodes[last]!);
    const previous = parents[state * count + last]!;
    state ^= 1 << last;
    last = previous;
  }
  const order = reversed.reverse();
  if (fixedDestinationIndex !== undefined) order.push(fixedDestinationIndex);
  return { order, durationSeconds: bestCost };
}

export function optimizeOpenRoute(
  durations: number[][],
  originalOrder = durations.map((_, index) => index),
  fixedDestinationIndex?: number
) {
  const size = durations.length;
  if (size < 2 || durations.some((row) => row.length !== size)) throw new Error("La matriz de tiempos no es válida.");
  if (originalOrder.length !== size || new Set(originalOrder).size !== size || originalOrder.some((index) => index < 0 || index >= size)) {
    throw new Error("El orden de entrada no contiene todos los puntos.");
  }
  if (fixedDestinationIndex !== undefined && (!Number.isInteger(fixedDestinationIndex) || fixedDestinationIndex <= 0 || fixedDestinationIndex >= size)) {
    throw new Error("El destino fijado debe ser una parada distinta del primer punto.");
  }
  const normalizedOriginalOrder = fixedDestinationIndex === undefined
    ? [...originalOrder]
    : [...originalOrder.filter((index) => index !== fixedDestinationIndex), fixedDestinationIndex];
  const leg = (from: number, to: number) => {
    const value = durations[from]?.[to];
    return from === to ? 0 : typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
  };
  const cost = (order: number[]) => order.slice(1).reduce((total, point, index) => total + leg(order[index]!, point), 0);
  const inputOrderDuration = cost(normalizedOriginalOrder);

  // Exact Held–Karp search prevents local-search traps for small routes. For larger
  // lists the matrix search remains heuristic, while complete routes are still traced.
  if (size <= EXACT_SEARCH_MAX_STOPS) {
    const exact = solveExactly(durations, fixedDestinationIndex, leg);
    return {
      order: exact.order,
      durationSeconds: Math.round(exact.durationSeconds),
      inputOrderDurationSeconds: Number.isFinite(inputOrderDuration) ? Math.round(inputOrderDuration) : null,
      candidateOrders: [{ order: exact.order, durationSeconds: Math.round(exact.durationSeconds) }],
      searchMethod: "EXACT_OPEN_PATH_UP_TO_12" as const
    };
  }

  const greedySeeds: ScoredOrder[] = [];
  for (let start = 0; start < size; start += 1) {
    if (start === fixedDestinationIndex) continue;
    const order = [start];
    const remaining = new Set(Array.from({ length: size }, (_, index) => index)
      .filter((index) => index !== start && index !== fixedDestinationIndex));
    while (remaining.size) {
      const current = order[order.length - 1]!;
      let next = -1;
      let nextCost = Number.POSITIVE_INFINITY;
      for (const candidate of remaining) {
        const candidateCost = leg(current, candidate);
        if (candidateCost < nextCost || candidateCost === nextCost && candidate < next) {
          next = candidate;
          nextCost = candidateCost;
        }
      }
      if (next < 0 || !Number.isFinite(nextCost)) break;
      order.push(next);
      remaining.delete(next);
    }
    if (remaining.size) continue;
    if (fixedDestinationIndex !== undefined) order.push(fixedDestinationIndex);
    greedySeeds.push({ order, durationSeconds: cost(order) });
  }

  const refinementSeeds = greedySeeds
    .sort((left, right) => left.durationSeconds - right.durationSeconds || left.order.join(",").localeCompare(right.order.join(",")))
    .slice(0, 32);
  const localOptima = new Map<string, ScoredOrder>();
  for (const seed of refinementSeeds) {
    const order = [...seed.order];
    let passes = 0;
    let improved = true;
    while (improved && passes < 24) {
      improved = false;
      passes += 1;
      const reverseDeltaPrefix = [0];
      for (let index = 0; index < size - 1; index += 1) {
        reverseDeltaPrefix.push(reverseDeltaPrefix[reverseDeltaPrefix.length - 1]! + leg(order[index + 1]!, order[index]!) - leg(order[index]!, order[index + 1]!));
      }
      for (let left = 0; left < size - 1; left += 1) {
        const reversalEnd = fixedDestinationIndex === undefined ? size : size - 1;
        for (let right = left + 1; right < reversalEnd; right += 1) {
          const oldBefore = left > 0 ? leg(order[left - 1]!, order[left]!) : 0;
          const newBefore = left > 0 ? leg(order[left - 1]!, order[right]!) : 0;
          const oldAfter = right < size - 1 ? leg(order[right]!, order[right + 1]!) : 0;
          const newAfter = right < size - 1 ? leg(order[left]!, order[right + 1]!) : 0;
          const internalDelta = reverseDeltaPrefix[right]! - reverseDeltaPrefix[left]!;
          if (newBefore + newAfter - oldBefore - oldAfter + internalDelta < -1e-6) {
            order.splice(left, right - left + 1, ...order.slice(left, right + 1).reverse());
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }
    const durationSeconds = cost(order);
    if (Number.isFinite(durationSeconds)) localOptima.set(order.join(","), { order, durationSeconds: Math.round(durationSeconds) });
  }
  const candidateOrders = [...localOptima.values()]
    .sort((left, right) => left.durationSeconds - right.durationSeconds || left.order.join(",").localeCompare(right.order.join(",")))
    .slice(0, 16);
  const best = candidateOrders[0];
  if (!best) throw new Error("Valhalla no encontró conexiones transitables entre todos los puntos.");
  return {
    order: best.order,
    durationSeconds: best.durationSeconds,
    inputOrderDurationSeconds: Number.isFinite(inputOrderDuration) ? Math.round(inputOrderDuration) : null,
    candidateOrders,
    searchMethod: "MULTISTART_2OPT_HEURISTIC" as const
  };
}
