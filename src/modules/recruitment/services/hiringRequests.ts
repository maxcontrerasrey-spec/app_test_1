import { supabase } from "../../../shared/lib/supabase";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";
import type {
  ContractCatalogItem,
  HiringRole,
  ShiftCatalogItem
} from "./hiringCatalogs";

type CreateHiringRequestInput = {
  requestedEntryDate: string;
  jobPosition: HiringRole;
  vacancies: number;
  contract: ContractCatalogItem;
  startDate: string;
  endDate: string;
  campamento: boolean;
  pasajes: boolean;
  otherBenefits: string;
  salaryOffer: number;
  shift: ShiftCatalogItem;
  requesterSigned: boolean;
};

type CreateHiringRequestRpcResponse = {
  request_id: string;
  folio: string;
};

export async function createHiringRequest(input: CreateHiringRequestInput) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("submit_hiring_request", {
    p_contract_id: input.contract.id,
    p_job_position_id: input.jobPosition.id,
    p_vacancies: input.vacancies,
    p_requested_entry_date: input.requestedEntryDate,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_campamento: input.campamento,
    p_pasajes: input.pasajes,
    p_other_benefits: input.otherBenefits || null,
    p_salary_offer: input.salaryOffer,
    p_shift_id: input.shift.id,
    p_requester_signed: input.requesterSigned
  });

  if (error) {
    return {
      data: null,
      error: getSupabaseErrorMessage(
        error,
        "No fue posible guardar la solicitud en Supabase.",
        "annotated"
      )
    };
  }

  const firstRow = Array.isArray(data)
    ? ((data[0] as CreateHiringRequestRpcResponse | undefined) ?? null)
    : ((data as CreateHiringRequestRpcResponse | null) ?? null);

  if (!firstRow) {
    return {
      data: null,
      error: "Supabase no devolvió el folio de la solicitud creada."
    };
  }

  return {
    data: firstRow,
    error: null
  };
}
