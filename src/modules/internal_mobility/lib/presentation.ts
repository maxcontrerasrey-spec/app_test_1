import type { AppRole } from "../../auth/config/access";
import type {
  InternalMobilityHrExecutionStatus,
  InternalMobilityRequestStatus
} from "../types";

function normalizeToStartOfDay(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

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
  if (value === "executed") return "Ejecutado RRHH";
  if (value === "rejected") return "Rechazado RRHH";
  return "Pendiente ejecución RRHH";
}

export function toInternalMobilityVisibleStatusLabel(
  status: InternalMobilityRequestStatus | string | null | undefined,
  hrExecutionStatus: InternalMobilityHrExecutionStatus | string | null | undefined
) {
  if (status === "approved" && hrExecutionStatus === "executed") {
    return "Ejecutada";
  }

  return toInternalMobilityStatusLabel(status);
}

export function formatInternalMobilityOpenDays(
  openedAt: string | null | undefined,
  closedAt?: string | null | undefined
) {
  const openedDate = normalizeToStartOfDay(openedAt);
  if (!openedDate) {
    return "No disponible";
  }

  const endDate = normalizeToStartOfDay(closedAt) ?? normalizeToStartOfDay(new Date().toISOString());
  if (!endDate) {
    return "No disponible";
  }

  const diffInDays = Math.max(
    0,
    Math.floor((endDate.getTime() - openedDate.getTime()) / 86_400_000)
  );

  if (diffInDays === 0) return "Hoy";
  if (diffInDays === 1) return "1 dia";
  return `${diffInDays} dias`;
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
