import { describe, expect, it } from "vitest";
import {
  resolveIncentiveContractMismatch,
  resolveIncentivePeriodCode,
  resolveIncentiveRegistrationWindow
} from "../../src/modules/incentives/lib/incentiveRules";

describe("incentiveRules", () => {
  it("corta el periodo comercial el dia 21 del mes", () => {
    expect(resolveIncentivePeriodCode("2026-07-20")).toBe("202607");
    expect(resolveIncentivePeriodCode("2026-07-21")).toBe("202608");
  });

  it("mantiene la ventana de registro entre 0 y 7 dias sin alterar el periodo", () => {
    const window = resolveIncentiveRegistrationWindow("2026-07-19", "2026-07-22");

    expect(window).toMatchObject({
      entryLagDays: 3,
      isOutOfDeadline: true,
      isAllowed: true,
      periodCode: "202607",
      minimumDateValue: "2026-07-15",
      maximumDateValue: "2026-07-22"
    });
  });

  it("marca mismatch solo cuando ambos contratos existen y difieren", () => {
    expect(resolveIncentiveContractMismatch("CONT-028", "CONT-029")).toBe(true);
    expect(resolveIncentiveContractMismatch("CONT-028", "CONT-028")).toBe(false);
    expect(resolveIncentiveContractMismatch(null, "CONT-028")).toBe(false);
  });
});
