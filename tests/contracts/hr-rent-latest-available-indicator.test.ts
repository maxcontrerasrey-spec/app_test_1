import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261007233537_use_latest_available_rent_indicator.sql",
  "utf8"
);
const page = readFileSync("src/modules/rent_structures/pages/RentStructuresPage.tsx", "utf8");
const api = readFileSync("src/modules/rent_structures/services/rentStructuresApi.ts", "utf8");

describe("indicador previsional mensual más reciente disponible", () => {
  it("resuelve el último período no posterior al mes estimado en el catálogo y en el cálculo", () => {
    expect(migration.match(/period_month <= month_start[\s\S]{0,100}order by indicator(?:_row)?\.period_month desc[\s\S]{0,40}limit 1/g)).toHaveLength(2);
    expect(migration).toContain("'requested_month', to_char(month_start, 'YYYY-MM')");
    expect(migration).toContain("'indicator_period', to_char(s.indicator_period, 'YYYY-MM')");
  });

  it("retiene el comportamiento sin indicador y conserva controles de acceso", () => {
    expect(migration).toContain("No existe un indicador legal disponible para el mes seleccionado ni para uno anterior.");
    expect(migration).toContain("not public.user_can_manage_hr_rent_structures(current_user_id)");
    expect(migration).toContain("revoke all on function public.get_hr_rent_structure_detail_variant_base");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("propaga el período aplicado y lo distingue del mes estimado en pantalla", () => {
    expect(api).toContain("indicatorPeriod: payload.structure.indicator_period ?? null");
    expect(api).toContain("requestedMonth: payload.structure.requested_month ?? null");
    expect(page).toContain("Parámetros previsionales aplicados:");
    expect(page).toContain("se utilizan los últimos datos mensuales completos disponibles");
  });
});
