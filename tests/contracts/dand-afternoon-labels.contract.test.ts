import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260922130000_correct_dand_afternoon_labels.sql",
  "utf8"
);

describe("DAND afternoon label contract", () => {
  it("updates only the authoritative afternoon pattern metadata", () => {
    expect(migration).toContain("where code in ('dand_4x3_c', 'dand_4x4_c', 'dand_6x1_c', 'dand_7x7_c')");
    expect(migration).toContain("workday_labels = array(");
    expect(migration).toContain("when label = 'B' then 'C'");
    expect(migration).not.toMatch(/delete\s+from\s+public\.hr_worker_rosters/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.hr_worker_rosters/i);
  });
});
