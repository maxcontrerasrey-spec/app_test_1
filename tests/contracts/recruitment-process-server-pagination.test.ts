import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261006190322_fix_recruitment_process_server_pagination.sql",
  "utf8"
);
const triggerMigration = readFileSync(
  "supabase/migrations/20261006190317_harden_atlas_trigger_function_execute.sql",
  "utf8"
);
const view = readFileSync(
  "src/modules/recruitment/components/HiringProcessesView.tsx",
  "utf8"
);
const service = readFileSync(
  "src/modules/recruitment/services/hiringControl.ts",
  "utf8"
);

describe("external scalability and security audit remediations", () => {
  it("uses authorized server-side filtering, count, and 50-row pagination for folios", () => {
    expect(migration).toContain("get_recruitment_processes_page_v2(");
    expect(migration).toContain("user_can_view_hiring_request_process_summary(");
    expect(migration).toContain("or normalized_filter = 'all'");
    expect(migration).toContain("cardinality(shift_filter) = 0");
    expect(migration).toContain("cardinality(contract_filter) = 0");
    expect(migration).toContain("cardinality(pasajes_filter) = 0");
    expect(migration).toContain("cardinality(campamento_filter) = 0");
    expect(migration).toContain("'filter_options'");
    expect(migration).toContain("'status_counts'");
    expect(migration).toContain("offset safe_offset");
    expect(migration).toContain("set search_path = pg_catalog, public, pg_temp");
    expect(migration).toMatch(
      /revoke all on function public\.get_recruitment_processes_page_v2\([\s\S]*from public, anon/i
    );
    expect(migration).toContain("to authenticated;");
    expect(view).toContain("limit: PROCESS_PAGE_SIZE");
    expect(view).toContain("offset: casePage * PROCESS_PAGE_SIZE");
    expect(view).not.toContain("filteredActiveCases.slice");
  });

  it("collapses status discovery to one cancellable RPC request", () => {
    const resolverStart = service.indexOf("export async function resolveRecruitmentProcessSearchFilter(");
    const resolverEnd = service.indexOf("\n}\n", resolverStart);
    const resolver = service.slice(resolverStart, resolverEnd);

    expect(resolver).toContain('statusFilter: "all"');
    expect(resolver).toContain("statusCounts");
    expect(resolver).not.toContain("Promise.all");
    expect(service).toContain("request.abortSignal(input.signal)");
  });

  it("removes unnecessary client execution privileges from trigger-only functions", () => {
    expect(triggerMigration).toContain(
      "alter function public.atlas_ops_apply_geofences()\n  set search_path = pg_catalog, public, pg_temp"
    );
    expect(triggerMigration).toContain("alter function public.extract_buk_employee_exit_date(jsonb)");
    expect(triggerMigration).toContain("set search_path = pg_catalog, public, pg_temp");
    expect(triggerMigration).toContain("notify pgrst, 'reload schema'");
    expect(triggerMigration).toMatch(
      /revoke all on function public\.atlas_ops_apply_geofences\(\)[\s\S]*from public, anon, authenticated, service_role/i
    );
    expect(triggerMigration).toMatch(
      /revoke all on function public\.validate_hr_worker_roster_fixed_cycle_start\(\)[\s\S]*from public, anon, authenticated, service_role/i
    );
  });
});
