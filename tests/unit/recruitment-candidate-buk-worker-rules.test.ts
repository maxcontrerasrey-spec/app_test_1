import { describe, expect, it } from "vitest";
import {
  applyCandidateBukWorkerDefaults,
  collectCandidateBukWorkerMissingFields
} from "../../src/modules/recruitment/lib/candidateBukWorkerRules";

function buildDraft(overrides: Partial<Parameters<typeof applyCandidateBukWorkerDefaults>[0]> = {}) {
  return {
    employeeCode: "F1",
    companyEntryDate: "2026-07-22",
    privateRole: "",
    afcStartDate: "",
    seniorityRecognitionDate: "",
    progressiveVacationStartDate: "",
    paymentMethod: "Transferencia",
    paymentPeriod: "Mensual",
    valeVistaType: "Retiro por caja",
    pensionRegime: "AFP",
    contributionFund: "Habitat",
    afpCollectionEntity: "",
    increaseQuoteOnePercent: "",
    healthProvider: "Fonasa",
    healthPlanUf: "1.5",
    healthPlanPesos: "50000",
    healthPlanPercentage: "",
    afcRegime: "",
    retiredStatus: "No",
    retirementRegime: "Jubilado antiguo",
    ...overrides
  };
}

describe("candidate BUK worker rules", () => {
  it("aplica defaults contractuales sin exigir campos que se derivan por negocio", () => {
    const result = applyCandidateBukWorkerDefaults(buildDraft());

    expect(result.privateRole).toBe("No");
    expect(result.afcStartDate).toBe("2026-07-22");
    expect(result.seniorityRecognitionDate).toBe("2026-07-22");
    expect(result.progressiveVacationStartDate).toBe("2026-07-22");
    expect(result.afpCollectionEntity).toBe("Habitat");
    expect(result.increaseQuoteOnePercent).toBe("No");
    expect(result.afcRegime).toBe("Menos de 11 Años");
    expect(result.healthPlanUf).toBe("");
    expect(result.healthPlanPesos).toBe("");
    expect(result.healthPlanPercentage).toBe("7");
    expect(result.retirementRegime).toBe("");
  });

  it("exige plan Isapre y regimen de jubilacion solo cuando aplican", () => {
    const missing = collectCandidateBukWorkerMissingFields(
      buildDraft({
        healthProvider: "Isapre Colmena",
        healthPlanUf: "",
        retiredStatus: "Sí",
        retirementRegime: ""
      })
    );

    expect(missing).toContain("Plan Isapre UF");
    expect(missing).toContain("Régimen jubilación");
  });
});
