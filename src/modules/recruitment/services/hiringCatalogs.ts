import { supabase } from "../../../shared/lib/supabase";

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

type ContractRow = {
  id: number;
  code: string;
  contract_number: string;
  contract_name: string;
  cost_unit: string;
  cost_unit_name: string;
  cost_center_code: string;
  cost_center_name: string;
  is_active: boolean;
};

type ShiftRow = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

export async function fetchHiringCatalogs() {
  if (!supabase) {
    return {
      hiringRoles: [] as HiringRole[],
      contractCatalog: [] as ContractCatalogItem[],
      shiftCatalog: [] as ShiftCatalogItem[],
      error: "Supabase no está configurado en este entorno."
    };
  }

  const [jobPositionsResponse, contractsResponse, shiftsResponse] = await Promise.all([
    supabase
      .from("job_positions")
      .select("id, code, name, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("contracts")
      .select(
        "id, code, contract_number, contract_name, cost_unit, cost_unit_name, cost_center_code, cost_center_name, is_active"
      )
      .eq("is_active", true)
      .order("contract_name", { ascending: true }),
    supabase
      .from("shifts")
      .select("id, code, name, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true })
  ]);

  if (jobPositionsResponse.error || contractsResponse.error || shiftsResponse.error) {
    return {
      hiringRoles: [] as HiringRole[],
      contractCatalog: [] as ContractCatalogItem[],
      shiftCatalog: [] as ShiftCatalogItem[],
      error: "No fue posible cargar los catálogos de contratación desde Supabase."
    };
  }

  const hiringRoles = (jobPositionsResponse.data as JobPositionRow[] | null)?.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.is_active
  })) ?? [];

  const contractCatalog =
    (contractsResponse.data as ContractRow[] | null)?.map((row) => ({
      id: row.id,
      code: row.code,
      contractNumber: row.contract_number,
      contractName: row.contract_name,
      costUnit: row.cost_unit,
      costUnitName: row.cost_unit_name,
      costCenterCode: row.cost_center_code,
      costCenterName: row.cost_center_name,
      active: row.is_active
    })) ?? [];

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
