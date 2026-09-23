import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260922120000_restore_hr_roster_operational_areas.sql",
  "utf8"
);
const administratorMigration = readFileSync(
  "supabase/migrations/20260922200000_add_roster_contract_admin_filter.sql",
  "utf8"
);
const rosterApi = readFileSync("src/modules/roster/services/rosterApi.ts", "utf8");
const rosterPage = readFileSync("src/modules/roster/pages/RosterPage.tsx", "utf8");

describe("HR roster setup catalog contract", () => {
  it("keeps operational scopes in the backend catalog together with DAND labels", () => {
    expect(migration).toContain("'operational_areas'");
    expect(migration).toContain("from public.employees_active_current e");
    expect(migration).toContain("'workday_labels', hp.workday_labels");
    expect(migration).toContain(
      "grant execute on function public.get_hr_roster_setup_catalogs() to authenticated"
    );
  });

  it("keeps the frontend contract connected to the operational scope catalog", () => {
    expect(rosterApi).toContain("operationalAreas: asArray");
    expect(rosterApi).toContain("contractAdministrators: asArray");
    expect(rosterPage).toContain("setupCatalogsQuery.data?.operationalAreas ?? []");
    expect(rosterPage).toContain("setupCatalogsQuery.data?.contractAdministrators ?? []");
    expect(rosterPage).toContain('placeholder="Todos los contratos / áreas"');
    expect(rosterPage).toContain('label="Administrador del contrato"');
  });

  it("filters the calendar by the authoritative operational administrator mapping", () => {
    expect(administratorMigration).toContain("'contract_administrators'");
    expect(administratorMigration).toContain("bcm.is_one_to_one = true");
    expect(administratorMigration).toContain("bcm.buk_area_name_normalized");
    expect(administratorMigration).toContain("p_contract_admin_filter text");
    expect(administratorMigration).toContain(
      "grant execute on function public.get_hr_roster_bulk_calendar(date, date, text, text, text, text) to authenticated"
    );
    expect(rosterPage).toContain("contractAdministratorFilter");
    expect(rosterPage).toContain("Selecciona un contrato, área o administrador");
  });
});
