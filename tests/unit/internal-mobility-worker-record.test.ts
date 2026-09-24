import { describe, expect, it } from "vitest";
import { buildInternalMobilityWorkerRecordLabel } from "../../src/modules/internal_mobility/lib/workerPresentation";
import type { InternalMobilityEligibleWorker } from "../../src/modules/internal_mobility/types";

function buildWorker(
  overrides: Partial<InternalMobilityEligibleWorker> = {}
): InternalMobilityEligibleWorker {
  return {
    bukEmployeeId: "41001",
    fullName: "Persona de prueba",
    documentNumber: "12.345.678-5",
    jobTitle: "Conductor",
    contractCode: "CONT-001",
    areaName: "Contrato Norte",
    companyName: "Buses JM",
    activeRecordCount: 1,
    displayLabel: "Persona de prueba",
    ...overrides
  };
}

describe("internal mobility worker record labels", () => {
  it("mantiene la presentación normal cuando existe una sola ficha activa", () => {
    expect(buildInternalMobilityWorkerRecordLabel(buildWorker())).toBe("Contrato Norte");
  });

  it("identifica la ficha BUK cuando el RUT tiene múltiples fichas activas", () => {
    expect(
      buildInternalMobilityWorkerRecordLabel(
        buildWorker({ activeRecordCount: 2, bukEmployeeId: "41999" })
      )
    ).toBe("Contrato Norte · Ficha BUK 41999");
  });
});
