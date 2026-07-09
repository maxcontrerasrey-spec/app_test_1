import { supabase } from "../../../shared/lib/supabase";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

export type HiringWorkflowStatus =
  | "pending_area_manager"
  | "pending_contracts_control"
  | "approved"
  | "rejected"
  | "closed";

export type HiringApprovalDecision = "approved" | "rejected";
export type TravelMethodology = "travel_allowance" | "company_purchase";

export const travelMethodologyOptions = [
  { value: "travel_allowance", label: "Bono de traslado" },
  { value: "company_purchase", label: "Compra Empresa" }
] as const;

export function toTravelMethodologyLabel(value: TravelMethodology | string | null | undefined) {
  if (value === "travel_allowance") return "Bono de traslado";
  if (value === "company_purchase") return "Compra Empresa";
  return "Sin definir";
}

export function toHiringStatusLabel(value: HiringWorkflowStatus | string | null | undefined) {
  if (value === "approved") return "Aprobada";
  if (value === "rejected") return "Rechazada";
  if (value === "closed") return "Cerrada";
  if (value === "pending_contracts_control") return "Pendiente control contratos";
  if (value === "pending_area_manager") return "Pendiente gerente de area";
  return "Pendiente";
}

export async function decideHiringApproval(params: {
  approvalId: number;
  decision: HiringApprovalDecision;
  comment?: string | null;
  travelMethodology?: TravelMethodology | null;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { error } = await supabase.rpc("decide_hiring_request_approval_v2", {
    p_approval_id: params.approvalId,
    p_decision: params.decision,
    p_comment: params.comment?.trim() ? params.comment.trim() : null,
    p_travel_methodology: params.travelMethodology ?? null
  });

  if (error) {
    return {
      error: getSupabaseErrorMessage(error, "No fue posible registrar la decisión.")
    };
  }

  return {
    error: null
  };
}

export async function getHiringApprovalDetails(approvalId: number) {
  if (!supabase) return { data: null, error: "Supabase no está configurado." };

  const { data, error } = await supabase.rpc("get_hiring_approval_detail", {
    p_approval_id: approvalId
  });

  if (error) {
    return {
      data: null,
      error: getSupabaseErrorMessage(error, "Error al cargar detalles de la aprobación.")
    };
  }

  return { data, error: null };
}

export async function closeHiringRequest(params: {
  requestId: string;
  comment?: string | null;
}) {
  if (!supabase) return { error: "Supabase no está configurado." };

  const { error } = await supabase.rpc("close_hiring_request", {
    p_request_id: params.requestId,
    p_comment: params.comment?.trim() ? params.comment.trim() : null
  });

  if (error) {
    return {
      error: getSupabaseErrorMessage(error, "No fue posible cerrar la solicitud.")
    };
  }

  return { error: null };
}
