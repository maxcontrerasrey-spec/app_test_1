import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const baseMigration = readFileSync(new URL("../../supabase/migrations/20261008010246_atlas_planned_vehicle_type_mismatch_warning.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20261008011000_atlas_route_vehicle_category_profiles.sql", import.meta.url), "utf8");
const planner = readFileSync(new URL("../../src/modules/operaciones/pages/OperationsRoutePlannerDemo.tsx", import.meta.url), "utf8");
const controlTower = readFileSync(new URL("../../src/modules/operaciones/pages/OperationsControlTowerPage.tsx", import.meta.url), "utf8");

describe("Atlas planned vehicle type contract", () => {
  it("persists only a currently available fleet type on a saved route version", () => {
    expect(baseMigration).toContain("add column planned_vehicle_type text");
    expect(migration).toContain("atlas_ops_route_vehicle_category(v.vehicle_type) = canonical_vehicle_type");
    expect(migration).toContain("planned_vehicle_type = canonical_vehicle_type");
    expect(migration).toContain("grant execute on function public.atlas_ops_save_optimized_service_route(bigint, text, jsonb, integer, integer, integer, integer, text) to authenticated");
    expect(planner).toContain("plannedVehicleType");
    expect(planner).toContain("getAvailableAtlasRouteVehicleCategories(catalog?.vehicles ?? [])");
  });

  it("exposes a non-blocking planned-versus-assigned type warning in operations", () => {
    expect(migration).toMatch(/r\.planned_vehicle_type,[\s\S]*atlas_ops_route_vehicle_category\(r\.planned_vehicle_type\) is distinct from public\.atlas_ops_route_vehicle_category\(v\.vehicle_type\)/);
    expect(migration).toContain("grant select on public.atlas_ops_control_tower to authenticated");
    expect(controlTower).toContain("Puedes continuar, pero revisa la compatibilidad del recorrido.");
    expect(controlTower).toContain("Tipo distinto al planificado");
  });

  it("renders driver roster together and equipment fields separately", () => {
    expect(controlTower).toContain("atlas-ops__detail-driver");
    expect(controlTower).toContain("atlas-ops__equipment-grid");
    for (const field of ["N.º equipo", "Patente", "Tipo de equipo", "Marca", "Modelo", "Año"]) {
      expect(controlTower).toContain(field);
    }
  });
});
