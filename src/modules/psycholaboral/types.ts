export type PsychInstrumentCatalog = {
  code: string;
  name: string;
  short_name: string;
  question_count: number;
  content_version: string;
};
export type PsychInstrumentProgress = {
  code: string;
  name: string;
  status: string;
  answered: number;
  total: number;
};
export type PsychCandidate = {
  id: string;
  full_name: string;
  national_id: string;
  email: string | null;
  case_code: string;
  folio: number | string;
  contract_name: string;
  job_position_name: string;
  stage_code: string;
  assessment_id: string | null;
  display_status: "not_sent" | "sent" | "expired" | "completed" | "approved";
  delivery_status: string | null;
  execution_status: string | null;
  decision: "pending" | "approved" | "rejected" | null;
  issued_at: string | null;
  started_at: string | null;
  deadline_at: string | null;
  completed_at: string | null;
  certificate_status: string | null;
  report_status?: string | null;
  ai_status?: PsychAIStatus | null;
  ai_updated_at?: string | null;
  ai_interpretation_id?: string | null;
  ai_interpretation_status?: PsychAIStatus | null;
  instruments: PsychInstrumentProgress[];
};
export type PsychQuestion = { order: number; text: string };
export type PsychOption = { value: number; label: string };
export type CandidateInstrument = {
  code: string;
  name: string;
  short_name: string;
  instructions: string;
  options: PsychOption[];
  questions: PsychQuestion[];
  status: string;
  responses: Record<string, number>;
  revision: number;
};
export type Consent = {
  code: string;
  version: string;
  title: string;
  body: string;
  document_sha256: string;
  accepted: boolean;
};
export type CandidateSession = {
  assessment_id: string;
  public_id: string;
  deadline_at: string;
  execution_status: string;
  consents_accepted: boolean;
  consents: Consent[];
  instruments: CandidateInstrument[];
  candidate: {
    full_name: string;
    national_id: string;
    job_position_name: string;
    contract_name: string;
  };
};
export type PsychResultInstrument = {
  code: string;
  name: string;
  result: Record<string, unknown>;
  response_count: number;
  response_distribution: Record<string, number>;
  quality?: Record<string, unknown>;
};
export type PsychResultDetail = {
  assessment_id: string;
  candidate: {
    full_name: string;
    national_id: string;
    job_position_name: string;
    contract_name: string;
  };
  execution_status: string;
  decision: string;
  completed_at: string;
  certificate_status: string;
  certificate_available: boolean;
  ai_status?: PsychAIStatus;
  ai_interpretation?: PsychAIInterpretationSummary | null;
  instruments: PsychResultInstrument[];
};

export type PsychAIStatus =
  | "NOT_REQUESTED"
  | "QUEUED"
  | "PROCESSING"
  | "AI_DRAFT"
  | "FAILED"
  | "PENDING_REVIEW"
  | "REVIEWED"
  | "VALIDATED"
  | "OBSERVED";

export type PsychAIOutput = {
  version: string;
  recommendation?: "ADECUADO" | "ADECUADO_CON_OBSERVACIONES" | "NO_ADECUADO";
  recommendation_confidence?: "BAJA" | "MEDIA" | "ALTA";
  critical_strengths?: string[];
  critical_gaps?: string[];
  critical_uncertainties?: string[];
  decision_rationale?: string;
  profile_summary?: string;
  executive_profile?: string;
  executive_summary: string;
  response_quality: string;
  strengths: string[];
  points_to_explore?: Array<{
    title?: string;
    text?: string;
    evidence_ids: string[];
  }>;
  development_areas: string[];
  interview_questions: string[];
  instrument_analysis?: {
    ipip16: string;
    ipip_ipc: string;
    bis11: string;
    prp: string;
  };
  ipip16: { summary: string; clusters: Record<string, string> };
  ipc: { summary: string; predominant_profile: string; disc_disclaimer: string };
  bis11: { summary: string; impulsivity_interpretation: string };
  prp: { summary: string; documentation_status: string };
  personality_profile?: {
    summary: string;
    self_regulation: string;
    discipline_structure: string;
    interpersonal_style: string;
    adaptability_thinking: string;
  };
  interpersonal_profile?: {
    summary: string;
    communication: string;
    cooperation: string;
    initiative: string;
    response_under_pressure: string;
  };
  safety_and_impulse_profile?: {
    summary: string;
    bis11: string;
    prp: string;
    combined_interpretation: string;
  };
  job_fit_analysis?: string;
  integrated_conclusion?: string;
  material_limitations?: string[];
  integrated_analysis: string;
  preliminary_conclusion: string;
  recommendations?: string[];
  limitations: string[];
  evidence: string[];
};

export type PsychAIInterpretationSummary = {
  id: string;
  status: PsychAIStatus;
  provider: string;
  model: string;
  display_output: PsychAIOutput | null;
  error_message?: string | null;
  validation_flags: string[];
  guardrail_flags: string[];
  reviewer_comment: string | null;
  reviewed_at: string | null;
  generated_at: string | null;
};

export type PsychAIRun = {
  id: string;
  status: string;
  attempt: number;
  latency_ms: number | null;
  prompt_tokens: number | null;
  cached_prompt_tokens?: number | null;
  completion_tokens: number | null;
  reasoning_tokens?: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  api_call_count?: number | null;
  retry_count?: number | null;
  reviewer_executed?: boolean | null;
  reviewer_reason?: string | null;
  analyst?: {
    input_tokens: number | null;
    cached_input_tokens: number | null;
    output_tokens: number | null;
    reasoning_tokens: number | null;
    total_tokens: number | null;
  } | null;
  reviewer?: {
    executed: boolean | null;
    reason: string | null;
    input_tokens: number | null;
    cached_input_tokens: number | null;
    output_tokens: number | null;
    reasoning_tokens: number | null;
    total_tokens: number | null;
  } | null;
  error_code: string | null;
  created_at: string | null;
};

export type PsychAIReviewDetail = {
  assessment_id: string;
  ai_status: PsychAIStatus;
  candidate: {
    full_name: string;
    national_id: string;
    job_position_name: string;
    contract_name: string;
  };
  interpretation: (PsychAIInterpretationSummary & {
    input_hash: string;
    original_output: PsychAIOutput | null;
    reviewed_output: PsychAIOutput | null;
    profile: { code: string; label: string; version: string } | null;
    prompt: { version: string; schema_version: string; content_sha256: string } | null;
    runs: PsychAIRun[];
  }) | null;
};
