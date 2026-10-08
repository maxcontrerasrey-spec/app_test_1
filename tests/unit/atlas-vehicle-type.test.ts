import { describe, expect, it } from "vitest";
import { getAvailableVehicleTypes, vehicleTypeMismatch } from "../../src/modules/operaciones/lib/vehicleType";

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
