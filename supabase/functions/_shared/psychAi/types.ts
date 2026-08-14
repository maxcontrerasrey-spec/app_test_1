export type JsonRecord = Record<string, unknown>;

export type PsychAIUsage = {
  prompt_tokens?: number;
  cached_prompt_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
};

export type PsychAIResult = {
  output: unknown;
  provider: string;
  model: string;
  latency_ms: number;
  usage: PsychAIUsage;
  raw_finish_reason?: string;
};

export type PsychInterpretationProvider = {
  name: string;
  model: string;
  interpret(input: PsychAIPromptInput): Promise<PsychAIResult>;
};

export type PsychAIPromptInput = {
  payload: JsonRecord;
  systemPrompt: string;
  responseSchema: JsonRecord;
  responseSchemaName?: string;
};

export type PsychAICallTelemetry = {
  executed: boolean;
  reason?: string;
  attempt?: number;
  latency_ms?: number;
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
  status?: string;
};

export type EvidenceBackedAIStatement = {
  title?: string;
  text?: string;
  question?: string;
  target?: string;
  evidence_ids: string[];
};

export type PsychAIOutput = {
  version: string;
  profile_summary?: string;
  executive_profile?: string;
  executive_summary: string;
  response_quality: string;
  strengths: string[];
  points_to_explore?: EvidenceBackedAIStatement[];
  development_areas: string[];
  interview_questions: string[];
  instrument_analysis?: {
    ipip16: string;
    ipip_ipc: string;
    bis11: string;
    prp: string;
  };
  ipip16: {
    summary: string;
    clusters: Record<string, string>;
  };
  ipc: {
    summary: string;
    predominant_profile: string;
    disc_disclaimer: string;
  };
  bis11: {
    summary: string;
    impulsivity_interpretation: string;
  };
  prp: {
    summary: string;
    documentation_status: string;
  };
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

export type GuardrailResult = {
  output: PsychAIOutput;
  validationFlags: string[];
  guardrailFlags: string[];
};
