export type AppRole =
  | "admin"
  | "aprobador_folios"
  | "reclutamiento"
  | "control_contratos"
  | "certificaciones"
  | "instructor"
  | "guest";

export type AppModuleCode =
  | "solicitud_contrataciones"
  | "control_contrataciones"
  | "certificados"
  | "seguimiento_certificados";

const KNOWN_ROLE_CODES = new Set<AppRole>([
  "admin",
  "aprobador_folios",
  "reclutamiento",
  "control_contratos",
  "certificaciones",
  "instructor",
  "guest"
]);

const KNOWN_MODULE_CODES = new Set<AppModuleCode>([
  "solicitud_contrataciones",
  "control_contrataciones",
  "certificados",
  "seguimiento_certificados"
]);

export function normalizeRoleCode(value: string | null | undefined): AppRole | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase() as AppRole;
  return KNOWN_ROLE_CODES.has(normalized) ? normalized : null;
}

export function normalizeModuleCode(
  value: string | null | undefined
): AppModuleCode | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase() as AppModuleCode;
  return KNOWN_MODULE_CODES.has(normalized) ? normalized : null;
}

export function resolvePrimaryRole(roles: AppRole[], isSuperAdmin: boolean) {
  if (isSuperAdmin || roles.includes("admin")) {
    return "admin" satisfies AppRole;
  }

  return roles[0] ?? "guest";
}

export function hasModuleAccess(
  accessibleModules: AppModuleCode[],
  moduleCode: AppModuleCode
) {
  return accessibleModules.includes(moduleCode);
}
