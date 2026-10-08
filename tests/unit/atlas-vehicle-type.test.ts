import { describe, expect, it } from "vitest";
import { getAvailableVehicleTypes, vehicleTypeMismatch } from "../../src/modules/operaciones/lib/vehicleType";
import { atlasVehicleTypesMatch, getAvailableAtlasRouteVehicleCategories, resolveAtlasRouteVehicleCategory, resolveAtlasVehicleRoutingModel } from "../../src/modules/operaciones/lib/vehicleRoutingCosting";

describe("Atlas planned vehicle type", () => {
  it("lists distinct non-empty fleet types in a stable user-facing order", () => {
    expect(getAvailableVehicleTypes([
      { vehicle_type: " Bus " }, { vehicle_type: "bus" }, { vehicle_type: null },
      { vehicle_type: "MINIBUS" }, { vehicle_type: "" }
    ])).toEqual(["Bus", "MINIBUS"]);
  });

  it("does not warn when either type is unknown and compares labels case-insensitively", () => {
    expect(vehicleTypeMismatch(null, "Bus")).toBe(false);
    expect(vehicleTypeMismatch(" Bus ", "bus")).toBe(false);
    expect(vehicleTypeMismatch("Taxi-Bus", "Minibus")).toBe(true);
  });
});

describe("Atlas route vehicle categories", () => {
  it("offers only the supported categories and consolidates fleet aliases", () => {
    expect(getAvailableAtlasRouteVehicleCategories([
      { vehicle_type: "BUS 1 PISO" }, { vehicle_type: "BUS ELECTRICO" },
      { vehicle_type: "TAXI -BUS" }, { vehicle_type: "MINI BUS" },
      { vehicle_type: "CAMIONETA" }, { vehicle_type: "FURGON" }
    ])).toEqual(["Bus", "Taxibus", "Minibus"]);
  });

  it("classifies taxibus before bus and recognizes historical spellings", () => {
    expect(resolveAtlasRouteVehicleCategory("TAXI-BUS")).toBe("Taxibus");
    expect(resolveAtlasRouteVehicleCategory("MINIBUS-ELECTRICO")).toBe("Minibus");
    expect(resolveAtlasRouteVehicleCategory("BUS 1 1/2 PISO")).toBe("Bus");
    expect(resolveAtlasRouteVehicleCategory("CAMION")).toBeNull();
  });

  it("uses the passenger-bus profile and model reference parameters", () => {
    expect(resolveAtlasVehicleRoutingModel("Minibus")).toMatchObject({
      model: expect.stringContaining("Sprinter Pasaje 517"),
      costing: "bus",
      dimensions: { length: 7.367, width: 2.02, height: 2.874, weight: 5 }
    });
  });

  it("compares a planned category with equivalent fleet aliases", () => {
    expect(atlasVehicleTypesMatch("Taxibus", "TAXI -BUS")).toBe(true);
    expect(atlasVehicleTypesMatch("Bus", "MINIBUS")).toBe(false);
    expect(atlasVehicleTypesMatch("Bus", "CAMION")).toBe(false);
  });
});
