import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260914200625_harden_hr_incentive_feature_authorization.sql",
  "utf8"
);

describe("incentives feature authorization boundary", () => {
  it("separates register, approval, history and configuration RPCs", () => {
    expect(migration).toContain(
      "private.assert_hr_incentive_feature_access(array['hr_incentives_register'])"
    );
    expect(migration).toContain(
      "private.assert_hr_incentive_feature_access(array['hr_incentives_approvals'])"
    );
    expect(migration).toContain(
      "private.assert_hr_incentive_feature_access(array['hr_incentives_history'])"
    );
    expect(migration).toContain(
      "private.assert_hr_incentive_feature_access(array['hr_incentives_configuration'])"
    );
  });

  it("keeps shared read RPCs limited to their legitimate consumers", () => {
    expect(migration).toContain("create function public.get_hr_incentive_setup_catalogs()");
    expect(migration).toContain("'hr_incentives_register',\n    'hr_incentives_history',\n    'hr_incentives_configuration'");
    expect(migration).toContain("create function public.get_hr_incentive_request_detail(p_request_id uuid)");
    expect(migration).toContain("'hr_incentives_history',\n    'hr_incentives_approvals'");
  });

  it("removes authenticated execution from privileged implementations and helpers", () => {
    expect(migration).toContain(
      "revoke all on function public.hr_incentive_create_request_impl"
    );
    expect(migration).toContain(
      "revoke all on function public.hr_incentive_decide_approval_impl"
    );
    expect(migration).toContain(
      "revoke all on function public.resolve_hr_incentive_contract_approvers(text) from public, anon, authenticated"
    );
    expect(migration).toContain(
      "revoke all on function public.sync_hr_incentive_request_current_approver(uuid) from public, anon, authenticated"
    );
  });

  it("binds access to the authenticated actor or trusted service role", () => {
    expect(migration).toContain("actor_id uuid := auth.uid()");
    expect(migration).toContain("if actor_id is null then");
    expect(migration).toContain("if jwt_role = 'service_role' then");
    expect(migration).toContain("public.user_can_access_feature(actor_id, feature_code.value)");
  });
});
