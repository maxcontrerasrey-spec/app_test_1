import { describe, expect, it } from "vitest";
import { estimateLocalRouteEnd, getRouteEndpoints } from "../../src/modules/operaciones/lib/routeSchedule";

describe("getRouteEndpoints", () => {
  it("uses the first and last saved stops by stop order", () => {
    expect(getRouteEndpoints([
      { stop_order: 2, label: "  Destino  " },
      { stop_order: 0, label: " Origen " },
      { stop_order: 1, label: "Intermedia" }
    ])).toEqual({ origin: "Origen", destination: "Destino" });
  });

  it("uses a single saved stop as both endpoints and handles empty routes", () => {
    expect(getRouteEndpoints([{ stop_order: 0, label: "Punto único" }])).toEqual({ origin: "Punto único", destination: "Punto único" });
    expect(getRouteEndpoints([])).toEqual({ origin: "", destination: "" });
  });
});

describe("estimateLocalRouteEnd", () => {
  it("adds route duration and rounds up to the next minute", () => {
    expect(estimateLocalRouteEnd("2026-10-08T07:02", 5 * 60 + 1)).toBe("2026-10-08T07:08");
  });

  it("rolls over hour, day and month boundaries", () => {
    expect(estimateLocalRouteEnd("2026-10-31T23:58", 180)).toBe("2026-11-01T00:01");
  });

  it("returns empty when there is no usable route duration or start", () => {
    expect(estimateLocalRouteEnd("", 300)).toBe("");
    expect(estimateLocalRouteEnd("2026-10-08T07:02", null)).toBe("");
    expect(estimateLocalRouteEnd("2026-10-08T07:02", 0)).toBe("");
    expect(estimateLocalRouteEnd("2026-10-08T07:02", -1)).toBe("");
  });
});
