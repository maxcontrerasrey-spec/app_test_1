import type { AppRole } from "../../auth/config/access";

export const HR_INCENTIVE_ANALYTICS_ALLOWED_ROLES = [
  "director_eje",
  "gerente_general",
  "director_op",
  "gerencia",
  "operaciones_l_1",
  "control_contratos"
] satisfies AppRole[];

const hrIncentiveAnalyticsAllowedRolesSet = new Set<AppRole>(HR_INCENTIVE_ANALYTICS_ALLOWED_ROLES);

export function canViewHrIncentiveAnalytics(params: {
  appRoles: AppRole[];
  isSuperAdmin: boolean;
}) {
  if (params.isSuperAdmin) {
    return true;
  }

  return params.appRoles.some((role) => hrIncentiveAnalyticsAllowedRolesSet.has(role));
}
