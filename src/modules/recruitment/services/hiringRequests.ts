import { supabase } from "../../../shared/lib/supabase";
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
    const errorParts = [
      error.message,
      error.details ? `Detalles: ${error.details}` : "",
      error.hint ? `Sugerencia: ${error.hint}` : "",
      error.code ? `Código: ${error.code}` : ""
    ].filter(Boolean);

    return {
      data: null,
      error: `No fue posible guardar la solicitud en Supabase. ${errorParts.join(" · ")}`
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
