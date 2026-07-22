import { SERVICE_DATA } from "../data/services-data";
import type { BaseServiceQueryRow, Driver, OperationsServiceRecord, ServiceDraft } from "../types";
import { normalizeText } from "./transformers";

const PILOT_CONTRACTS = ["CODELCO DRT", "CODELCO DMH"];
export const BASE_REGISTER_DRAFT_VERSION = 1;
const BASE_REGISTER_DRAFT_TTL_MS = 1000 * 60 * 60 * 72;

export const EXPORT_PAGE_SIZE = 1000;
export const DASHBOARD_PAGE_SIZE = 1000;
export const DASHBOARD_ENTRY_SELECT =
  "contract_code, service_date, shift, driver_name, driver_shift_status, service_operational_name, service_execution_status, service_execution_note, equipment_code, equipment_plate, equipment_type";
export const EXPORT_ENTRY_SELECT =
  "service_date, shift, contract_code, service_operational_name, service_contractual_name, service_category, service_company, service_execution_status, service_execution_note, driver_name, driver_document, driver_area, driver_shift_status, equipment_code, equipment_plate, equipment_type, equipment_client, created_at";

export const LOCAL_NORMALIZED_DATA: OperationsServiceRecord[] = SERVICE_DATA.map((item) => ({
  ...item,
  normalizedSchedule: normalizeText(item.schedule),
}));

export interface BaseRegisterDraftSnapshot {
  version: typeof BASE_REGISTER_DRAFT_VERSION;
  userId: string;
  selectedContract: string;
  selectedShift: string;
  selectedDateValue: string;
  serviceDrafts: Record<number, ServiceDraft>;
  driverDirectory: Record<string, Driver>;
  updatedAt: number;
}

export function normalizeOperationsContractLabel(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^SERVICIO\s+/i, "");
}

export function sortOperationsContracts(contracts: string[]) {
  const unique = [...new Set(contracts.map(normalizeOperationsContractLabel).filter(Boolean))];
  return unique.sort((left, right) => {
    const leftIndex = PILOT_CONTRACTS.indexOf(left);
    const rightIndex = PILOT_CONTRACTS.indexOf(right);

    if (leftIndex >= 0 || rightIndex >= 0) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right, "es");
  });
}

export function buildRemoteOperationsServices(
  rows: BaseServiceQueryRow[] | null | undefined,
  contractsCatalogRows: Array<{ id: number | string; code: string | null; contract_name: string | null }> | null | undefined
) {
  const contractCatalogById = new Map(
    (contractsCatalogRows ?? []).map((contract) => [
      Number(contract.id),
      normalizeOperationsContractLabel(contract.contract_name || contract.code || ""),
    ] as const)
  );

  return (rows ?? []).map((row) => {
    const resolvedContract = normalizeOperationsContractLabel(
      row.contracts?.[0]?.contract_name ||
        row.contracts?.[0]?.code ||
        contractCatalogById.get(Number(row.contract_id ?? 0)) ||
        ""
    );

    return {
      id: Number(row.external_key),
      service: row.operational_name,
      company: row.company_name,
      type: row.service_type,
      contractName: row.contractual_name,
      category: row.contractual_category,
      contract: resolvedContract,
      schedule: row.schedule_label,
      normalizedSchedule: normalizeText(row.schedule_label),
    } satisfies OperationsServiceRecord;
  });
}

export function getBaseRegisterDraftKey(userId: string) {
  return `operations:base-register:draft:v${BASE_REGISTER_DRAFT_VERSION}:${userId}`;
}

export function hasMeaningfulServiceDrafts(serviceDrafts: Record<number, ServiceDraft>) {
  return Object.values(serviceDrafts).some((draft) =>
    Boolean(
      draft.driverId ||
      draft.equipmentCode ||
      draft.serviceExecutionNote ||
      draft.serviceExecutionStatus === "not_performed"
    )
  );
}

export function readBaseRegisterDraft(userId: string): BaseRegisterDraftSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const rawSnapshot = window.localStorage.getItem(getBaseRegisterDraftKey(userId));
    if (!rawSnapshot) return null;

    const snapshot = JSON.parse(rawSnapshot) as Partial<BaseRegisterDraftSnapshot>;
    if (
      snapshot.version !== BASE_REGISTER_DRAFT_VERSION ||
      snapshot.userId !== userId ||
      typeof snapshot.updatedAt !== "number" ||
      Date.now() - snapshot.updatedAt > BASE_REGISTER_DRAFT_TTL_MS
    ) {
      window.localStorage.removeItem(getBaseRegisterDraftKey(userId));
      return null;
    }

    return {
      version: BASE_REGISTER_DRAFT_VERSION,
      userId,
      selectedContract: String(snapshot.selectedContract ?? ""),
      selectedShift: String(snapshot.selectedShift ?? ""),
      selectedDateValue: String(snapshot.selectedDateValue ?? ""),
      serviceDrafts: (snapshot.serviceDrafts ?? {}) as Record<number, ServiceDraft>,
      driverDirectory: (snapshot.driverDirectory ?? {}) as Record<string, Driver>,
      updatedAt: snapshot.updatedAt,
    };
  } catch {
    window.localStorage.removeItem(getBaseRegisterDraftKey(userId));
    return null;
  }
}

export function removeBaseRegisterDraft(userId: string | undefined) {
  if (!userId || typeof window === "undefined") return;
  window.localStorage.removeItem(getBaseRegisterDraftKey(userId));
}
