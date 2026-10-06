import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261006224546_rent_structure_by_contract_position_and_shift.sql",
  "utf8"
);
const page = readFileSync("src/modules/rent_structures/pages/RentStructuresPage.tsx", "utf8");
const api = readFileSync("src/modules/rent_structures/services/rentStructuresApi.ts", "utf8");

describe("jornadas y régimen en Estructuras de Renta", () => {
  it("identifica cada estructura por contrato, cargo y una sola jornada", () => {
    expect(migration).toContain("shift_id bigint references public.shifts(id)");
    expect(migration).toContain("drop constraint if exists hr_rent_structures_contract_id_job_position_id_key");
    expect(migration).toContain("(contract_id, job_position_id, shift_id)");
    expect(migration).toContain("p_shift_id bigint");
    expect(migration).toContain("get_hr_rent_structure_variant_control");
    expect(migration).toContain("save_hr_rent_structure_variant");
  });

  it("conserva perfiles previos y solo asigna una jornada cuando el enlace es inequívoco", () => {
    expect(migration).toContain("having count(*) = 1");
    expect(migration).toContain("shift_id is null");
    expect(migration).toContain("shift_classification_pending");
  });

  it("persiste las jornadas aplicables por contrato y cargo antes de admitir renta", () => {
    expect(migration).toContain("create table public.hr_rent_position_shifts");
    expect(migration).toContain("save_hr_rent_position_shifts");
    expect(migration).toContain("'{applicable_shift_ids}'");
    expect(migration).toContain("Esta jornada no está habilitada para el cargo");
    expect(migration).toContain("No puedes quitar una jornada que ya tiene una estructura vigente");
    expect(page).toContain("Jornadas aplicables");
    expect(page).toContain("Guardar jornadas");
    expect(page).toContain("savedApplicableShiftIds.filter");
  });

  it("guarda cada variante por separado y exige jornada y régimen válidos", () => {
    expect(migration).toContain("Selecciona una jornada activa para esta estructura");
    expect(migration).toContain("p_legal_regime_code is null");
    expect(migration).toContain("('art_25', 'ordinario')");
    expect(migration).toContain("other_row.shift_id = p_shift_id");
    expect(migration).toContain("Ya existe una estructura para esa jornada; selecciónala para editarla");
    expect(migration).toContain("hr_rent_structure_audit (structure_id, action, snapshot, changed_by)");
  });

  it("conserva RLS, valida la relación BUK y restringe las RPC", () => {
    expect(migration).toContain("current_user_can_configure_hr_rent_structures()");
    expect(migration).toContain("revoke all on function public.get_hr_rent_structure_detail_variant");
    expect(migration).toContain("buk_job_position_contract_access");
    expect(migration).toContain("revoke all on function public.save_hr_rent_structure_variant");
    expect(migration).toContain("grant execute on function public.save_hr_rent_structure_variant");
  });

  it("permite elegir estructuras separadas y oculta los códigos internos de jornada", () => {
    expect(page).toContain("Estructura por jornada");
    expect(page).toContain("Nueva estructura · {shift.name}");
    expect(page).toContain("Cada jornada aplicable tendrá su propia remuneración y cupos.");
    expect(page).toContain("{shift.name}</option>");
    expect(page).not.toContain("shift.code");
    expect(page).toContain("Régimen legal");
    expect(api).toContain("get_hr_rent_structure_variant_control");
    expect(api).toContain("save_hr_rent_structure_variant");
    expect(api).toContain("save_hr_rent_position_shifts");
    expect(api).toContain("p_shift_id: shiftId");
    expect(api).toContain("p_legal_regime_code: legalRegimeCode");
  });
});
