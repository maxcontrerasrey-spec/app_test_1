import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260924231500_fix_hr_rent_permanent_calculator.sql",
  "utf8"
);
const page = readFileSync(
  "src/modules/rent_structures/pages/RentStructuresPage.tsx",
  "utf8"
);
const api = readFileSync(
  "src/modules/rent_structures/services/rentStructuresApi.ts",
  "utf8"
);
const decouplingMigration = readFileSync(
  "supabase/migrations/20260924234000_decouple_hr_rent_positions_from_buk.sql",
  "utf8"
);

describe("calculador permanente de estructuras de renta", () => {
  it("elimina el periodo del contrato frontend y conserva compatibilidad sin usarlo", () => {
    expect(page).not.toContain("Mes de control");
    expect(page).not.toContain('type="month"');
    expect(api).not.toContain("p_month");
    expect(migration).toContain("El argumento de fecha se ignora");
    expect(migration).toContain("select public.get_hr_rent_structure_control(p_contract_id, p_job_position_id)");
  });

  it("no recorre jornadas ni trabajadores por cada día", () => {
    expect(migration).not.toContain("generate_series");
    expect(migration).not.toContain("resolve_hr_roster_day_status");
    expect(migration).toContain("count(distinct employee.buk_employee_id)");
  });

  it("desacopla el catálogo de cargos y la configuración de las fichas BUK", () => {
    expect(decouplingMigration).toContain("hr_rent_contract_positions");
    expect(decouplingMigration).not.toContain("employees_active_current");
    expect(decouplingMigration).not.toContain("raw_payload");
    expect(page).not.toContain("Contrato BUK");
    expect(page).not.toContain("personas activas BUK");
  });

  it("calcula descuentos únicamente desde los haberes imponibles configurados", () => {
    expect(migration).toContain("sum(amount) filter (where section_code = 'imponible')");
    expect(migration).toContain("pension_health_base * (calculated.mandatory_pension_rate + calculated.commission_rate)");
    expect(migration).toContain("pension_health_base * calculated.health_rate");
    expect(migration).toContain("unemployment_base * case");
  });

  it("expone una composición visual equivalente a una liquidación estructural", () => {
    expect(page).toContain("Haberes imponibles");
    expect(page).toContain("Haberes no imponibles");
    expect(page).toContain("Descuentos legales");
    expect(page).toContain("Líquido estimado por cargo");
    expect(page).toContain("No corresponde a la liquidación de una persona");
  });
});
