export type RouteStopKind = "origin" | "stop" | "destination";
export type OrderedRouteStop = { id: string; kind: RouteStopKind };
export type NormalizedRouteStop<T extends OrderedRouteStop> = Omit<T, "kind"> & { kind: RouteStopKind };

export function normalizeRouteStops<T extends OrderedRouteStop>(stops: T[]): NormalizedRouteStop<T>[] {
  return stops.map((stop, index) => ({
    ...stop,
    kind: index === 0 ? "origin" : index === stops.length - 1 && stops.length > 1 ? "destination" : "stop"
  }));
}

export function appendRouteStop<T extends OrderedRouteStop>(stops: T[], newStop: T): NormalizedRouteStop<T>[] {
  return normalizeRouteStops([...stops, newStop]);
}

export function moveRouteStop<T extends OrderedRouteStop>(stops: T[], id: string, direction: -1 | 1): NormalizedRouteStop<T>[] {
  const index = stops.findIndex((stop) => stop.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= stops.length) return stops;
  const reordered = [...stops];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex]!, reordered[index]!];
  return normalizeRouteStops(reordered);
}
