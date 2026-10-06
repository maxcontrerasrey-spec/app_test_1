import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261006140707_add_hr_rent_shift_regime_variants.sql",
  "utf8"
);
const page = readFileSync("src/modules/rent_structures/pages/RentStructuresPage.tsx", "utf8");
const api = readFileSync("src/modules/rent_structures/services/rentStructuresApi.ts", "utf8");

describe("jornadas y régimen en Estructuras de Renta", () => {
  it("usa el catálogo activo de Solicitudes y conserva sus IDs", () => {
    expect(migration).toContain("from public.shifts shift_row");
    expect(migration).toContain("where shift_row.is_active = true");
    expect(migration).toContain("shift_ids bigint[]");
  });

  it("guarda una o más jornadas y exige clasificar explícitamente el régimen", () => {
    expect(migration).toContain("Selecciona al menos una jornada aplicable");
    expect(migration).toContain("p_legal_regime_code is null");
    expect(migration).toContain("('art_25', 'ordinario')");
    expect(migration).toContain("delete from public.hr_rent_structure_shifts");
  });

  it("conserva estructuras previas pendientes y cierra acceso directo a la tabla", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.hr_rent_structure_shifts");
    const initialSchemaAndReadPath = migration.split("create function public.save_hr_rent_structure_config(")[0];
    expect(initialSchemaAndReadPath).not.toMatch(/update\s+public\.hr_rent_structures/i);
  });

  it("expone jornadas y regímenes en configuración y control", () => {
    expect(page).toContain("MultiSelectField");
    expect(page).toContain("Jornadas aplicables");
    expect(page).toContain("Régimen legal");
    expect(page).toContain("Jornadas pendientes de clasificar");
    expect(api).toContain("p_shift_ids: shiftIds");
    expect(api).toContain("p_legal_regime_code: legalRegimeCode");
  });
});
