import { describe, expect, it } from "vitest";
import { buildCalamaExampleStops, CALAMA_EXAMPLE_ADDRESS_QUERIES, matchRouteDestinationPresets, ROUTE_DESTINATION_PRESETS } from "../../src/modules/operaciones/lib/routeDestinationCatalog";

describe("Atlas route destination catalog", () => {
  it("keeps the three confirmed destination coordinates", () => {
    expect(ROUTE_DESTINATION_PRESETS.map(({ id, lat, lng }) => [id, lat, lng])).toEqual([
      ["bcd-dmh", -22.358077, -68.902838],
      ["casa-cambio-mina-dmh", -22.402779, -68.912804],
      ["porteria-minera-el-abra", -22.035762, -68.630502]
    ]);
  });

  it.each([
    ["barrio civico", "bcd-dmh"],
    ["BCD DMH", "bcd-dmh"],
    ["casa cambio mina", "casa-cambio-mina-dmh"],
    ["casa de cambio mina dmh", "casa-cambio-mina-dmh"],
    ["porteria el abra", "porteria-minera-el-abra"]
  ])("matches destination alias %s", (query, destinationId) => {
    expect(matchRouteDestinationPresets(query).some(({ id }) => id === destinationId)).toBe(true);
  });

  it("offers every curated destination when the destination field is empty", () => {
    expect(matchRouteDestinationPresets("").map(({ id }) => id)).toEqual(ROUTE_DESTINATION_PRESETS.map(({ id }) => id));
  });

  it("loads the Calama example destination from the confirmed preset without geocoding its internal name", () => {
    const stops = buildCalamaExampleStops([
      { label: "Av. Balmaceda 3242, Calama", lat: -22.45, lng: -68.92, providerPlaceId: "tomtom-1" },
      { label: "Frei Bonn 3516, Calama", lat: -22.44, lng: -68.91, providerPlaceId: "tomtom-2" }
    ], (() => {
      let id = 0;
      return () => `example-${++id}`;
    })());

    expect(CALAMA_EXAMPLE_ADDRESS_QUERIES).toHaveLength(2);
    expect(stops.map(({ source }) => source)).toEqual(["tomtom", "tomtom", "preset"]);
    expect(stops.at(-1)).toMatchObject({
      id: "example-3",
      kind: "destination",
      fixedDestination: true,
      label: ROUTE_DESTINATION_PRESETS[0]!.label,
      lat: -22.358077,
      lng: -68.902838,
      providerPlaceId: null,
      source: "preset"
    });
  });
});
