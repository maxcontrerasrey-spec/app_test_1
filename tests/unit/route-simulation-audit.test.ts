import { describe, expect, it } from "vitest";
import type { Route } from "@stadiamaps/ferrostar";
import { hasValidManeuverLegContext } from "../../supabase/functions/atlas-tomtom-planning/routeIntelligence";
import { toAtlasPlannedRoute } from "../../src/modules/operaciones/lib/routeSimulation";
import type { AtlasPlannedRoute } from "../../src/modules/operaciones/services/atlasOperationsApi";

const point = (lat: number, lng: number) => ({ lat, lng });
const step = (geometry: ReturnType<typeof point>[], maneuverType: "depart" | "turn" | "arrive", modifier: "straight" | "right" | undefined, instruction: string) => ({
  geometry,
  distance: 50,
  duration: 10,
  roadName: "Avenida Test",
  exits: [],
  instruction,
  visualInstructions: [{
    primaryContent: { maneuverType, maneuverModifier: modifier },
    secondaryContent: undefined,
    subContent: undefined
  }],
  spokenInstructions: [],
  annotations: undefined,
  incidents: [],
  drivingSide: "right",
  roundaboutExitNumber: undefined
});

describe("driver route AI audit mapping", () => {
  it("maps the exact simulated path, turns, and stop-to-leg context into the audit contract", () => {
    const start = point(-22, -69);
    const middle = point(-22.001, -69);
    const end = point(-22.002, -69);
    const route = {
      geometry: [start, middle, end],
      bbox: { sw: start, ne: end },
      distance: 100,
      waypoints: [start, middle, end].map((coordinate) => ({ coordinate, kind: "Break" })),
      steps: [
        step([start, middle], "depart", "straight", "Continúe por Avenida Test"),
        step([middle, end], "turn", "right", "Gire a la derecha"),
        step([end], "arrive", undefined, "Llegada al destino")
      ]
    } as unknown as Route;
    const reference: AtlasPlannedRoute = {
      coordinates: [], distanceMeters: 99, durationSeconds: 20, provider: "valhalla", travelMode: "bus",
      plannedVehicleType: "Minibus", referenceModel: "Sprinter", maneuvers: []
    };

    const audited = toAtlasPlannedRoute(route, reference, 3);
    expect(audited.coordinates).toEqual([[-69, -22], [-69, -22.001], [-69, -22.002]]);
    expect(audited.distanceMeters).toBe(100);
    expect(audited.durationSeconds).toBe(30);
    expect(audited.maneuvers?.map(({ maneuverType }) => maneuverType)).toEqual(["STRAIGHT", "RIGHT", "STRAIGHT"]);
    expect(audited.maneuvers?.map(({ routeLegIndex }) => routeLegIndex)).toEqual([0, 1, 1]);
    expect(hasValidManeuverLegContext(audited.maneuvers!, 3)).toBe(true);
  });

  it("fails closed when the exact driver route lacks waypoint-to-leg evidence", () => {
    const route = {
      geometry: [point(-22, -69), point(-22.001, -69)],
      bbox: { sw: point(-22, -69), ne: point(-22.001, -69) },
      distance: 20,
      waypoints: [{ coordinate: point(-22, -69), kind: "Break" }],
      steps: [step([point(-22, -69), point(-22.001, -69)], "depart", "straight", "Continúe")]
    } as unknown as Route;
    const reference = { coordinates: [], distanceMeters: 0, durationSeconds: 0, provider: "valhalla", travelMode: "bus" } as AtlasPlannedRoute;
    const audited = toAtlasPlannedRoute(route, reference, 2);
    expect(audited.maneuvers?.[0]?.routeLegIndex).toBeNull();
    expect(hasValidManeuverLegContext(audited.maneuvers!, 2)).toBe(false);
  });

  it("attributes intermediate arrival instructions to the leg that just ended", () => {
    const start = point(-22, -69);
    const middle = point(-22.001, -69);
    const end = point(-22.002, -69);
    const route = {
      geometry: [start, middle, end],
      bbox: { sw: start, ne: end },
      distance: 100,
      waypoints: [start, middle, end].map((coordinate) => ({ coordinate, kind: "Break" })),
      steps: [
        step([start, middle], "depart", "straight", "Continúe"),
        step([middle], "arrive", undefined, "Llegada a la parada"),
        step([middle, end], "depart", "straight", "Continúe a la siguiente parada"),
        step([end], "arrive", undefined, "Llegada al destino")
      ]
    } as unknown as Route;
    const reference: AtlasPlannedRoute = { coordinates: [], distanceMeters: 0, durationSeconds: 0, provider: "valhalla", travelMode: "bus" };
    const audited = toAtlasPlannedRoute(route, reference, 3);
    expect(audited.maneuvers?.map(({ routeLegIndex }) => routeLegIndex)).toEqual([0, 0, 1, 1]);
    expect(hasValidManeuverLegContext(audited.maneuvers!, 3)).toBe(true);
  });
});
