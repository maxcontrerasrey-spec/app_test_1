import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MockTelematicsProvider } from "../../src/modules/operaciones/telematics/provider";
import { purgeLegacyOperationsDrafts } from "../../src/modules/operaciones/lib/legacyCleanup";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260930174145_atlas_operations_control_tower.sql", import.meta.url),
  "utf8"
);
const superAdminMigration = readFileSync(
  new URL("../../supabase/migrations/20260930174333_lock_atlas_operations_superadmin_only.sql", import.meta.url),
  "utf8"
);
const page = readFileSync(new URL("../../src/modules/operaciones/pages/OperationsControlTowerPage.tsx", import.meta.url), "utf8");
const routePlannerPage = readFileSync(new URL("../../src/modules/operaciones/pages/OperationsRoutePlannerDemo.tsx", import.meta.url), "utf8");
const ferrostarHttpClient = readFileSync(new URL("../../src/modules/operaciones/lib/ferrostarHttpClient.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("../../src/app/router/AppRouter.tsx", import.meta.url), "utf8");
const guards = readFileSync(new URL("../../src/modules/auth/components/RouteGuards.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../../src/shared/config/navigation.ts", import.meta.url), "utf8");
const derivedDispatchMigration = readFileSync(new URL("../../supabase/migrations/20261007191119_atlas_dispatch_route_derived_fields.sql", import.meta.url), "utf8");
const crossContractDriversMigration = readFileSync(new URL("../../supabase/migrations/20261007195521_allow_atlas_cross_contract_drivers.sql", import.meta.url), "utf8");
const resourceReassignmentMigration = readFileSync(new URL("../../supabase/migrations/20261007235755_atlas_dispatch_resource_reassignment_and_roster_warning.sql", import.meta.url), "utf8");
const atlasOperationsApi = readFileSync(new URL("../../src/modules/operaciones/services/atlasOperationsApi.ts", import.meta.url), "utf8");

describe("Atlas Operations greenfield replacement", () => {
  it("retires prior module-owned storage without importing rows into the new schema", () => {
    expect(migration).toMatch(/drop table public\.service_entries/i);
    expect(migration).toMatch(/drop table public\.base_services/i);
    expect(migration).toMatch(/drop table public\.equipment/i);
    expect(migration).toMatch(/drop table public\.operations_contract_editors/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.atlas_ops_[\w]+\s+select/i);
    expect(migration).toMatch(/references public\.contracts/i);
    expect(migration).toMatch(/references public\.profiles/i);
  });

  it("keeps reads contract-scoped and retires direct legacy writes", () => {
    expect(migration).toMatch(/atlas_ops_can_edit_contract\(\(select auth\.uid\(\)\), contract_id\)/i);
    expect(migration).toMatch(/revoke all on function public\.atlas_ops_create_dispatch\(jsonb\) from public, anon/i);
    expect(migration).toMatch(/revoke all on function public\.atlas_ops_transition_dispatch\(uuid, text\) from public, anon/i);
    expect(page).toContain("OperationsControlTowerPage");
    expect(page).not.toContain("base_services");
    expect(page).not.toContain("service_entries");
  });

  it("derives dispatch endpoints and end time from the selected route on the server", () => {
    expect(derivedDispatchMigration).toMatch(/order by stop\.stop_order asc/i);
    expect(derivedDispatchMigration).toMatch(/order by stop\.stop_order desc/i);
    expect(derivedDispatchMigration).toMatch(/start_at \+ make_interval\(secs => route_duration\)/i);
    expect(derivedDispatchMigration).toMatch(/start_at, end_at, nullif\(trim\(origin_key\)/i);
    expect(derivedDispatchMigration).toMatch(/revoke all on function public\.atlas_ops_create_dispatch\(jsonb\) from public, anon/i);
    expect(derivedDispatchMigration).toMatch(/grant execute on function public\.atlas_ops_create_dispatch\(jsonb\) to authenticated/i);
  });

  it("permits an active, roster-eligible BUK worker to serve a different contract", () => {
    expect(crossContractDriversMigration).toContain("El despacho queda limitado al contrato asignado al usuario; los recursos operacionales");
    expect(crossContractDriversMigration).toMatch(/atlas_ops_is_current_super_admin()[\s\S]*?requested_contract_id/i);
    expect(crossContractDriversMigration).toMatch(/atlas_ops_can_access_global_resources\(auth\.uid\(\)\)/i);
    expect(crossContractDriversMigration).toMatch(/atlas_ops_vehicles_select[\s\S]*?atlas_ops_can_access_global_resources/i);
    expect(crossContractDriversMigration).toMatch(/atlas_ops_contract_editors_select[\s\S]*?user_id = \(select auth\.uid\(\)\)/i);
    expect(crossContractDriversMigration).toMatch(/if not public\.atlas_ops_can_access_global_resources\(auth\.uid\(\)\) then/i);
    expect(crossContractDriversMigration).not.toMatch(/driver_row\.contract_code|e\.contract_code\s*=\s*\(select c\.code/i);
    expect(crossContractDriversMigration).not.toContain("La ficha BUK activa no corresponde al contrato seleccionado.");
    expect(crossContractDriversMigration).toMatch(/atlas_ops_can_edit_contract\(actor, contract_key\)/);
    expect(crossContractDriversMigration).toMatch(/where e\.buk_employee_id = driver_key and e\.is_active = true/);
    expect(crossContractDriversMigration).toMatch(/resolve_hr_roster_day_status\(driver_key, \(start_at at time zone 'America\/Santiago'\)::date\)/);
    expect(crossContractDriversMigration).toMatch(/where e\.buk_employee_id = d\.driver_buk_employee_id and e\.is_active/);
    expect(crossContractDriversMigration).toMatch(/resolve_hr_roster_day_status\(d\.driver_buk_employee_id, d\.service_date\)/);
    expect(crossContractDriversMigration).toMatch(/planning_duration_seconds/);
    expect(crossContractDriversMigration).toMatch(/revoke all on function public\.atlas_ops_create_dispatch\(jsonb\) from public, anon/i);
    expect(crossContractDriversMigration).toMatch(/grant execute on function public\.atlas_ops_create_dispatch\(jsonb\) to authenticated/i);
    expect(crossContractDriversMigration).toMatch(/revoke all on function public\.atlas_ops_transition_dispatch\(uuid, text\) from public, anon/i);
    expect(crossContractDriversMigration).toMatch(/grant execute on function public\.atlas_ops_transition_dispatch\(uuid, text\) to authenticated/i);
  });

  it("makes roster advisory and records resource changes through an authorized immutable event", () => {
    expect(resourceReassignmentMigration).not.toContain("La jornada BUK no habilita este conductor");
    expect(resourceReassignmentMigration).not.toContain("La jornada BUK ya no habilita este conductor");
    expect(resourceReassignmentMigration).toMatch(/where e\.buk_employee_id = driver_key and e\.is_active = true/);
    expect(resourceReassignmentMigration).toMatch(/where v\.id = vehicle_key and v\.is_active = true/);
    expect(resourceReassignmentMigration).toMatch(/atlas_ops_can_edit_contract\(actor, d\.contract_id\)/);
    expect(resourceReassignmentMigration).toMatch(/execution_status in \('in_progress','suspended'\)/);
    expect(resourceReassignmentMigration).toMatch(/'contingency', in_execution/);
    expect(resourceReassignmentMigration).toMatch(/'dispatch\.resources_reassigned'/);
    expect(resourceReassignmentMigration).toMatch(/'old_driver', old_driver, 'new_driver', new_driver/);
    expect(resourceReassignmentMigration).toMatch(/revoke all on function public\.atlas_ops_reassign_dispatch\(uuid, text, uuid, text\) from public, anon/i);
    expect(resourceReassignmentMigration).toMatch(/grant execute on function public\.atlas_ops_reassign_dispatch\(uuid, text, uuid, text\) to authenticated/i);
    expect(resourceReassignmentMigration).toMatch(/with \(security_invoker = true\)/i);
    expect(resourceReassignmentMigration).toMatch(/v\.vehicle_type, v\.brand, v\.model, v\.year/);
    expect(resourceReassignmentMigration).toMatch(/roster\.effective_status as driver_roster_status/);
    expect(atlasOperationsApi).toContain('"atlas_ops_reassign_dispatch"');
  });

  it("shows equipment metadata and non-blocking roster warnings in dispatch workflows", () => {
    expect(page).toContain("Cambiar conductor o vehículo");
    expect(page).toContain("Contingencia durante servicio");
    expect(page).toContain("En descanso · revisar asignación");
    expect(page).toContain("Jornada: ${readableStatus(rosterStatus)}");
    expect(page).toContain("dispatch.vehicle_type, dispatch.brand, dispatch.model, dispatch.year");
    expect(page).toContain("No existe un dato de mantenimiento conectado");
    expect(atlasOperationsApi).toContain("driver_roster_status: string | null");
  });

  it("keeps the operational planner free of demo data and reports actionable driver simulation errors", () => {
    expect(routePlannerPage).not.toContain("Cargar ejemplo Calama");
    expect(ferrostarHttpClient).toContain("response.ok");
    expect(ferrostarHttpClient).toContain('headers.set("content-type", "application/json")');
    expect(routePlannerPage).toContain('import("../lib/ferrostarDriverRuntime")');
    expect(routePlannerPage).toContain("formatDriverSimulationError(reason)");
    expect(routePlannerPage).toContain("Falló al ${phase}");
  });

  it("limits the route, navigation and database policies to active profile superadmins", () => {
    expect(router).toMatch(/<SuperAdminProtectedRoute>[\s\S]*?<OperationsControlTower\s*\/>[\s\S]*?<\/SuperAdminProtectedRoute>/);
    expect(guards).toMatch(/if \(!isSuperAdmin\)[\s\S]*?Navigate to="\/sin-acceso"/);
    expect(navigation).toMatch(/label: "Operaciones",[\s\S]{0,100}superAdminOnly: true/);
    expect(migration).toMatch(/p\.status = 'active' and p\.is_super_admin = true/);
    expect(migration).toMatch(/delete from public\.role_module_access where module_code = 'operaciones'/);
    expect(migration).not.toMatch(/user_is_admin\(\)/);
    expect(page).toContain("const canOperate = isAdmin || (catalogsQuery.data?.editableContractIds.length ?? 0) > 0");
    for (const rpc of [
      "atlas_ops_driver_acknowledge",
      "atlas_ops_driver_mark_milestone",
      "atlas_ops_driver_get_dispatches",
      "atlas_ops_driver_report_incident"
    ]) {
      const functionBody = superAdminMigration.slice(superAdminMigration.indexOf(`function public.${rpc}`));
      expect(functionBody).toMatch(/if not public\.atlas_ops_is_current_super_admin\(\) then raise exception/);
    }
  });

  it("keeps mock telemetry explicitly simulated and deterministically ordered", async () => {
    const provider = new MockTelematicsProvider([
      { provider: "mock", externalVehicleId: "vehicle-1", externalEventId: "later", latitude: 0, longitude: 0, recordedAt: "2026-01-02T00:00:00Z", receivedAt: "2026-01-02T00:00:01Z" },
      { provider: "mock", externalVehicleId: "vehicle-1", externalEventId: "earlier", latitude: 0, longitude: 0, recordedAt: "2026-01-01T00:00:00Z", receivedAt: "2026-01-01T00:00:01Z" }
    ]);
    const positions = await provider.getPositions("vehicle-1", new Date("2026-01-01"), new Date("2026-01-03"));

    expect(positions.map((position) => position.externalEventId)).toEqual(["earlier", "later"]);
    expect((await provider.healthCheck()).detail).toContain("no es evidencia GPS real");
    expect(() => new MockTelematicsProvider([
      { provider: "tracktec", externalVehicleId: "vehicle-1", externalEventId: "real", latitude: 0, longitude: 0, recordedAt: "2026-01-01T00:00:00Z", receivedAt: "2026-01-01T00:00:01Z" }
    ])).toThrow("provider=mock");
  });

  it("purges retired browser drafts instead of restoring them into the new module", () => {
    const values = new Map<string, string>([
      ["operations:base-register:draft:v1:operator-a", "old"],
      ["operations:base-register:draft:v2:operator-b", "old"],
      ["atlas-operations:unrelated", "keep"]
    ]);
    const storage = {
      get length() { return values.size; },
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key)
    };

    purgeLegacyOperationsDrafts(storage);
    expect([...values.keys()]).toEqual(["atlas-operations:unrelated"]);
  });
});
