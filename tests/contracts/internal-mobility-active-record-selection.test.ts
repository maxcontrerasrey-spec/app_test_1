import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260924173000_allow_internal_mobility_active_record_selection.sql",
  "utf8"
);
const service = readFileSync(
  "src/modules/internal_mobility/services/internalMobilityApi.ts",
  "utf8"
);
const lookup = readFileSync(
  "src/modules/internal_mobility/components/InternalMobilityWorkerLookup.tsx",
  "utf8"
);
const page = readFileSync(
  "src/modules/internal_mobility/pages/InternalMobilityPage.tsx",
  "utf8"
);

describe("internal mobility active BUK record selection", () => {
  it("returns every active record and exposes the identity multiplicity", () => {
    expect(migration).toContain(
      "drop function if exists public.search_internal_mobility_workers(text, integer)"
    );
    expect(migration).toContain("active_record_count integer");
    expect(migration).toContain("count(*) over (");
    expect(migration).toContain("from public.employees e\n    where e.is_active = true");
    expect(migration).not.toContain("identity_rank = 1");
    expect(migration).not.toContain(
      "create or replace view public.employees_active_current"
    );
  });

  it("loads and submits the exact selected active BUK record", () => {
    expect(migration.match(/from public\.employees e/g)).toHaveLength(3);
    expect(migration).toContain(
      "where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))\n    and e.is_active = true"
    );
    expect(migration).toContain(
      "where e.buk_employee_id = normalized_buk_employee_id\n    and e.is_active = true"
    );
    expect(migration).toContain(
      "where imr.employee_buk_employee_id = worker_record.buk_employee_id"
    );
    expect(migration).toContain(
      "pg_advisory_xact_lock(hashtextextended(worker_record.buk_employee_id, 0))"
    );
  });

  it("makes the exceptional choice explicit without changing the normal flow", () => {
    expect(service).toContain("activeRecordCount: Math.max(1");
    expect(lookup).toContain("getAreaName={buildInternalMobilityWorkerRecordLabel}");
    expect(page).toContain("selectedWorker.activeRecordCount > 1");
    expect(page).toContain("afectará únicamente la ficha");
  });

  it("preserves authenticated-only execution for every changed RPC", () => {
    expect(migration).toContain(
      "grant execute on function public.search_internal_mobility_workers(text, integer) to authenticated"
    );
    expect(migration).toContain(
      "grant execute on function public.get_internal_mobility_worker_context(text) to authenticated"
    );
    expect(migration).toContain(
      "grant execute on function public.submit_internal_mobility_request(text, uuid, text, boolean) to authenticated"
    );
  });
});
