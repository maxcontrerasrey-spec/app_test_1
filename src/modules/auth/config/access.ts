export type AppRole =
  | "admin"
  | "aprobador_folios"
  | "reclutamiento"
  | "control_contratos"
  | "operaciones"
  | "gerencia"
  | "director_eje"
  | "director_op"
  | "gerente_general"
  | "operaciones_l_1"
  | "operaciones_l_2"
  | "administrativo"
  | "jefe_administrativo"
  | "certificaciones"
  | "instructor"
  | "guest";

export type AppCapability = "can_approve_who_stage" | "candidate_control_access";

export type AppFeatureCode =
  | "recruitment_processes_summary"
  | "recruitment_candidate_control"
  | "recruitment_personnel_to_hire"
  | "recruitment_internal_mobility"
  | "roster_calendar"
  | "roster_assign_pattern"
  | "roster_manage_patterns"
  | "hr_incentives_register"
  | "hr_incentives_approvals"
  | "hr_incentives_history"
  | "hr_incentives_configuration"
  | "bi_dotacion"
  | "bi_incentivos"
  | "bi_reclutamiento";

export type AppModuleCode =
  | "solicitud_contrataciones"
  | "movilidad_interna"
  | "control_contrataciones"

  | "operaciones"
  | "recursos_humanos"
  | "jornadas_turnos"
  | "acreditacion_personas"
  | "certificados"
  | "seguimiento_certificados"
  | "alta_operacional_personal"
  | "ai_assistant"
  | "bi_analytics";

const KNOWN_ROLE_CODES = new Set<AppRole>([
  "admin",
  "aprobador_folios",
  "reclutamiento",
  "control_contratos",
  "operaciones",
  "gerencia",
  "director_eje",
  "director_op",
  "gerente_general",
  "operaciones_l_1",
  "operaciones_l_2",
  "administrativo",
  "jefe_administrativo",
  "certificaciones",
  "instructor",
  "guest"
]);

const KNOWN_CAPABILITY_CODES = new Set<AppCapability>([
  "can_approve_who_stage",
  "candidate_control_access"
]);

const KNOWN_FEATURE_CODES = new Set<AppFeatureCode>([
  "recruitment_processes_summary",
  "recruitment_candidate_control",
  "recruitment_personnel_to_hire",
  "recruitment_internal_mobility",
  "roster_calendar",
  "roster_assign_pattern",
  "roster_manage_patterns",
  "hr_incentives_register",
  "hr_incentives_approvals",
  "hr_incentives_history",
  "hr_incentives_configuration",
  "bi_dotacion",
  "bi_incentivos",
  "bi_reclutamiento"
]);

const KNOWN_MODULE_CODES = new Set<AppModuleCode>([
  "solicitud_contrataciones",
  "movilidad_interna",
  "control_contrataciones",

  "operaciones",
  "recursos_humanos",
  "jornadas_turnos",
  "acreditacion_personas",
  "certificados",
  "seguimiento_certificados",
  "alta_operacional_personal",
  "ai_assistant",
  "bi_analytics"
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

export function normalizeCapabilityCode(
  value: string | null | undefined
): AppCapability | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase() as AppCapability;
  return KNOWN_CAPABILITY_CODES.has(normalized) ? normalized : null;
}

export function normalizeFeatureCode(
  value: string | null | undefined
): AppFeatureCode | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase() as AppFeatureCode;
  return KNOWN_FEATURE_CODES.has(normalized) ? normalized : null;
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

export function hasFeatureAccess(
  accessibleFeatures: AppFeatureCode[],
  featureCode: AppFeatureCode
) {
  return accessibleFeatures.includes(featureCode);
}
