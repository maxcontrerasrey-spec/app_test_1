/** Applies Valhalla's stop order once to stops kept in their original input order. */
export function orderRouteStopsByIndex<T>(stops: T[], order: number[]): T[] {
  if (stops.length < 2 || order.length !== stops.length) throw new Error("route_stop_order_invalid");
  const seen = new Set<number>();
  for (const index of order) {
    if (!Number.isInteger(index) || index < 0 || index >= stops.length || seen.has(index)) {
      throw new Error("route_stop_order_invalid");
    }
    seen.add(index);
  }
  return order.map((index) => stops[index]!);
}
