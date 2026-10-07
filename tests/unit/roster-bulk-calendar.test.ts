import { describe, expect, it } from "vitest";
import {
  filterRosterWorkersByCycle,
  resolvePatternCycle,
  resolveRosterExportContractLabel
} from "../../src/modules/roster/components/RosterBulkCalendar";
import type { WorkerScheduleDay } from "../../src/modules/roster/types";

describe("roster bulk calendar cycle filters", () => {
  it("reduces pattern variants to their base cycle", () => {
    expect(resolvePatternCycle("DAND · 4X4 · A/D/B")).toBe("4X4");
    expect(resolvePatternCycle("DAND · 4X4 · C/D/A")).toBe("4X4");
    expect(resolvePatternCycle("DAND · 6X3 · A/B")).toBe("6X3");
    expect(resolvePatternCycle("10X5+5")).toBe("10X5+5");
  });

  it("keeps an unknown label instead of losing a filter option", () => {
    expect(resolvePatternCycle("Jornada especial")).toBe("Jornada especial");
    expect(resolvePatternCycle(null)).toBe("");
  });

  it("filters the roster by its base cycle and by workers without a cycle", () => {
    const createDay = (patternName: string | null): WorkerScheduleDay => ({
      date: "2026-10-01",
      assignmentId: patternName ? "assignment" : null,
      patternId: patternName ? "pattern" : null,
      patternName,
      cycleDay: null,
      baseStatus: patternName ? "working" : "unassigned",
      effectiveStatus: patternName ? "working" : "unassigned",
      exceptionType: null,
      exceptionLabel: null,
      exceptionSource: null,
      exceptionNotes: null,
      isWorkingDay: Boolean(patternName),
      isRestDay: false
    });
    const workers = [
      { id: "one", days: [createDay("DAND · 4X4 · A/D/B")] },
      { id: "two", days: [createDay("DAND · 6X3 · A/B")] },
      { id: "three", days: [createDay(null)] }
    ];

    expect(filterRosterWorkersByCycle(workers, "4X4").map((worker) => worker.id)).toEqual(["one"]);
    expect(filterRosterWorkersByCycle(workers, "__no_pattern__").map((worker) => worker.id)).toEqual(["three"]);
    expect(filterRosterWorkersByCycle(workers, "")).toBe(workers);
  });

  it("exports the real operational area before the numeric contract code", () => {
    expect(resolveRosterExportContractLabel({
      areaName: "CODELCO - DRT",
      contractCode: "7605030115:0002"
    })).toBe("CODELCO - DRT");
    expect(resolveRosterExportContractLabel({
      areaName: null,
      contractCode: "7605030115:0002"
    })).toBe("7605030115:0002");
    expect(resolveRosterExportContractLabel({
      areaName: "  ",
      contractCode: null
    })).toBe("—");
  });
});
