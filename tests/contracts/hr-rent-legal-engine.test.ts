import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260924223000_add_dynamic_hr_rent_legal_engine.sql",
  "utf8"
);

describe("motor legal de estructuras de renta", () => {
  it("versiona las siete comisiones AFP y elimina la comisión referencial única", () => {
    for (const code of ["capital", "cuprum", "habitat", "modelo", "planvital", "provida", "uno"]) {
      expect(migration).toContain(`('${code}', 'AFP`);
    }
    expect(migration).toContain("unique (afp_code, effective_from)");
    expect(migration).toContain("mandatory_pension_rate + c.commission_rate");
  });

  it("aplica topes mensuales y falla de forma visible cuando falta el indicador", () => {
    expect(migration).toContain("hr_rent_monthly_indicators");
    expect(migration).toContain("least(t.imponible, s.pension_health_cap_uf * s.uf_month_end_clp)");
    expect(migration).toContain("least(t.imponible, s.unemployment_cap_uf * s.uf_month_end_clp)");
    expect(migration).toContain("No existe un indicador legal cargado para el mes seleccionado.");
  });

  it("separa el siete por ciento de salud del adicional de Isapre", () => {
    expect(migration).toContain("'legal_health', 'Cotiz. Salud Obligatoria'");
    expect(migration).toContain("'legal_health_additional', 'Adicional plan de salud'");
    expect(migration).toContain("greatest(a.health_total_amount - a.health_legal_amount, 0)");
    expect(migration).toContain("round(c.health_plan_value * c.uf_month_end_clp, 0)");
  });

  it("descuenta AFC al trabajador solo en contrato indefinido", () => {
    expect(migration).toContain("c.unemployment_contract_type = 'indefinite'");
    expect(migration).toContain("else 0 end");
    expect(migration).toContain("Plazo fijo/obra · aporte trabajador 0%");
  });

  it("mantiene tablas privadas y escritura auditada para perfiles gerenciales", () => {
    expect(migration).toContain("hr_rent_afp_rates_no_direct_access");
    expect(migration).toContain("hr_rent_monthly_indicators_no_direct_access");
    expect(migration).toContain("not public.user_can_manage_hr_rent_structures(current_user_id)");
    expect(migration).toContain("insert into public.hr_rent_structure_audit");
  });
});
