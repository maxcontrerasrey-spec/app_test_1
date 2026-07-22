import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260722183930_core_data_integrity_hardening.sql"),
  "utf8"
);
const rosterApi = fs.readFileSync(
  path.join(root, "src/modules/roster/services/rosterApi.ts"),
  "utf8"
);

describe("CORE concurrency guards", () => {
  it("serializes roster range mutations per BUK worker", () => {
    expect(migration).toContain("create or replace function public.assign_hr_worker_roster_v2");
    expect(migration).toContain("pg_advisory_xact_lock(");
    expect(migration).toContain("'hr-worker-roster:' || trim(p_buk_employee_id)");
    expect(rosterApi).toContain('rpc("assign_hr_worker_roster_v2"');
  });

  it("removes authenticated execution of the unguarded roster entry point", () => {
    expect(migration).toMatch(
      /revoke all on function public\.assign_hr_worker_roster\([\s\S]*?from public, anon, authenticated;/
    );
  });

  it("recovers stale BUK and document-cleanup workers under SKIP LOCKED", () => {
    for (const file of [
      "supabase/migrations/20260722184523_recover_stale_buk_sync_processing_jobs.sql",
      "supabase/migrations/20260722184756_recover_stale_candidate_document_cleanup_jobs.sql"
    ]) {
      const sql = fs.readFileSync(path.join(root, file), "utf8");
      expect(sql).toContain("stale_cutoff");
      expect(sql).toContain("for update skip locked");
      expect(sql).toContain("staleProcessingRecovery");
    }
  });
});
