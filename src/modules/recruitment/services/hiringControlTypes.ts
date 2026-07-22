export type RecruitmentCaseStatus =
  | "open"
  | "sourcing"
  | "screening"
  | "ready_to_hire"
  | "partially_filled"
  | "filled"
  | "closed_unfilled"
  | "cancelled";

export type RecruitmentProcessStatusFilter =
  | null
  | "open"
  | "screening"
  | "ready_to_hire"
  | "filled"
  | "cancelled";

export type RecruitmentCandidateStage =
  | "lead"
  | "who_pending"
  | "who_approved"
  | "in_process"
  | "medical_exams"
  | "document_review"
  | "ready_for_hire"
  | "hired"
  | "rejected"
  | "withdrawn";

export type WhoCauseType = "laboral" | "penal" | "civil";

export type WhoApprovalCause = {
  type: WhoCauseType;
  year: number;
  comment: string;
};

export type RecruitmentDashboardSummary = {
  pending_contracts_control: number;
  pending_approval_count?: number;
  active_cases: number;
  ready_to_hire_cases: number;
  filled_cases: number;
  total_cases: number;
  candidates_in_progress?: number;
};

export type HiringControlApproval = {
  id: number;
  step_code: "contracts_control" | "area_manager";
  step_name: string;
  hiring_request_id: string;
  approver_user_id: string | null;
  approver_name: string | null;
  approver_email: string | null;
  created_at: string;
  hiring_requests: {
    folio: string | null;
    status: string;
    requester_name: string | null;
    requester_email: string | null;
    contract_name: string;
    contract_number: string | null;
    job_position_name: string;
    vacancies: number | null;
    requested_entry_date: string | null;
    start_date: string | null;
    end_date: string | null;
    shift_name: string | null;
    salary_offer: number | null;
    campamento: boolean | null;
    pasajes: boolean | null;
    travel_methodology?: string | null;
    other_benefits: string | null;
  } | null;
};

export type RecruitmentCaseListRow = {
  id: string;
  source_type?: "case" | "request";
  hiring_request_id?: string;
  folio?: string | null;
  case_code: string;
  status: RecruitmentCaseStatus;
  requested_vacancies: number;
  filled_vacancies: number;
  title: string;
  contract_name: string;
  job_position_name: string;
  hiring_request_status?: string;
  can_close_request?: boolean;
  cost_center_code: string;
  cost_center_name: string;
  requested_entry_date: string | null;
  target_close_date: string | null;
  opened_at: string;
  requester_name: string | null;
  requester_email: string | null;
  owner_name: string | null;
  owner_user_id: string | null;
  candidate_count: number;
  ready_candidates: number;
  hired_candidates: number;
  mobility_active_count?: number;
  mobility_approved_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  shift_name?: string | null;
  turno?: string | null;
  salary_offer?: number | null;
  salary?: number | null;
  campamento?: boolean | null;
  pasajes?: boolean | null;
  travel_methodology?: string | null;
  other_benefits?: string | null;
  approval_summary?: {
    step_name: string | null;
    status: string | null;
    decision_comment: string | null;
    decided_at: string | null;
    decided_by_name: string | null;
  } | null;
};

export type RecruitmentProcessesPageSummary = {
  activeCases: number;
  requestedVacancies: number;
  inProgressCandidates: number;
  readyToHireCases: number;
  filledCases: number;
  hiredCandidates: number;
};

export type RecruitmentCaseHeadcountBreakdown = {
  activeCandidates: number;
  hiredCandidates: number;
  internalMobility: number;
};

type RecruitmentCaseHeadcountSource = Pick<
  RecruitmentCaseListRow,
  "candidate_count" | "hired_candidates" | "mobility_active_count" | "mobility_approved_count"
>;

export function getRecruitmentCaseHeadcountBreakdown(
  source: RecruitmentCaseHeadcountSource
): RecruitmentCaseHeadcountBreakdown {
  const pendingMobility = Math.max(source.mobility_active_count ?? 0, 0);
  const approvedMobility = Math.max(source.mobility_approved_count ?? 0, 0);

  return {
    activeCandidates: Math.max((source.candidate_count ?? 0) - pendingMobility, 0),
    hiredCandidates: Math.max((source.hired_candidates ?? 0) - approvedMobility, 0),
    internalMobility: pendingMobility + approvedMobility
  };
}

export type RecruitmentCandidateControlRow = {
  id: string;
  candidate_profile_id: string;
  recruitment_case_id: string;
  case_code: string;
  folio: string | null;
  case_status: RecruitmentCaseStatus;
  national_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  driver_license_number: string | null;
  driver_license_class: string | null;
  driver_license_expiry: string | null;
  stage_code: RecruitmentCandidateStage;
  stage_entered_at: string;
  suitability_status: "unknown" | "fit" | "risk" | "blocked";
  is_selected: boolean;
  contract_name: string;
  job_position_name: string;
  cost_center_code: string;
  cost_center_name: string;
  owner_name: string | null;
  active_process_count: number;
  contract_locked_case_id: string | null;
  contract_locked_case_code: string | null;
  contract_locked_folio: string | null;
  contract_locked_stage_code: RecruitmentCandidateStage | null;
  is_contract_path_blocked: boolean;
  interview_notes: string | null;
  hired_at?: string | null;
  buk_generated_at?: string | null;
  buk_employee_id?: string | null;
  has_buk_generation_success?: boolean;
};

export type RecruitmentPersonnelToHireRow = RecruitmentCandidateControlRow;

export type RecruitmentCaseAssignment = {
  id: number;
  user_id: string;
  assignment_role: "owner" | "recruiter" | "document_controller" | "viewer";
  is_primary: boolean;
  assigned_at: string;
  full_name: string | null;
  email: string | null;
};

