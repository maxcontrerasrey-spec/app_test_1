import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260922153000_restore_aramark_dch_hiring_catalog.sql",
  "utf8"
);

describe("ARAMARK DCH hiring catalog correction", () => {
  it("keeps ARAMARK DCH operational and separates SCHWAGER DCH", () => {
    expect(migration).toContain("normalize_buk_area_name('ARAMARK - DCH')");
    expect(migration).toContain("normalize_buk_area_name('SCHWAGER DCH')");
    expect(migration).toContain("contract_id = null");
    expect(migration).toContain("is_operational = false");
    expect(migration).toContain("recompute_buk_contract_mapping_one_to_one(100)");
    expect(migration).toContain("ARAMARK - DCH no quedó operativo y uno-a-uno");
  });
});
