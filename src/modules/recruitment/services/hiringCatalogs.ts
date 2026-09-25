import { supabase } from "../../../shared/lib/supabase";
import { logger } from "../../../shared/lib/logger";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

export type HiringRole = {
  id: number;
  code: string;
  name: string;
  active: boolean;
};

export type ContractCatalogItem = {
  id: number;
  code: string;
  contractNumber: string;
  contractName: string;
  costUnit: string;
  costUnitName: string;
  costCenterCode: string;
  costCenterName: string;
  active: boolean;
};

export type ShiftCatalogItem = {
  id: number;
  code: string;
  name: string;
  active: boolean;
};

export type HiringJobPositionContractAccess = {
  jobPositionId: number;
  contractId: number;
};

type HiringCatalogRpcPayload = {
  hiringRoles?: Array<{
    id: number;
    code: string;
    name: string;
    active: boolean;
  }>;
  contractCatalog?: Array<{
    id: number;
    code: string;
    contractNumber: string;
    contractName: string;
    costUnit: string;
    costUnitName: string;
    costCenterCode: string;
    costCenterName: string;
    active: boolean;
  }>;
  shiftCatalog?: Array<{
    id: number;
    code: string;
    name: string;
    active: boolean;
  }>;
  jobPositionContractAccess?: Array<{
    jobPositionId: number;
    contractId: number;
  }>;
};

export async function syncBukJobPositionsBestEffort() {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.functions.invoke("sync-buk-job-positions", {
    body: {}
  });

  if (error) {
    logger.warn("fetchHiringCatalogs syncBukJobPositions", error);
    return false;
  }

  return true;
}

export async function fetchHiringCatalogs() {
  if (!supabase) {
    return {
      hiringRoles: [] as HiringRole[],
      contractCatalog: [] as ContractCatalogItem[],
      shiftCatalog: [] as ShiftCatalogItem[],
      jobPositionContractAccess: [] as HiringJobPositionContractAccess[],
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_hiring_request_catalogs");

  if (error) {
    return {
      hiringRoles: [] as HiringRole[],
      contractCatalog: [] as ContractCatalogItem[],
      shiftCatalog: [] as ShiftCatalogItem[],
      jobPositionContractAccess: [] as HiringJobPositionContractAccess[],
      error: getSupabaseErrorMessage(
        error,
        "No fue posible cargar los catálogos de contratación desde Supabase.",
        "message"
      )
    };
  }

  const payload = (data ?? {}) as HiringCatalogRpcPayload;

  const hiringRoles = payload.hiringRoles?.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.active
  })) ?? [];

  const contractCatalog = payload.contractCatalog ?? [];

  const shiftCatalog = payload.shiftCatalog?.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.active
  })) ?? [];

  const jobPositionContractAccess = payload.jobPositionContractAccess ?? [];

  return {
    hiringRoles,
    contractCatalog,
    shiftCatalog,
    jobPositionContractAccess,
    error: null
  };
}
