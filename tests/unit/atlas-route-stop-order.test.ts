import { describe, expect, it } from "vitest";
import { appendRouteStop, moveRouteStop, normalizeRouteStops, setFixedDestination } from "../../src/modules/operaciones/lib/routeStopOrder";

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

  it("allows one non-first point to be fixed as destination and toggled off", () => {
    const stops = makeStops("origin", "point-1", "point-2", "point-3");
    const fixed = setFixedDestination(stops, "point-2");

    expect(fixed.filter(({ fixedDestination }) => fixedDestination).map(({ id }) => id)).toEqual(["point-2"]);
    expect(fixed.find(({ id }) => id === "point-2")?.kind).toBe("destination");
    expect(fixed.find(({ id }) => id === "point-3")?.kind).toBe("stop");

    const cleared = setFixedDestination(fixed, "point-2");
    expect(cleared.some(({ fixedDestination }) => fixedDestination)).toBe(false);
    expect(cleared.at(-1)?.kind).toBe("destination");
  });

  it("does not allow converting the first point into a fixed destination", () => {
    const stops = makeStops("origin", "point-1");
    expect(setFixedDestination(stops, "origin").some(({ fixedDestination }) => fixedDestination)).toBe(false);
  });
});
