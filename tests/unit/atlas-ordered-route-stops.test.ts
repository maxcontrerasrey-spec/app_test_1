import { describe, expect, it } from "vitest";
import { orderRouteStopsByIndex } from "../../supabase/functions/atlas-tomtom-planning/orderedRouteStops";

describe("Atlas signed route stop ordering", () => {
  it("applies Valhalla's optimized order once and preserves adjusted access coordinates", () => {
    const inputStops = [
      { id: "A", lat: -22.45, lng: -68.93 },
      { id: "B", lat: -22.46, lng: -68.94 },
      { id: "C", lat: -22.47, lng: -68.95 }
    ];
    const stopsByInputIndex = inputStops.map((stop) => ({ ...stop }));
    stopsByInputIndex[2] = { ...stopsByInputIndex[2]!, lat: -22.4701 };
    const optimizedOrder = [2, 0, 1];

    const signedStops = orderRouteStopsByIndex(stopsByInputIndex, optimizedOrder);

    expect(signedStops).toEqual([
      { id: "C", lat: -22.4701, lng: -68.95 },
      { id: "A", lat: -22.45, lng: -68.93 },
      { id: "B", lat: -22.46, lng: -68.94 }
    ]);
    expect(orderRouteStopsByIndex(inputStops, optimizedOrder)).not.toEqual(
      orderRouteStopsByIndex(signedStops, optimizedOrder)
    );
  });

  it.each([
    [[0, 0, 2]],
    [[0, 1]],
    [[0, 1, 3]],
    [[0, 1, 1.5]]
  ])("rejects an invalid optimizer permutation %j", (order) => {
    expect(() => orderRouteStopsByIndex(["A", "B", "C"], order)).toThrow("route_stop_order_invalid");
  });
});
