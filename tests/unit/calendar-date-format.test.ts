import { describe, expect, it } from "vitest";

import { formatDashboardDate } from "../../src/modules/dashboard/lib/formatters";
import { formatRequestDate } from "../../src/shared/lib/format";

describe("calendar date formatting", () => {
  it("preserves date-only values without applying an UTC timezone shift", () => {
    expect(formatRequestDate("2026-08-03")).toBe("03-08-2026");
    expect(formatDashboardDate("2026-08-03")).toBe("03-08-2026");
  });

  it("rejects invalid calendar dates", () => {
    expect(formatRequestDate("2026-02-31")).toBe("");
    expect(formatDashboardDate("2026-02-31")).toBe("—");
  });
});
