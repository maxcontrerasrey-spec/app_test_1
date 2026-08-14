export type JsonRecord = Record<string, unknown>;

export type PsychAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
};

export type PsychAIResult = {
  output: PsychAIOutput;
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
