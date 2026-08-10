import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260807230621_add_hr_sanctions_module.sql"),
  "utf8"
);
const storagePolicyFix = fs.readFileSync(
  path.join(root, "supabase/migrations/20260810131746_fix_hr_sanctions_storage_policy_table_access.sql"),
  "utf8"
);
const navigation = fs.readFileSync(
  path.join(root, "src/shared/config/navigation.ts"),
  "utf8"
);
const incentivesDashboard = fs.readFileSync(
  path.join(root, "src/modules/incentives/pages/HumanResourcesDashboard.tsx"),
  "utf8"
);

describe("HR sanctions integrity", () => {
  it("registers the module and keeps disciplinary tables behind RPCs", () => {
    expect(migration).toContain("'solicitud_sanciones'");
    expect(migration).toContain("create table if not exists public.hr_sanction_requests");
    expect(migration).toContain("alter table public.hr_sanction_requests enable row level security");
    expect(migration).toContain(
      "revoke all on table public.hr_sanction_requests from anon, authenticated"
    );
    expect(migration).toContain("on public.hr_sanction_requests for all");
    expect(migration).toContain("using (false)");
    expect(migration).toContain("with check (false)");
  });

  it("keeps Storage private and scoped to sanctioned request evidence paths", () => {
    expect(migration).toContain("'hr-sanctions'");
    expect(migration).toContain("false,\n  52428800");
    expect(migration).toContain("name like ('evidence/' || (select auth.uid())::text || '/%')");
    expect(migration).toContain("public.user_can_access_hr_sanctions((select auth.uid()))");
    expect(migration).toContain("hsd.file_path = storage.objects.name");
    expect(migration).toContain("hsr.requester_user_id = (select auth.uid())");
  });

  it("uses explicit actor checks before privileged RPC work", () => {
    expect(migration).toContain("current_user_id uuid := auth.uid()");
    expect(migration).toContain("public.user_can_access_hr_sanctions(current_user_id)");
    expect(migration).toContain("public.user_can_manage_hr_sanctions(current_user_id)");
    expect(migration).toContain("constraint hr_sanction_requests_idempotency_unique");
    expect(migration).not.toContain("auth.role()");
  });

  it("keeps the Storage policy from querying restricted sanction tables as the caller", () => {
    expect(storagePolicyFix).toContain(
      "create or replace function public.user_can_view_hr_sanction_document_object(p_object_name text)"
    );
    expect(storagePolicyFix).toContain("security definer");
    expect(storagePolicyFix).toContain("from public.hr_sanction_documents hsd");
    expect(storagePolicyFix).toContain(
      "public.user_can_view_hr_sanction_document_object(name)"
    );
    expect(storagePolicyFix).toContain(
      "revoke all on function public.user_can_view_hr_sanction_document_object(text)"
    );
  });

  it("exposes sanctions as an independent HR module instead of an incentives tab", () => {
    expect(navigation).toContain('moduleCode: "solicitud_sanciones"');
    expect(navigation).toContain('to: "/recursos-humanos/sanciones"');
    expect(incentivesDashboard).not.toContain('key: "sanciones"');
    expect(incentivesDashboard).not.toContain("SanctionsModuleView");
  });
});
