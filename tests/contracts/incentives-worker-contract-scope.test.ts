import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260915163137_allow_cross_contract_hr_incentives.sql",
  "utf8"
);
const registrationForm = readFileSync(
  "src/modules/incentives/components/IncentiveRegistrationForm.tsx",
  "utf8"
);

describe("incentives cross-contract service scope", () => {
  it("accepts every active contract with an operational BUK mapping", () => {
    expect(migration).toContain(
      "create or replace function private.hr_incentive_contract_is_buk_operational"
    );
    expect(migration).toContain("from public.buk_contract_mappings bcm");
    expect(migration).toContain("bcm.is_operational = true");
    expect(migration).toContain("bcm.is_one_to_one = true");
    expect(migration).toContain("c.is_active = true");
  });

  it("returns the global BUK contract catalog and keeps worker membership as primary", () => {
    expect(migration).toContain("select distinct on (c.code)");
    expect(migration).toContain("option_row.contract_code = primary_contract_code");
    expect(migration).toContain("jsonb_set(context_payload, '{available_areas}'");
  });

  it("changes the existing assertion to validate the BUK catalog instead of worker membership", () => {
    expect(migration).toContain("private.hr_incentive_contract_is_buk_operational(p_contract_code)");
    expect(migration).toContain(
      "El contrato seleccionado no está activo y homologado con BUK"
    );
  });

  it("keeps unscoped implementations private", () => {
    expect(migration).toContain(
      "revoke all on function private.hr_incentive_contract_is_buk_operational(text)"
    );
    expect(migration).toContain(
      "revoke all on function public.hr_incentive_worker_context_impl(text)"
    );
  });

  it("uses a searchable selector and explains a missing global BUK catalog", () => {
    expect(registrationForm).toContain("<SearchableSelectField");
    expect(registrationForm).toContain("Sin contratos BUK homologados");
    expect(registrationForm).toContain(
      "Corrige el catálogo contractual\n                antes de registrar el incentivo."
    );
  });
});
