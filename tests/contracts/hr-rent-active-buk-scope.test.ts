import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260925130000_scope_hr_rent_positions_to_active_buk_sync.sql",
  "utf8"
);
const edgeFunction = readFileSync(
  "supabase/functions/sync-buk-job-positions/index.ts",
  "utf8"
);
const workflow = readFileSync(".github/workflows/sync-buk.yml", "utf8");
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");

describe("alcance activo BUK de estructuras de renta", () => {
  it("intersecta el catalogo historico con cargos activos sincronizados", () => {
    expect(migration).toContain("public.hr_rent_contract_positions relation_row");
    expect(migration).toContain("public.buk_job_position_contract_access access_row");
    expect(migration).toContain("access_row.is_active = true");
    expect(migration).toContain("position_row.is_active = true");
    expect(migration).toContain("payload := jsonb_set(payload, '{positions}', active_positions, true)");
  });

  it("no expone el detalle ni permite guardar un cargo que dejo de estar activo", () => {
    expect(migration).toContain("payload := jsonb_set(payload, '{structure}', '{}'::jsonb, true)");
    expect(migration).toContain("El cargo ya no esta activo en BUK para el contrato seleccionado");
    expect(migration).toContain("save_hr_rent_structure_config_before_buk_active_scope");
  });

  it("conserva la configuracion historica sin borrar relaciones ni estructuras", () => {
    expect(migration).not.toMatch(/delete\s+from\s+public\.hr_rent_/i);
    expect(migration).not.toMatch(/update\s+public\.hr_rent_contract_positions/i);
    expect(migration).not.toMatch(/update\s+public\.hr_rent_structures/i);
  });

  it("incluye el catalogo de cargos en la sincronizacion diaria BUK", () => {
    expect(workflow).toContain("Sync active BUK roles by contract");
    expect(workflow).toContain("/functions/v1/sync-buk-job-positions");
    expect(workflow).toContain("Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeFunction).toContain("secretsMatch(accessToken, serviceRoleKey)");
    expect(supabaseConfig).toMatch(/\[functions\.sync-buk-job-positions\]\nverify_jwt = false/);
  });
});
