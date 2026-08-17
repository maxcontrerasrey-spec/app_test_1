import {
  asRecord,
  getSupabaseClientOrThrow as getSupabaseClient,
  getSupabaseErrorMessage,
  readNullableText,
  readText
} from "../../../shared/lib/supabaseRpc";
import type { CompetencyLegalApproval } from "../types";

function mapLegalApproval(item: unknown): CompetencyLegalApproval {
  const source = asRecord(item);
  return {
    certificateId: readText(source.certificate_id),
    requestId: readText(source.request_id),
    folio: readText(source.folio),
    workerFullName: readText(source.worker_full_name),
    workerDocumentNumber: readText(source.worker_document_number),
    workerJobTitle: readNullableText(source.worker_job_title),
    workerAreaName: readNullableText(source.worker_area_name),
    workerContractCode: readNullableText(source.worker_contract_code),
    instructorFullName: readText(source.instructor_full_name),
    trainingDate: readText(source.training_date),
    legalApprovalStatus: readText(source.legal_approval_status),
    legalSignerName: readText(source.legal_signer_name),
    legalSignerRole: readText(source.legal_signer_role),
    legalSignerDocumentNumber: readNullableText(source.legal_signer_document_number),
    createdAt: readText(source.created_at)
  };
}

export async function fetchCompetencyLegalApprovalQueue() {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_competency_legal_approval_queue");
  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar las aprobaciones legales.", "message"));
  }
  return Array.isArray(data) ? data.map(mapLegalApproval) : [];
}

export async function decideCompetencyLegalApproval(
  certificateId: string,
  decision: "approved" | "rejected",
  rejectionReason?: string
) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("decide_competency_legal_approval", {
    certificate_id_input: certificateId,
    decision_input: decision,
    rejection_reason_input: rejectionReason ?? null
  });
  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible resolver la aprobacion legal.", "message"));
  }
}
