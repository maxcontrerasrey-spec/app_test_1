import { supabase } from "../../../shared/lib/supabase";

type CandidateDocumentValidationSummary = {
  status: "pending" | "approved";
  validated_by: string | null;
  validated_by_name: string | null;
  validated_at: string | null;
  comment: string | null;
};

export type CandidateDocumentStatus = "pending" | "uploaded" | "approved" | "rejected" | "expired";

export type CandidateDocumentRow = {
  id: string;
  document_type_id: string;
  name: string;
  is_critical: boolean;
  is_required: boolean;
  requires_expiry_date: boolean;
  status: CandidateDocumentStatus;
  file_path: string | null;
  expiry_date: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
};

export type CandidateChecklistResult = {
  semaphore: "green" | "yellow" | "red" | "gray";
  candidate_group: "conductor" | "otros";
  worker_file_complete: boolean;
  missing_person_fields: string[];
  missing_worker_fields: string[];
  required_documents_total: number;
  required_documents_approved: number;
  document_validation: CandidateDocumentValidationSummary;
  documents: CandidateDocumentRow[];
};

function formatRpcError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}) {
  return [error.message, error.details, error.hint, error.code ? `Codigo: ${error.code}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export async function fetchCandidateChecklist(caseCandidateId: string) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no esta configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_candidate_checklist", {
    p_case_candidate_id: caseCandidateId
  });

  if (error) {
    return {
      data: null,
      error: formatRpcError(error) || "No fue posible cargar el checklist documental."
    };
  }

  return {
    data: data as CandidateChecklistResult,
    error: null
  };
}

export async function uploadCandidateDocument(input: {
  caseCandidateId: string;
  documentTypeId: string;
  filePath: string;
  expiryDate?: string | null;
}) {
  if (!supabase) {
    return { error: "Supabase no esta configurado." };
  }

  const { error } = await supabase.rpc("upload_candidate_document", {
    p_case_candidate_id: input.caseCandidateId,
    p_document_type_id: input.documentTypeId,
    p_file_path: input.filePath,
    p_expiry_date: input.expiryDate || null
  });

  if (error) {
    return { error: formatRpcError(error) || "No fue posible guardar el documento." };
  }

  return { error: null };
}

export async function reviewCandidateDocument(input: {
  documentId: string;
  status: "approved" | "rejected";
  notes?: string;
}) {
  if (!supabase) {
    return { error: "Supabase no esta configurado." };
  }

  const { error } = await supabase.rpc("review_candidate_document", {
    p_document_id: input.documentId,
    p_status: input.status,
    p_notes: input.notes?.trim() ? input.notes.trim() : null
  });

  if (error) {
    return { error: formatRpcError(error) || "No fue posible revisar el documento." };
  }

  return { error: null };
}

export async function approveCandidateDocumentation(input: {
  caseCandidateId: string;
  comment?: string;
}) {
  if (!supabase) {
    return { error: "Supabase no esta configurado." };
  }

  const { error } = await supabase.rpc("approve_candidate_documentation", {
    p_case_candidate_id: input.caseCandidateId,
    p_comment: input.comment?.trim() ? input.comment.trim() : null
  });

  if (error) {
    return {
      error:
        formatRpcError(error) ||
        "No fue posible aprobar la revision documental del candidato."
    };
  }

  return { error: null };
}
