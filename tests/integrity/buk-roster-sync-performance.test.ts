import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync("scripts/sync-buk-roster-absences.mjs", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260824165117_optimize_buk_roster_exception_batch.sql",
  "utf8"
);

describe("BUK roster absence synchronization performance", () => {
  it("uses one set-based RPC per batch instead of one RPC per worker-day", () => {
    expect(script).toContain('const SUPABASE_RPC_BATCH_SIZE = 1000;');
    expect(script).toContain('supabase.rpc("sync_hr_roster_exceptions_from_buk_batch"');
    expect(script).not.toContain('supabase.rpc("sync_hr_roster_exception_from_buk"');
  });

  it("keeps the batch endpoint restricted and preserves superseded manual exceptions", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("existing.superseded_exception_type");
    expect(migration).toContain("on conflict (employee_buk_employee_id, exception_date) do update");
  });
});