export type RecruitmentCaseCandidateHistoryRow = {
  id: number;
  from_stage: RecruitmentCandidateStage | null;
  to_stage: RecruitmentCandidateStage;
  changed_by: string;
  reason_code: string | null;
  comment: string | null;
  created_at: string;
};

export type CandidateWhoApprovalSummary = {
  id: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_by: string;
  requested_by_name: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  comment: string | null;
  causes?: WhoApprovalCause[] | null;
};

export type CandidateWorkerFile = {
  id: string;
  project_name: string | null;
  company_entry_date: string | null;
  shift_name: string | null;
  advance_amount: number | null;
  contract_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CandidateDocumentValidationSummary = {
  status: "pending" | "approved";
  validated_by: string | null;
  validated_by_name: string | null;
  validated_at: string | null;
  comment: string | null;
};

export type CandidateBukProfileDetails = {
  case_candidate_id: string;
  candidate_profile_id: string;
  suggested_employee_code?: string | null;
  document_type: string | null;
  document_number: string;
  first_name: string | null;
  last_name: string | null;
  second_last_name: string | null;
  full_name: string;
  gender: string | null;
  birth_date: string | null;
  nationality: string | null;
  marital_status: string | null;
  email: string | null;
  personal_email: string | null;
  phone: string | null;
  office_phone: string | null;
  country: string | null;
  address_line: string | null;
  region: string | null;
  district_or_commune: string | null;
  current_city: string | null;
  street_name: string | null;
  street_number: string | null;
  apartment_or_office: string | null;
  education_title: string | null;
  education_institution: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  disability_status: string | null;
  disability_notice_date: string | null;
  invalidity_status: string | null;
  invalidity_notice_date: string | null;
  inclusion_notes: string | null;
  labor_inclusion: string | null;
  firefighter_status: string | null;
  foreign_worker: string | null;
  shirt_size: string | null;
  pants_size: string | null;
  shoe_size: string | null;
  worker_file: {
    id: string | null;
    employee_code: string | null;
    project_name: string | null;
    company_entry_date: string | null;
    shift_name: string | null;
    advance_amount: number | null;
    contract_notes: string | null;
    private_role: string | null;
    afc_start_date: string | null;
    seniority_recognition_date: string | null;
    progressive_vacation_start_date: string | null;
    payment_method: string | null;
    payment_period: string | null;
    bank_name: string | null;
    bank_account_type: string | null;
    bank_account_number: string | null;
    bank_branch_code: string | null;
    vale_vista_type: string | null;
    pension_regime: string | null;
    contribution_fund: string | null;
    afp_collection_entity: string | null;
    increase_quote_one_percent: string | null;
    health_provider: string | null;
    health_plan_uf: number | null;
    health_plan_pesos: number | null;
    health_plan_percentage: number | null;
    afc_regime: string | null;
    retired_status: string | null;
    retirement_regime: string | null;
    account_two_fund: string | null;
    account_two_plan: string | null;
    currency: string | null;
    simple_load_count: number | null;
    maternal_load_count: number | null;
    invalid_load_count: number | null;
    family_allowance_section: string | null;
    personal_data_update_date: string | null;
  };
};

export type RecruitmentCaseCandidateRow = {
  id: string;
  candidate_profile_id: string;
  national_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  nationality: string | null;
  marital_status: string | null;
  address_line: string | null;
  district_or_commune: string | null;
  current_city: string | null;
  region: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  inclusion_notes: string | null;
  firefighter_status: string | null;
  shirt_size: string | null;
  pants_size: string | null;
  shoe_size: string | null;
  bank_name: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  afp_name: string | null;
  health_provider: string | null;
  driver_license_number: string | null;
  driver_license_class: string | null;
  driver_license_expiry: string | null;
  stage_code: RecruitmentCandidateStage;
  stage_entered_at: string;
  suitability_status: "unknown" | "fit" | "risk" | "blocked";
  is_selected: boolean;
  hired_at: string | null;
  created_at: string;
  stage_history: RecruitmentCaseCandidateHistoryRow[];
  interview_notes: string | null;
  worker_file?: CandidateWorkerFile | null;
  who_approval?: CandidateWhoApprovalSummary | null;
  document_validation_status?: "pending" | "approved" | null;
  document_validated_by?: string | null;
  document_validated_by_name?: string | null;
  document_validated_at?: string | null;
  document_validation_comment?: string | null;
};

export type RecruitmentCaseAuditRow = {
  id: number;
  action_type: string;
  actor_user_id: string;
  actor_name: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type RecruitmentCaseDetail = {
  case: {
    id: string;
    case_code: string;
    status: RecruitmentCaseStatus;
    requested_vacancies: number;
    filled_vacancies: number;
    title: string;
    contract_name: string;
    job_position_name: string;
    cost_center_code: string;
    cost_center_name: string;
    requested_entry_date: string | null;
    target_close_date: string | null;
    opened_at: string;
    close_reason: string | null;
    hiring_request: {
      id: string;
      folio: string | null;
      requester_name: string | null;
      requester_email: string | null;
      start_date: string | null;
      end_date: string | null;
      shift_name: string | null;
      salary_offer: number | null;
      campamento: boolean | null;
      pasajes: boolean | null;
      travel_methodology?: string | null;
      other_benefits: string | null;
      approval_summary?: {
        step_name: string | null;
        status: string | null;
        decision_comment: string | null;
        decided_at: string | null;
        decided_by_name: string | null;
      } | null;
    };
  };
  assignments: RecruitmentCaseAssignment[];
  candidates: RecruitmentCaseCandidateRow[];
  audit: RecruitmentCaseAuditRow[];
};

export type RecruitmentPagedResponse<T, S = null> = {
  items: T[];
  totalCount: number;
  summary: S | null;
};
