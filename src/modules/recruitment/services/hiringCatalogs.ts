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

type JobPositionRow = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

type ContractMappingRow = {
  contract_id: number | null;
  contract_number: string;
  buk_area_name: string;
  cost_unit: string;
  cost_unit_name: string;
  cost_center_code: string;
  cost_center_name: string;
  contracts:
    | {
        code: string;
      }
    | Array<{
        code: string;
      }>
    | null;
};

type ShiftRow = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

async function syncBukJobPositionsBestEffort() {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.functions.invoke("sync-buk-job-positions", {
    body: {}
  });

  if (error) {
    logger.warn("fetchHiringCatalogs syncBukJobPositions", error);
  }
}

export async function fetchHiringCatalogs() {
  if (!supabase) {
    return {
      hiringRoles: [] as HiringRole[],
      contractCatalog: [] as ContractCatalogItem[],
      shiftCatalog: [] as ShiftCatalogItem[],
      error: "Supabase no está configurado en este entorno."
    };
  }

  await syncBukJobPositionsBestEffort();

  const [jobPositionsResponse, contractsResponse, shiftsResponse] = await Promise.all([
    supabase
      .from("job_positions")
      .select("id, code, name, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("buk_contract_mappings")
      .select(
        "contract_id, contract_number, buk_area_name, cost_unit, cost_unit_name, cost_center_code, cost_center_name, contracts!inner(code)"
      )
      .eq("is_operational", true)
      .eq("is_one_to_one", true)
      .not("contract_id", "is", null)
      .order("buk_area_name", { ascending: true }),
    supabase
      .from("shifts")
      .select("id, code, name, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true })
  ]);

  if (jobPositionsResponse.error || contractsResponse.error || shiftsResponse.error) {
    const firstError =
      jobPositionsResponse.error ?? contractsResponse.error ?? shiftsResponse.error;

    return {
      hiringRoles: [] as HiringRole[],
      contractCatalog: [] as ContractCatalogItem[],
      shiftCatalog: [] as ShiftCatalogItem[],
      error: firstError
        ? getSupabaseErrorMessage(
            firstError,
            "No fue posible cargar los catálogos de contratación desde Supabase.",
            "message"
          )
        : "No fue posible cargar los catálogos de contratación desde Supabase."
    };
  }

  const hiringRoles = (jobPositionsResponse.data as JobPositionRow[] | null)?.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.is_active
  })) ?? [];

  const contractCatalog =
    (contractsResponse.data as ContractMappingRow[] | null)?.flatMap((row) => {
      if (!row.contract_id) {
        return [];
      }

      const relation = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts;

      if (!relation?.code) {
        return [];
      }

      return [{
        id: row.contract_id,
        code: relation.code,
        contractNumber: row.contract_number,
        contractName: row.buk_area_name,
        costUnit: row.cost_unit,
        costUnitName: row.cost_unit_name,
        costCenterCode: row.cost_center_code,
        costCenterName: row.cost_center_name,
        active: true
      }];
    }) ?? [];

  const shiftCatalog =
    (shiftsResponse.data as ShiftRow[] | null)?.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      active: row.is_active
    })) ?? [];

  return {
    hiringRoles,
    contractCatalog,
    shiftCatalog,
    error: null
  };
}
