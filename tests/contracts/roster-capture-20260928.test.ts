import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260928160000_import_rosters_from_capture_20260928.sql",
  "utf8"
);

describe("carga de Jornadas desde captura 2026-09-28", () => {
  it("declara las 28 filas y sus ciclos esperados", () => {
    const sourceRows = migration.match(/^\s+\(\d+, '\d[\d.kK-]*'/gm) ?? [];
    expect(sourceRows).toHaveLength(28);

    for (const cycle of ["5X2", "4X3", "14X14", "10X10", "7X7", "10X5+5", "8X6"]) {
      expect(migration).toContain(`'${cycle}'`);
    }
  });

  it("excluye de forma explícita las dos filas sin identidad contractual BUK compatible", () => {
    expect(migration).toContain("(14, 'Sin ficha BUK activa al 2026-09-28.')");
    expect(migration).toContain("(15, 'La ficha BUK activa pertenece a ARAMARK MINISTRO HALES INTERNO");
    expect(migration).toContain("exclusion.row_number is null");
  });

  it("concilia por RUT, ficha activa, area exacta y cargo", () => {
    expect(migration).toContain("employee.is_active = true");
    expect(migration).toContain("trim(employee.area_name) = trim(source.expected_area)");
    expect(migration).toContain("resolved.job_title");
    expect(migration).toContain("expected_administrator text not null");
    expect(migration).not.toContain("mapping.contract_admin_name");
  });

  it("es idempotente y rechaza pautas incompatibles o futuras", () => {
    expect(migration).toContain("existing.start_date = resolved.start_date");
    expect(migration).toContain("existing.pattern_id <> resolved.pattern_id");
    expect(migration).toContain("existing.start_date > resolved.start_date");
    expect(migration).toContain("where not exists (");
  });

  it("cierra solo la pauta anterior y verifica las 26 asignaciones conciliadas", () => {
    expect(migration).toContain("set end_date = resolved.start_date - 1");
    expect(migration).toContain("existing.start_date < resolved.start_date");
    expect(migration).toContain("if verified_count <> 26 then");
    expect(migration).toContain("roster.invalidated_at is null");
    expect(migration).toContain("roster.end_date is null");
  });
});
