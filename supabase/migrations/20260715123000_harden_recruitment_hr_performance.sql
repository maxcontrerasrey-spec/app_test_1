-- Enterprise hardening for recruitment and HR operational paths.
-- Addresses live Supabase advisor findings without changing business logic.

create index if not exists idx_accreditation_audit_log_actor_id
  on public.accreditation_audit_log(actor_id);
create index if not exists idx_accreditation_audit_log_worker_accreditation_id
  on public.accreditation_audit_log(worker_accreditation_id);
create index if not exists idx_accreditation_audit_log_worker_document_tracking_id
  on public.accreditation_audit_log(worker_document_tracking_id);

create index if not exists idx_accreditation_matrix_created_by
  on public.accreditation_matrix(created_by);
create index if not exists idx_accreditation_matrix_site_id
  on public.accreditation_matrix(site_id);
create index if not exists idx_accreditation_requirements_created_by
  on public.accreditation_requirements(created_by);
create index if not exists idx_accreditation_sites_created_by
  on public.accreditation_sites(created_by);

create index if not exists idx_buk_sync_jobs_recruitment_case_candidate_id
  on public.buk_sync_jobs(recruitment_case_candidate_id);
create index if not exists idx_buk_sync_jobs_requested_by
  on public.buk_sync_jobs(requested_by);

create index if not exists idx_candidate_document_cleanup_jobs_case_candidate_id
  on public.candidate_document_cleanup_jobs(recruitment_case_candidate_id);
create index if not exists idx_candidate_document_cleanup_jobs_case_id
  on public.candidate_document_cleanup_jobs(recruitment_case_id);
create index if not exists idx_candidate_document_cleanup_jobs_profile_id
  on public.candidate_document_cleanup_jobs(candidate_profile_id);
create index if not exists idx_candidate_document_cleanup_jobs_requested_by
  on public.candidate_document_cleanup_jobs(requested_by);

create index if not exists idx_hr_incentive_requests_area_manager_user_id
  on public.hr_incentive_requests(area_manager_user_id);
create index if not exists idx_hr_incentive_requests_incentive_type_id
  on public.hr_incentive_requests(incentive_type_id);
create index if not exists idx_hr_incentive_requests_rate_rule_id
  on public.hr_incentive_requests(rate_rule_id);

create index if not exists idx_internal_mobility_request_approvals_request_id
  on public.internal_mobility_request_approvals(internal_mobility_request_id);
create index if not exists idx_internal_mobility_request_approvals_approver_user_id
  on public.internal_mobility_request_approvals(approver_user_id);
create index if not exists idx_internal_mobility_request_approvals_decision_by
  on public.internal_mobility_request_approvals(decision_by);

create index if not exists idx_internal_mobility_request_audit_log_request_id
  on public.internal_mobility_request_audit_log(internal_mobility_request_id);
create index if not exists idx_internal_mobility_request_audit_log_actor_user_id
  on public.internal_mobility_request_audit_log(actor_user_id);
create index if not exists idx_internal_mobility_request_audit_log_approval_id
  on public.internal_mobility_request_audit_log(approval_id);

create index if not exists idx_internal_mobility_request_snapshots_request_id
  on public.internal_mobility_request_snapshots(internal_mobility_request_id);
create index if not exists idx_internal_mobility_request_snapshots_created_by
  on public.internal_mobility_request_snapshots(created_by);

create index if not exists idx_internal_mobility_requests_destination_contract_id
  on public.internal_mobility_requests(destination_contract_id);
create index if not exists idx_internal_mobility_requests_recruitment_case_id
  on public.internal_mobility_requests(recruitment_case_id);
create index if not exists idx_internal_mobility_requests_requester_id
  on public.internal_mobility_requests(requester_id);
create index if not exists idx_internal_mobility_requests_hr_execution_executed_by
  on public.internal_mobility_requests(hr_execution_executed_by);
create index if not exists idx_internal_mobility_requests_hr_execution_updated_by
  on public.internal_mobility_requests(hr_execution_updated_by);

create index if not exists idx_recruitment_case_candidates_created_by
  on public.recruitment_case_candidates(created_by);
create index if not exists idx_recruitment_case_candidates_document_validated_by
  on public.recruitment_case_candidates(document_validated_by);

drop index if exists public.idx_recruitment_candidates_case_stage;

alter function public.build_hr_incentive_request_search_text(text, text, text, text, text, text, text, text)
  set search_path = public;
alter function public.extract_hr_incentive_numeric_value(text)
  set search_path = public;
alter function public.extract_hr_incentive_worker_base_salary(jsonb)
  set search_path = public;
alter function public.extract_hr_incentive_worker_weekly_hours(jsonb)
  set search_path = public;

alter function public.extract_buk_employee_hire_date(jsonb)
  set search_path = public;
alter function public.extract_buk_employee_city_name(jsonb)
  set search_path = public;
alter function public.extract_buk_employee_region_name(jsonb)
  set search_path = public;

alter function public.resolve_candidate_buk_health_plan_uf(text, numeric)
  set search_path = public;
alter function public.resolve_candidate_buk_health_plan_percentage(text, numeric)
  set search_path = public;
alter function public.is_affirmative_buk_value(text)
  set search_path = public;
alter function public.is_fonasa_buk_health_provider(text)
  set search_path = public;
alter function public.worker_health_provider_requires_plan(text)
  set search_path = public;
alter function public.is_effective_buk_generation_success(text, text, jsonb)
  set search_path = public;

notify pgrst, 'reload schema';
