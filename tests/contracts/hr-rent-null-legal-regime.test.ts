import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261006165857_fix_hr_rent_null_legal_regime_payload.sql",
  "utf8"
);

describe("Estructuras de Renta con régimen legal aún sin clasificar", () => {
  it("mantiene el RPC como JSON válido cuando legal_regime_code es SQL NULL", () => {
    expect(migration).toContain("coalesce(to_jsonb(regime_code), 'null'::jsonb)");
    expect(migration).toContain("payload := jsonb_set(payload, '{structure,legal_regime_code}'");
    expect(migration).toContain("return jsonb_set(payload, '{shift_catalog}', shift_catalog, true)");
    expect(migration).toContain("grant execute on function public.get_hr_rent_structure_control(bigint, bigint) to authenticated");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("conserva el tratamiento pendiente de clasificación para estructuras históricas", () => {
    expect(migration).toContain("jsonb_array_length(selected_shift_ids) = 0 or regime_code is null");
    expect(migration).not.toMatch(/update\s+public\.hr_rent_structures/i);
  });
});
