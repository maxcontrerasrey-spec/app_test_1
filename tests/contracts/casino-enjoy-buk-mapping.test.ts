import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260924092000_set_casino_enjoy_buk_operational_area_code.sql"),
  "utf8"
);

describe("CASINO ENJOY BUK mapping", () => {
  it("completa la ruta BUK entregada por Operaciones", () => {
    expect(migration).toContain("9959890001:0001");
    expect(migration).toContain("buk_area_code = '728'");
    expect(migration).toContain("buk_area_name = 'CASINO ENJOY'");
    expect(migration).toContain("is_operational = true");
    expect(migration).toContain("is_one_to_one = true");
  });

  it("falla cerrado si falta el contrato o el mapping operativo", () => {
    expect(migration).toContain("No existe el contrato activo CASINO ENJOY");
    expect(migration).toContain("No existe el mapping BUK de CASINO ENJOY");
    expect(migration).toContain("no está marcado como operativo");
    expect(migration).toContain("área operacional 728");
  });
});
