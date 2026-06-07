begin;

create or replace function public.get_dashboard_home_bundle(
  p_birthdays_limit integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  control_payload jsonb := '{}'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  control_payload := coalesce(public.get_recruitment_control_dashboard_v2()::jsonb, '{}'::jsonb);

  return jsonb_build_object(
    'tasks_data',
    coalesce(public.get_dashboard_tasks(current_user_id)::jsonb, '[]'::jsonb),
    'approval_tracking_data',
    coalesce(public.get_dashboard_approval_tracking()::jsonb, '[]'::jsonb),
    'active_folios_data',
    coalesce(control_payload -> 'active_cases', '[]'::jsonb),
    'birthdays_data',
    coalesce((
      select jsonb_agg(to_jsonb(b) order by b.days_until asc, b.full_name asc)
      from public.get_upcoming_birthdays(greatest(coalesce(p_birthdays_limit, 6), 1)) b
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_dashboard_home_bundle(integer) from public, anon;
grant execute on function public.get_dashboard_home_bundle(integer) to authenticated;

alter function public.get_hr_incentive_union_status(jsonb) set search_path = public;
alter function public.get_hr_incentive_union_status_label(text) set search_path = public;
alter function public.get_hr_incentive_union_name(jsonb) set search_path = public;

revoke all on function public.advance_recruitment_candidate_stage(uuid, text, text) from public, anon;
grant execute on function public.advance_recruitment_candidate_stage(uuid, text, text) to authenticated;

revoke all on function public.reject_candidate_stage_who(uuid, text) from public, anon;
grant execute on function public.reject_candidate_stage_who(uuid, text) to authenticated;

revoke all on function public.find_candidate_profile_with_history_by_rut(text) from public, anon;
grant execute on function public.find_candidate_profile_with_history_by_rut(text) to authenticated;

create index if not exists idx_candidate_documents_candidate_profile_id
  on public.candidate_documents(candidate_profile_id);

create index if not exists idx_candidate_documents_document_type_id
  on public.candidate_documents(document_type_id);

create index if not exists idx_candidate_documents_uploaded_by
  on public.candidate_documents(uploaded_by);

create index if not exists idx_candidate_documents_reviewed_by
  on public.candidate_documents(reviewed_by);

create index if not exists idx_candidate_stage_approvals_requested_by
  on public.candidate_stage_approvals(requested_by);

create index if not exists idx_candidate_stage_approvals_approved_by
  on public.candidate_stage_approvals(approved_by);

create index if not exists idx_hiring_request_approvals_decision_by
  on public.hiring_request_approvals(decision_by);

create index if not exists idx_hiring_requests_contract_id
  on public.hiring_requests(contract_id);

create index if not exists idx_hiring_requests_job_position_id
  on public.hiring_requests(job_position_id);

create index if not exists idx_hiring_requests_shift_id
  on public.hiring_requests(shift_id);

create index if not exists idx_hiring_requests_submitted_by
  on public.hiring_requests(submitted_by);

create index if not exists idx_hr_incentive_request_history_request_id
  on public.hr_incentive_request_history(incentive_request_id);

create index if not exists idx_hr_incentive_requests_incentive_type_id
  on public.hr_incentive_requests(incentive_type_id);

create index if not exists idx_hr_incentive_requests_rate_rule_id
  on public.hr_incentive_requests(rate_rule_id);

create index if not exists idx_recruitment_case_assignments_assigned_by
  on public.recruitment_case_assignments(assigned_by);

create index if not exists idx_recruitment_case_audit_log_actor_user_id
  on public.recruitment_case_audit_log(actor_user_id);

create index if not exists idx_recruitment_case_audit_log_case_candidate_id
  on public.recruitment_case_audit_log(recruitment_case_candidate_id);

create index if not exists idx_recruitment_case_candidate_stage_history_changed_by
  on public.recruitment_case_candidate_stage_history(changed_by);

create index if not exists idx_recruitment_case_candidates_created_by
  on public.recruitment_case_candidates(created_by);

create index if not exists idx_recruitment_cases_contract_id
  on public.recruitment_cases(contract_id);

create index if not exists idx_recruitment_cases_job_position_id
  on public.recruitment_cases(job_position_id);

create index if not exists idx_recruitment_cases_created_by
  on public.recruitment_cases(created_by);

create index if not exists idx_recruitment_cases_opened_by
  on public.recruitment_cases(opened_by);

create index if not exists idx_recruitment_cases_closed_by
  on public.recruitment_cases(closed_by);

notify pgrst, 'reload schema';

commit;
