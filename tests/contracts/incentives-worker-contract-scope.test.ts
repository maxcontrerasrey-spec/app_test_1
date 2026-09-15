import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260914201449_enforce_hr_incentive_worker_contract_scope.sql",
  "utf8"
);
const registrationForm = readFileSync(
  "src/modules/incentives/components/IncentiveRegistrationForm.tsx",
  "utf8"
);

describe("incentives worker contract scope", () => {
  it("resolves contract membership from the worker identity and BUK mappings", () => {
    expect(migration).toContain(
      "create or replace function private.hr_incentive_worker_has_contract"
    );
    expect(migration).toContain("join public.buk_contract_mappings bcm");
    expect(migration).toContain("bcm.is_operational = true");
    expect(migration).toContain("bcm.is_one_to_one = true");
    expect(migration).toContain("c.is_active = true");
  });

  it("filters context options instead of exposing every active contract", () => {
    expect(migration).toContain("jsonb_array_elements");
    expect(migration).toContain("private.hr_incentive_worker_has_contract(");
    expect(migration).toContain("jsonb_set(context_payload, '{available_areas}'");
  });

  it("blocks unassociated contracts in preview, type resolution and creation", () => {
    expect(migration.match(/perform private\.assert_hr_incentive_worker_contract/g)).toHaveLength(3);
    expect(migration).toContain(
      "El trabajador no tiene una asociación BUK con el contrato seleccionado"
    );
  });

  it("keeps unscoped implementations private", () => {
    expect(migration).toContain(
      "revoke all on function public.hr_incentive_worker_context_unscoped_impl(text) from public, anon, authenticated"
    );
    expect(migration).toContain(
      "revoke all on function public.hr_incentive_create_request_unscoped_contract_impl"
    );
  });

  it("explains a missing BUK contract mapping in the registration form", () => {
    expect(registrationForm).toContain("Sin contrato BUK homologado");
    expect(registrationForm).toContain(
      "Corrige el mapeo\n                contractual antes de registrar el incentivo."
    );
  });
});
