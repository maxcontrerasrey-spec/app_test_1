export type RouteStopKind = "origin" | "stop" | "destination";
export type OrderedRouteStop = { id: string; kind: RouteStopKind; fixedDestination?: boolean };
export type NormalizedRouteStop<T extends OrderedRouteStop> = Omit<T, "kind"> & { kind: RouteStopKind };

export function normalizeRouteStops<T extends OrderedRouteStop>(stops: T[]): NormalizedRouteStop<T>[] {
  const hasFixedDestination = stops.some((stop) => stop.fixedDestination);
  return stops.map((stop, index) => ({
    ...stop,
    kind: stop.fixedDestination ? "destination" : index === 0 ? "origin" : !hasFixedDestination && index === stops.length - 1 && stops.length > 1 ? "destination" : "stop"
  }));
}

export function setFixedDestination<T extends OrderedRouteStop>(stops: T[], id: string): NormalizedRouteStop<T>[] {
  const selectedIndex = stops.findIndex((stop) => stop.id === id);
  if (selectedIndex <= 0) return normalizeRouteStops(stops);
  const selectedIsDestination = Boolean(stops[selectedIndex]?.fixedDestination);
  return normalizeRouteStops(stops.map((stop, index) => ({
    ...stop,
    fixedDestination: !selectedIsDestination && index === selectedIndex
  })));
}

export function appendRouteStop<T extends OrderedRouteStop>(stops: T[], newStop: T): NormalizedRouteStop<T>[] {
  return normalizeRouteStops([...stops, newStop]);
}

export function moveRouteStop<T extends OrderedRouteStop>(stops: T[], id: string, direction: -1 | 1): NormalizedRouteStop<T>[] {
  const index = stops.findIndex((stop) => stop.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= stops.length) return stops;
  if (stops[index]?.fixedDestination && nextIndex === 0) return stops;
  const reordered = [...stops];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex]!, reordered[index]!];
  return normalizeRouteStops(reordered);
}
