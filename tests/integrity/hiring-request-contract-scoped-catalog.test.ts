import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260925140000_scope_hiring_request_catalog_by_contract.sql",
  "utf8",
);
const catalogService = readFileSync(
  "src/modules/recruitment/services/hiringCatalogs.ts",
  "utf8",
);
const hiringRequestPage = readFileSync(
  "src/modules/recruitment/pages/HiringRequestPage.tsx",
  "utf8",
);

describe("contract-scoped hiring request catalog", () => {
  it("exposes only active BUK associations from the catalog RPC", () => {
    expect(migration).toContain("create or replace function public.get_hiring_request_catalogs()");
    expect(migration).toContain("access_row.is_active = true");
    expect(migration).toContain("mapping.is_operational = true");
    expect(migration).toContain("mapping.is_one_to_one = true");
    expect(migration).toContain("position_record.is_active = true");
    expect(migration).toContain("contract_record.is_active = true");
    expect(migration).toContain("grant execute on function public.get_hiring_request_catalogs() to authenticated;");
  });

  it("does not download the global job-position table into the client", () => {
    expect(catalogService).toContain('supabase.rpc("get_hiring_request_catalogs")');
    expect(catalogService).not.toContain('.from("job_positions")');
    expect(hiringRequestPage).toContain('label="Contrato de destino"');
    expect(hiringRequestPage).toContain("!selectedContract");
    expect(hiringRequestPage).toContain("availableHiringRoles");
  });
});
