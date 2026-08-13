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
  display_status: "not_sent" | "sent" | "completed";
  delivery_status: string | null;
  execution_status: string | null;
  decision: "pending" | "approved" | "rejected" | null;
  issued_at: string | null;
  started_at: string | null;
  deadline_at: string | null;
  completed_at: string | null;
  certificate_status: string | null;
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
  instruments: PsychResultInstrument[];
};
