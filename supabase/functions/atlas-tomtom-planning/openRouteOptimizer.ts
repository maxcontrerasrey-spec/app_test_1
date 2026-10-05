/** Deterministic open-path optimizer for a directed Valhalla duration matrix. */
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
  let best = [...normalizedOriginalOrder];
  let bestCost = cost(best);
  if (!Number.isFinite(bestCost)) bestCost = Number.POSITIVE_INFINITY;

  const startStep = Math.max(1, Math.ceil(size / 32));
  for (let start = 0; start < size; start += startStep) {
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
        if (candidateCost < nextCost || (candidateCost === nextCost && candidate < next)) {
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
          const delta = newBefore + newAfter - oldBefore - oldAfter + internalDelta;
          if (delta < -1e-6) {
            order.splice(left, right - left + 1, ...order.slice(left, right + 1).reverse());
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }
    const routeCost = cost(order);
    if (routeCost < bestCost || (routeCost === bestCost && order.join(",") < best.join(","))) {
      best = order;
      bestCost = routeCost;
    }
  }
  if (!Number.isFinite(bestCost)) throw new Error("Valhalla no encontró conexiones transitables entre todos los puntos.");
  return {
    order: best,
    durationSeconds: Math.round(bestCost),
    inputOrderDurationSeconds: Number.isFinite(cost(normalizedOriginalOrder)) ? Math.round(cost(normalizedOriginalOrder)) : null
  };
}
