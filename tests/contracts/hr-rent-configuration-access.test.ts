import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260925120000_restrict_hr_rent_configuration_roles.sql",
  "utf8"
);
const verificationMigration = readFileSync(
  "supabase/migrations/20260925121500_verify_hr_rent_configuration_scope.sql",
  "utf8"
);
const page = readFileSync(
  "src/modules/rent_structures/pages/RentStructuresPage.tsx",
  "utf8"
);

describe("acceso a configuración de estructuras de renta", () => {
  it("limita la configuración a superadmin explícito y control de contratos", () => {
    expect(migration).toContain("profile_row.is_super_admin = true");
    expect(migration).toContain("public.user_has_role(auth.uid(), 'control_contratos')");
    expect(migration).toContain("current_user_can_configure_hr_rent_structures()");
    expect(migration).not.toContain("user_can_configure_hr_rent_structures(target_user_id uuid)");
    expect(migration).not.toContain("to_jsonb(public.user_is_admin");
  });

  it("mantiene lectura gerencial y habilita el módulo para control de contratos", () => {
    expect(migration).toContain("public.user_has_role(actor_id, 'gerencia')");
    expect(migration).toContain("public.user_has_role(actor_id, 'control_contratos')");
    expect(migration).toContain("('control_contratos', 'control_estructuras_renta', true)");
    expect(migration).toContain("'{can_configure}'");
  });

  it("protege el guardado en backend y retira ejecución de firmas heredadas", () => {
    expect(migration).toContain("not public.current_user_can_configure_hr_rent_structures()");
    expect(migration).toContain("save_hr_rent_structure_config_before_config_scope");
    expect(migration).toContain("save_hr_rent_structure_config(bigint, bigint, integer, jsonb)");
    expect(migration).toContain("bigint, bigint, integer, jsonb, text, text, text, numeric, text");
  });

  it("muestra la pestaña únicamente desde la señal autorizada por backend", () => {
    expect(page).toContain("query.data?.canConfigure ?");
    expect(page).toContain('setView("configuracion")');
  });

  it("verifica el alcance contra usuarios y privilegios reales al desplegar", () => {
    expect(verificationMigration).toContain("has_function_privilege");
    expect(verificationMigration).toContain("El superadministrador no quedó autorizado");
    expect(verificationMigration).toContain("Control de Contratos no quedó autorizado");
    expect(verificationMigration).toContain("Un gerente ordinario conserva acceso indebido");
    expect(verificationMigration).toContain("El gerente ordinario perdió el acceso de lectura");
  });
});
