import { supabase } from "../../../shared/lib/supabase";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

export type RentStructureContract = {
  id: number;
  code: string;
  contractNumber: string;
  contractName: string;
};

export type RentStructurePosition = {
  id: number;
  code: string;
  name: string;
  hasStructure: boolean;
  monthlyBudget: number | null;
  currencyCode: string;
};

export type RentStructureLine = {
  id: string;
  conceptCode: string;
  conceptName: string;
  conceptType: string;
  amount: number;
  sortOrder: number;
};

export type RentStructureDetail = {
  id: string;
  jobPositionId: number;
  monthlyBudget: number | null;
  currencyCode: string;
  lines: RentStructureLine[];
} | null;

export type RentStructureControlPayload = {
  contracts: RentStructureContract[];
  positions: RentStructurePosition[];
  structure: RentStructureDetail;
};

type RawPayload = {
  contracts?: Array<{ id: number; code: string; contract_number: string; contract_name: string }>;
  positions?: Array<{ id: number; code: string; name: string; has_structure: boolean; monthly_budget: number | null; currency_code: string }>;
  structure?: { id: string; job_position_id: number; monthly_budget: number | null; currency_code: string; lines?: Array<{ id: string; concept_code: string; concept_name: string; concept_type: string; amount: number; sort_order: number }> };
};

export async function fetchRentStructureControl(contractId: number | null, jobPositionId: number | null) {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");

  const { data, error } = await supabase.rpc("get_hr_rent_structure_control", {
    p_contract_id: contractId,
    p_job_position_id: jobPositionId
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar el control de estructuras de renta.", "message"));
  }

  const payload = (data ?? {}) as RawPayload;
  return {
    contracts: (payload.contracts ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      contractNumber: row.contract_number,
      contractName: row.contract_name
    })),
    positions: (payload.positions ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      hasStructure: row.has_structure,
      monthlyBudget: row.monthly_budget,
      currencyCode: row.currency_code
    })),
    structure: payload.structure
      ? {
          id: payload.structure.id,
          jobPositionId: payload.structure.job_position_id,
          monthlyBudget: payload.structure.monthly_budget,
          currencyCode: payload.structure.currency_code,
          lines: (payload.structure.lines ?? []).map((line) => ({
            id: line.id,
            conceptCode: line.concept_code,
            conceptName: line.concept_name,
            conceptType: line.concept_type,
            amount: line.amount,
            sortOrder: line.sort_order
          }))
        }
      : null
  } satisfies RentStructureControlPayload;
}
