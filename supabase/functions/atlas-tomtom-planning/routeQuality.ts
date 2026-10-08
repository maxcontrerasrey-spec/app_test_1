export type RouteManeuver = {
  type?: number;
  instruction?: string;
  begin_shape_index?: number;
  bearing_before?: number;
  bearing_after?: number;
  street_names?: string[];
  latitude?: number;
  longitude?: number;
};
/** `break` preserves arrival/departure guidance and allows a U-turn when Valhalla's graph supports one. */
export function routeLocationType(_index: number, _size: number): "break" {
  return "break";
}

/** Valhalla maneuver codes 12 and 13 identify a U-turn, not a requirement to reverse. */
export function hasUTurn(maneuvers: RouteManeuver[]): boolean {
  return maneuvers.some((maneuver) => maneuver.type === 12 || maneuver.type === 13);
}

export function countUTurns(maneuvers: RouteManeuver[]): number {
  return maneuvers.filter((maneuver) => maneuver.type === 12 || maneuver.type === 13).length;
}
