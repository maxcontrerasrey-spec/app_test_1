import { describe, expect, it } from "vitest";
import { matchRouteDestinationPresets, ROUTE_DESTINATION_PRESETS } from "../../src/modules/operaciones/lib/routeDestinationCatalog";

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
});
