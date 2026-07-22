import { describe, expect, it } from "vitest";
import {
  buildAreaOptionValue,
  buildHourlyRateBreakdownCopy,
  isReplacementWorkerEligible,
  resolveRosterStatusAppearance
} from "../../src/modules/incentives/lib/incentiveRegistrationHelpers";
import type { HrIncentiveRosterSnapshot } from "../../src/modules/incentives/types";

function rosterSnapshot(overrides: Partial<HrIncentiveRosterSnapshot> = {}): HrIncentiveRosterSnapshot {
  return {
    baseStatus: null,
    effectiveStatus: null,
    exceptionType: null,
    exceptionLabel: null,
    patternName: null,
    scheduleStatus: null,
    scheduleLabel: null,
    isWorkingDay: false,
    isRestDay: false,
    blockedByAbsence: false,
    ...overrides
  };
}

describe("incentiveRegistrationHelpers", () => {
  it("codifica area con separadores estables aunque falten datos", () => {
    expect(buildAreaOptionValue("CONT-028", null, "DMH")).toBe("CONT-028::::DMH");
  });

  it("bloquea reemplazos fuera de turno y ausencias", () => {
    expect(isReplacementWorkerEligible(rosterSnapshot({ scheduleStatus: "working" }))).toBe(true);
    expect(isReplacementWorkerEligible(rosterSnapshot({ scheduleStatus: "extra_shift" }))).toBe(true);
    expect(isReplacementWorkerEligible(rosterSnapshot({ blockedByAbsence: true, scheduleStatus: "medical_leave" }))).toBe(false);
  });

  it("prioriza ausencia por sobre descanso en la apariencia de pauta", () => {
    const appearance = resolveRosterStatusAppearance(
      rosterSnapshot({
        blockedByAbsence: true,
        isRestDay: true,
        scheduleLabel: "Licencia medica"
      })
    );

    expect(appearance).toMatchObject({
      tone: "danger",
      title: "Licencia medica"
    });
  });

  it("explica origen del valor hora BUK o fallback sin exponer calculos ambiguos", () => {
    expect(
      buildHourlyRateBreakdownCopy({
        hourRateStrategy: "buk_overtime",
        rateSource: "rule_amount",
        rateRuleAmount: 12000,
        rateBaseSalary: null,
        rateWeeklyHours: null,
        rateOvertimeMultiplier: null
      })
    ).toContain("valor hora de respaldo");
  });
});
