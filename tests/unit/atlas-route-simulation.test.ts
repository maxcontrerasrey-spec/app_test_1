import { describe, expect, it } from "vitest";
import { mergeFerrostarRouteSegments, formatDriverSimulationError, routeGeometriesMatch, splitRouteStops } from "../../src/modules/operaciones/lib/routeSimulation";
import type { Route } from "@stadiamaps/ferrostar";

function route(start: number, end: number, distance: number): Route {
  const startPoint = { lat: -22, lng: start };
  const endPoint = { lat: -22, lng: end };
  return {
    geometry: [startPoint, endPoint],
    bbox: { sw: { lat: -22, lng: start }, ne: { lat: -22, lng: end } },
    distance,
    waypoints: [startPoint, endPoint].map((coordinate) => ({ coordinate, kind: "Break", properties: undefined })),
    steps: []
  };
}

describe("Valhalla route segments", () => {
  it("accepts equivalent Valhalla paths with different point density and rejects a divergent street", () => {
    const server = [[-69, -22], [-69.0001, -22], [-69.0002, -22], [-69.0003, -22]] as Array<[number, number]>;
    const samePath = server.map(([lng, lat]) => ({ lat, lng }));
    const differentStreet = server.map(([lng, lat]) => ({ lat, lng: lng + 0.002 }));
    expect(routeGeometriesMatch(server, [...samePath, { lat: -22, lng: -69.0003 }])).toBe(true);
    expect(routeGeometriesMatch(server, differentStreet)).toBe(false);
    expect(routeGeometriesMatch(server, [...samePath].reverse())).toBe(false);
    expect(routeGeometriesMatch(server.slice(0, 1), samePath)).toBe(false);
  });

  it("splits 12 stops into requests of ten and three with an overlapping boundary", () => {
    const stops = Array.from({ length: 12 }, (_, index) => index);
    const segments = splitRouteStops(stops);

    expect(segments.map((segment) => segment.length)).toEqual([10, 3]);
    expect(segments[0]!.at(-1)).toBe(segments[1]![0]);
    expect(segments.flat().filter((stop) => stop === 9)).toHaveLength(2);
  });

  it("keeps a single request for up to ten locations", () => {
    expect(splitRouteStops(Array.from({ length: 10 }, (_, index) => index))).toHaveLength(1);
  });

  it("merges route geometry, waypoints, distance and bounds without duplicating the shared stop", () => {
    const merged = mergeFerrostarRouteSegments([route(0, 1, 100), route(1, 2, 250)]);

    expect(merged.geometry).toEqual([{ lat: -22, lng: 0 }, { lat: -22, lng: 1 }, { lat: -22, lng: 2 }]);
    expect(merged.waypoints).toHaveLength(3);
    expect(merged.distance).toBe(350);
    expect(merged.bbox).toEqual({ sw: { lat: -22, lng: 0 }, ne: { lat: -22, lng: 2 } });
  });
});

describe("formatDriverSimulationError", () => {
  it("preserves useful string rejections from Ferrostar/WASM", () => {
    expect(formatDriverSimulationError("Valhalla route failed")).toBe("Valhalla route failed");
  });

  it("extracts safe error details from objects and removes control characters", () => {
    expect(formatDriverSimulationError({ error: "HTTP 503\nValhalla busy" })).toBe("HTTP 503 Valhalla busy");
  });

  it("uses the error message or a clear fallback", () => {
    expect(formatDriverSimulationError(new Error("Network unavailable"))).toBe("Network unavailable");
    expect(formatDriverSimulationError({ code: 4 })).toBe("No fue posible iniciar la simulación del conductor.");
  });
});
