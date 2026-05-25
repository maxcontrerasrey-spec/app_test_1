import { supabase } from "../../../shared/lib/supabase";

export type HiringWorkflowStatus =
  | "pending_area_manager"
  | "pending_contracts_control"
  | "approved"
  | "rejected";

export type HiringApprovalDecision = "approved" | "rejected";

function formatRpcError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}) {
  return [
    error.message,
    error.details ? `Detalles: ${error.details}` : "",
    error.hint ? `Sugerencia: ${error.hint}` : "",
    error.code ? `Código: ${error.code}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

export function toHiringStatusLabel(value: HiringWorkflowStatus | string | null | undefined) {
  if (value === "approved") return "Aprobada";
  if (value === "rejected") return "Rechazada";
  if (value === "pending_contracts_control") return "Pendiente control contratos";
  if (value === "pending_area_manager") return "Pendiente gerente de area";
  return "Pendiente";
}

export async function decideHiringApproval(params: {
  approvalId: number;
  decision: HiringApprovalDecision;
  comment?: string | null;
}) {
  if (!supabase) {
    return {
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { error } = await supabase.rpc("decide_hiring_request_approval_v2", {
    p_approval_id: params.approvalId,
    p_decision: params.decision,
    p_comment: params.comment?.trim() ? params.comment.trim() : null
  });

  if (error) {
    return {
      error: formatRpcError(error) || "No fue posible registrar la decisión."
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
      error: formatRpcError(error) || "Error al cargar detalles de la aprobación."
    };
  }

  return { data, error: null };
}
