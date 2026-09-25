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
const incomeTaxMigration = readFileSync(
  "supabase/migrations/20260925110000_add_optional_iusc_to_hr_rent_structures.sql",
  "utf8"
);
const incomeTaxAuditFix = readFileSync(
  "supabase/migrations/20260925113000_fix_optional_iusc_audit_timestamp.sql",
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

  it("mantiene el impuesto único desactivado por defecto y lo configura por cargo", () => {
    expect(incomeTaxMigration).toContain("include_income_tax boolean not null default false");
    expect(api).toContain("p_include_income_tax: legal.includeIncomeTax");
    expect(page).not.toContain('type="checkbox"');
    expect(page).toContain("Impuesto único");
    expect(page).toContain("No incluir");
    expect(page).toContain("Incluir cálculo SII");
    expect(incomeTaxAuditFix).toContain("latest_audit.changed_at desc");
    expect(incomeTaxAuditFix).not.toContain("latest_audit.created_at");
  });

  it("calcula el IUSC sobre la base imponible menos descuentos previsionales", () => {
    expect(incomeTaxMigration).toContain("structure_payload #>> '{totals,imponible}'");
    expect(incomeTaxMigration).toContain("- social_security_discounts");
    expect(incomeTaxMigration).toContain("taxable_base * bracket_factor - bracket_rebate_utm * utm_value");
    expect(incomeTaxMigration).toContain("'concept_name', 'Impuesto Único de Segunda Categoría'");
  });

  it("versiona la UTM y los ocho tramos SII sin reintroducir un mes en la UI", () => {
    expect(incomeTaxMigration).toContain("hr_rent_utm_values");
    expect(incomeTaxMigration).toContain("hr_rent_iusc_brackets");
    expect(incomeTaxMigration.match(/date '2026-01-01', [0-9.]+, (?:[0-9.]+|null), 0\./g)?.length).toBe(7);
    expect(incomeTaxMigration).toContain("date '2026-01-01', 0, 13.5, 0, 0");
    expect(page).not.toContain("Mes de control");
  });
});
