import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260914201913_prevent_ambiguous_hr_incentive_rate_rules.sql",
  "utf8"
);

describe("incentive rate rule overlap", () => {
  it("deactivates duplicate active rules deterministically", () => {
    expect(migration).toContain("with redundant_rules as");
    expect(migration).toContain("preferred.amount is not distinct from rr.amount");
    expect(migration).toContain("preferred.created_at");
    expect(migration).toContain("is_active = false");
  });

  it("blocks overlapping active rules at the same resolution rank", () => {
    expect(migration).toContain("before insert or update of");
    expect(migration).toContain("is not distinct from new.contract_code");
    expect(migration).toContain("existing.priority = new.priority");
    expect(migration).toContain("'-infinity'::date");
    expect(migration).toContain("'infinity'::date");
  });

  it("keeps the trigger helper outside the authenticated API", () => {
    expect(migration).toContain(
      "revoke all on function private.prevent_ambiguous_hr_incentive_rate_rule() from public, anon, authenticated"
    );
  });
});
