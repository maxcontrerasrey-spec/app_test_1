import { describe, expect, it } from "vitest";
import { appendRouteStop, moveRouteStop, normalizeRouteStops } from "../../src/modules/operaciones/lib/routeStopOrder";

const makeStops = (...ids: string[]) => normalizeRouteStops(ids.map((id) => ({ id, kind: "stop" as const })));

describe("Atlas route stop order", () => {
  it("appends a new address after the current final address", () => {
    const stops = appendRouteStop(makeStops("origin", "previous-destination"), { id: "new-point", kind: "stop" });

    expect(stops.map(({ id }) => id)).toEqual(["origin", "previous-destination", "new-point"]);
    expect(stops.map(({ kind }) => kind)).toEqual(["origin", "stop", "destination"]);
  });

  it("reorders endpoints and intermediate points, deriving their roles from the new order", () => {
    const stops = moveRouteStop(makeStops("origin", "point-1", "destination"), "destination", -1);

    expect(stops.map(({ id }) => id)).toEqual(["origin", "destination", "point-1"]);
    expect(stops.map(({ kind }) => kind)).toEqual(["origin", "stop", "destination"]);
  });

  it("keeps the first and last points at the list boundaries", () => {
    const stops = makeStops("origin", "destination");

    expect(moveRouteStop(stops, "origin", -1)).toBe(stops);
    expect(moveRouteStop(stops, "destination", 1)).toBe(stops);
  });
});
