import { describe, expect, it } from "vitest";
import { formatDriverSimulationError } from "../../src/modules/operaciones/lib/routeSimulation";

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
