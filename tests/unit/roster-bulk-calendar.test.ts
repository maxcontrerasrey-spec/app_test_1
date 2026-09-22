import { describe, expect, it } from "vitest";
import { resolvePatternCycle } from "../../src/modules/roster/components/RosterBulkCalendar";

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
});
