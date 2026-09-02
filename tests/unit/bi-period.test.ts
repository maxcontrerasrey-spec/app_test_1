import { describe, expect, it } from "vitest";
import { buildBiPeriodCode, isBiPeriodRangeValid } from "../../src/shared/lib/biPeriod";

describe("BI period selection", () => {
  it("builds a single period from one calendar month", () => {
    expect(buildBiPeriodCode("2026-07", "")).toBe("202607");
    expect(buildBiPeriodCode("2026-07", "2026-07")).toBe("202607");
  });

  it("builds an inclusive period range", () => {
    expect(buildBiPeriodCode("2026-06", "2026-08")).toBe("202606-202608");
  });

  it("rejects an inverted range", () => {
    expect(isBiPeriodRangeValid("2026-08", "2026-06")).toBe(false);
  });
});
