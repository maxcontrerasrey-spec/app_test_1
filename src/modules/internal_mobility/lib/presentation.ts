import type { AppRole } from "../../auth/config/access";
import type {
  InternalMobilityHrExecutionStatus,
  InternalMobilityRequestStatus
} from "../types";

export function toInternalMobilityStatusLabel(value: InternalMobilityRequestStatus | string | null | undefined) {
  if (value === "approved") return "Aprobada";
  if (value === "rejected") return "Rechazada";
  if (value === "closed") return "Cerrada";
  if (value === "pending_contracts_control") return "Pendiente control contratos";
  if (value === "pending_area_manager") return "Pendiente gerente de area";
  return "Pendiente";
}

export function toInternalMobilityExecutionStatusLabel(
  value: InternalMobilityHrExecutionStatus | string | null | undefined
) {
  return value === "executed" ? "Ejecutado RRHH" : "Pendiente ejecución RRHH";
}

export function toInternalMobilityAuditLabel(value: string | null | undefined) {
  if (value === "submitted") return "Solicitud enviada";
  if (value === "approval_created") return "Aprobación creada";
  if (value === "approved") return "Aprobación registrada";
  if (value === "rejected") return "Solicitud rechazada";
  if (value === "hr_execution_updated") return "Ejecución RRHH actualizada";
  return value || "Evento";
}

export function canManageInternalMobilityHrExecution(
  appRoles: AppRole[],
  isSuperAdmin: boolean
) {
  return (
    isSuperAdmin ||
    appRoles.includes("admin") ||
    appRoles.includes("administrativo") ||
    appRoles.includes("jefe_administrativo")
  );
}
