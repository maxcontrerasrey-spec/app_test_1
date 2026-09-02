import {
  getSupabaseClientOrThrow,
  getSupabaseErrorMessage,
} from "../../../shared/lib/supabaseRpc";
import type {
  CandidateSession,
  PsychAIOutput,
  PsychAIReviewDetail,
  PsychCandidate,
  PsychInstrumentCatalog,
  PsychResultDetail,
} from "../types";

const FUNCTION = "psycholaboral-assessment";
async function readFunctionError(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return "";
  try {
    const payload = (await context.clone().json()) as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : "";
  } catch {
    return "";
  }
}
async function invoke(body: Record<string, unknown>) {
  const client = getSupabaseClientOrThrow();
  const { data, error } = await client.functions.invoke(FUNCTION, { body });
  if (error) {
    const functionMessage = await readFunctionError(error);
    throw new Error(
      functionMessage ||
        getSupabaseErrorMessage(error, "No fue posible procesar la solicitud."),
    );
  }
  if (data?.error) throw new Error(String(data.error));
  return data as Record<string, unknown>;
}
export async function fetchPsychCatalog() {
  const { data, error } = await getSupabaseClientOrThrow().rpc(
    "get_psycholaboral_catalog",
  );
  if (error)
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar los test."),
    );
  return (data ?? []) as PsychInstrumentCatalog[];
}
export async function fetchPsychCandidates(filters: {
  search: string;
  status: string;
  limit: number;
  offset: number;
}) {
  const { error: expirationError } = await getSupabaseClientOrThrow().rpc(
    "expire_abandoned_psycholaboral_assessments",
  );
  if (expirationError)
    throw new Error(
      getSupabaseErrorMessage(expirationError, "No fue posible actualizar los vencimientos."),
    );
  const { data, error } = await getSupabaseClientOrThrow().rpc(
    "get_psycholaboral_candidates_page",
    {
      p_search: filters.search || null,
      p_status: filters.status || null,
      p_limit: filters.limit,
      p_offset: filters.offset,
    },
  );
  if (error)
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar candidatos."),
    );
  return data as { items: PsychCandidate[]; total_count: number };
}
export async function sendPsychBattery(
  caseCandidateId: string,
  codes: string[],
) {
  return invoke({
    action: "send",
    case_candidate_id: caseCandidateId,
    instrument_codes: codes,
    idempotency_key: crypto.randomUUID(),
  });
}
export async function decidePsychAssessment(
  assessmentId: string,
  decision: "approved" | "rejected",
  comment?: string,
) {
  const { data, error } = await getSupabaseClientOrThrow().rpc(
    "decide_psycholaboral_assessment",
    {
      p_assessment_id: assessmentId,
      p_decision: decision,
      p_comment: comment ?? null,
    },
  );
  if (error)
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible registrar la decisión."),
    );
  return data;
}
export async function getPsychResult(assessmentId: string) {
  const { data, error } = await getSupabaseClientOrThrow().rpc(
    "get_psycholaboral_result_detail",
    { p_assessment_id: assessmentId },
  );
  if (error)
    throw new Error(
      getSupabaseErrorMessage(error, "No fue posible cargar el resultado."),
    );
  return data as PsychResultDetail;
}
export async function getPsychCertificateUrl(assessmentId: string) {
  const data = await invoke({
    action: "certificate_url",
    assessment_id: assessmentId,
  });
  return String(data.signed_url);
}
export async function getPsychReportUrl(assessmentId: string) {
  const data = await invoke({
    action: "report_url",
    assessment_id: assessmentId,
  });
  return String(data.signed_url);
}
export async function generatePsychCertificate(assessmentId: string) {
  return invoke({
    action: "generate_certificate",
    assessment_id: assessmentId,
  });
}
export async function generatePsychAIInterpretation(assessmentId: string) {
  return invoke({
    action: "generate_ai_interpretation",
    assessment_id: assessmentId,
  }) as Promise<{
    generated?: boolean;
    cached?: boolean;
    live_configured?: boolean;
    fallback_reason?: string;
  }>;
}
export async function getPsychAIReviewDetail(assessmentId: string) {
  const data = await invoke({
    action: "get_ai_interpretation",
    assessment_id: assessmentId,
  });
  return data.detail as PsychAIReviewDetail;
}
export async function reviewPsychAIInterpretation(input: {
  assessmentId: string;
  interpretationId: string;
  action: "save_review" | "validate" | "observe";
  reviewedOutput?: PsychAIOutput | null;
  comment?: string;
}) {
  const data = await invoke({
    action: "review_ai_interpretation",
    assessment_id: input.assessmentId,
    interpretation_id: input.interpretationId,
    review_action: input.action,
    reviewed_output: input.reviewedOutput ?? null,
    comment: input.comment ?? null,
  });
  return data.detail as PsychAIReviewDetail;
}
export async function redeemPsychInvite(
  publicId: string,
  rut: string,
  accessCode: string,
) {
  const data = await invoke({
    action: "redeem",
    public_id: publicId,
    rut,
    access_code: accessCode,
  });
  return data as unknown as {
    session_token: string;
    session: CandidateSession;
  };
}
export async function resumePsychSession(token: string) {
  const data = await invoke({ action: "resume", session_token: token });
  return data.session as CandidateSession;
}
export async function acceptPsychConsents(
  token: string,
  consents: CandidateSession["consents"],
) {
  const data = await invoke({
    action: "accept_consents",
    session_token: token,
    consents: consents.map(({ code, version, document_sha256 }) => ({
      code,
      version,
      document_sha256,
      accepted: true,
    })),
  });
  return data.session as CandidateSession;
}
export async function savePsychResponses(
  token: string,
  code: string,
  responses: Record<string, number>,
  revision: number,
) {
  return invoke({
    action: "save",
    session_token: token,
    instrument_code: code,
    responses,
    expected_revision: revision,
  }) as Promise<{ revision: number; saved: boolean }>;
}
export async function submitPsychInstrument(
  token: string,
  code: string,
  responses: Record<string, number>,
) {
  const data = await invoke({
    action: "submit",
    session_token: token,
    instrument_code: code,
    responses,
  });
  return data.session as CandidateSession;
}
