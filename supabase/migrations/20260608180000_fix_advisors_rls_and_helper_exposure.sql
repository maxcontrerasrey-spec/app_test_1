begin;

alter function public.normalize_buk_area_name(text) set search_path = public;

revoke execute on function public.assert_candidate_control_access(uuid) from authenticated;
revoke execute on function public.user_can_access_candidate_control(uuid) from authenticated;
revoke execute on function public.user_can_close_hiring_request(uuid, uuid) from authenticated;

drop policy if exists "candidate_documents_select_scoped" on public.candidate_documents;
create policy "candidate_documents_select_scoped"
on public.candidate_documents
for select
to authenticated
using (public.user_can_view_recruitment_case((select auth.uid()), recruitment_case_id));

drop policy if exists "candidate_documents_insert_scoped" on public.candidate_documents;
create policy "candidate_documents_insert_scoped"
on public.candidate_documents
for insert
to authenticated
with check (public.user_can_manage_recruitment_case((select auth.uid()), recruitment_case_id));

drop policy if exists "candidate_documents_update_scoped" on public.candidate_documents;
create policy "candidate_documents_update_scoped"
on public.candidate_documents
for update
to authenticated
using (public.user_can_manage_recruitment_case((select auth.uid()), recruitment_case_id));

drop policy if exists "hiring_requests_select_scoped" on public.hiring_requests;
create policy "hiring_requests_select_scoped"
on public.hiring_requests
for select
to authenticated
using (
  requester_id = (select auth.uid())
  or public.user_is_admin((select auth.uid()))
  or exists (
    select 1
    from public.hiring_request_approvals hra
    where hra.hiring_request_id = public.hiring_requests.id
      and hra.approver_user_id = (select auth.uid())
      and hra.status = 'pending'
      and hra.step_code = public.hiring_requests.current_step_code
  )
);

drop policy if exists "hiring_request_approvals_select_app" on public.hiring_request_approvals;
drop policy if exists "hiring_request_approvals_select_scoped" on public.hiring_request_approvals;
create policy "hiring_request_approvals_select_scoped"
on public.hiring_request_approvals
for select
to authenticated
using (
  approver_user_id = (select auth.uid())
  or public.user_is_admin((select auth.uid()))
  or exists (
    select 1
    from public.hiring_requests hr
    where hr.id = hiring_request_id
      and hr.requester_id = (select auth.uid())
  )
);

drop policy if exists "hiring_request_snapshots_select_scoped" on public.hiring_request_snapshots;
create policy "hiring_request_snapshots_select_scoped"
on public.hiring_request_snapshots
for select
to authenticated
using (
  public.user_is_admin((select auth.uid()))
  or exists (
    select 1
    from public.hiring_requests hr
    where hr.id = hiring_request_id
      and (
        hr.requester_id = (select auth.uid())
        or exists (
          select 1
          from public.hiring_request_approvals hra
          where hra.hiring_request_id = hr.id
            and hra.approver_user_id = (select auth.uid())
            and hra.status = 'pending'
            and hra.step_code = hr.current_step_code
        )
      )
  )
);

drop policy if exists "hiring_request_audit_log_select_scoped" on public.hiring_request_audit_log;
create policy "hiring_request_audit_log_select_scoped"
on public.hiring_request_audit_log
for select
to authenticated
using (
  public.user_is_admin((select auth.uid()))
  or exists (
    select 1
    from public.hiring_requests hr
    where hr.id = hiring_request_id
      and (
        hr.requester_id = (select auth.uid())
        or exists (
          select 1
          from public.hiring_request_approvals hra
          where hra.hiring_request_id = hr.id
            and hra.approver_user_id = (select auth.uid())
            and hra.status = 'pending'
            and hra.step_code = hr.current_step_code
        )
      )
  )
);

drop policy if exists "recruitment_cases_select_scoped" on public.recruitment_cases;
create policy "recruitment_cases_select_scoped"
on public.recruitment_cases
for select
to authenticated
using (public.user_can_view_recruitment_case((select auth.uid()), id));

drop policy if exists "recruitment_case_assignments_select_scoped" on public.recruitment_case_assignments;
create policy "recruitment_case_assignments_select_scoped"
on public.recruitment_case_assignments
for select
to authenticated
using (public.user_can_view_recruitment_case((select auth.uid()), recruitment_case_id));

drop policy if exists "candidate_profiles_select_scoped" on public.candidate_profiles;
create policy "candidate_profiles_select_scoped"
on public.candidate_profiles
for select
to authenticated
using (
  public.user_is_admin((select auth.uid()))
  or exists (
    select 1
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    where rcc.candidate_profile_id = candidate_profiles.id
      and public.user_can_view_recruitment_case((select auth.uid()), rc.id)
  )
);

drop policy if exists "recruitment_case_candidates_select_scoped" on public.recruitment_case_candidates;
create policy "recruitment_case_candidates_select_scoped"
on public.recruitment_case_candidates
for select
to authenticated
using (public.user_can_view_recruitment_case((select auth.uid()), recruitment_case_id));

drop policy if exists "recruitment_case_candidate_stage_history_select_scoped" on public.recruitment_case_candidate_stage_history;
create policy "recruitment_case_candidate_stage_history_select_scoped"
on public.recruitment_case_candidate_stage_history
for select
to authenticated
using (
  exists (
    select 1
    from public.recruitment_case_candidates rcc
    where rcc.id = recruitment_case_candidate_id
      and public.user_can_view_recruitment_case((select auth.uid()), rcc.recruitment_case_id)
  )
);

drop policy if exists "recruitment_case_audit_log_select_scoped" on public.recruitment_case_audit_log;
create policy "recruitment_case_audit_log_select_scoped"
on public.recruitment_case_audit_log
for select
to authenticated
using (public.user_can_view_recruitment_case((select auth.uid()), recruitment_case_id));

drop policy if exists "candidate_stage_approvals_select_scoped" on public.candidate_stage_approvals;
create policy "candidate_stage_approvals_select_scoped"
on public.candidate_stage_approvals
for select
to authenticated
using (
  public.user_has_capability((select auth.uid()), 'can_approve_who_stage')
  or exists (
    select 1
    from public.recruitment_case_candidates rcc
    where rcc.id = candidate_stage_approvals.recruitment_case_candidate_id
      and public.user_can_view_recruitment_case((select auth.uid()), rcc.recruitment_case_id)
  )
);

drop policy if exists "candidate_worker_files_select_scoped" on public.candidate_worker_files;
create policy "candidate_worker_files_select_scoped"
on public.candidate_worker_files
for select
to authenticated
using (
  exists (
    select 1
    from public.recruitment_case_candidates rcc
    where rcc.id = candidate_worker_files.recruitment_case_candidate_id
      and public.user_can_view_recruitment_case((select auth.uid()), rcc.recruitment_case_id)
  )
);

drop policy if exists "employees_authenticated_select" on public.employees;
create policy "employees_authenticated_select"
on public.employees
for select
to authenticated
using (
  public.user_is_admin((select auth.uid()))
  or public.user_can_access_module((select auth.uid()), 'operaciones')
  or public.user_can_access_module((select auth.uid()), 'control_contrataciones')
  or public.user_can_access_module((select auth.uid()), 'solicitud_contrataciones')
  or public.user_can_access_module((select auth.uid()), 'certificados')
  or public.user_can_access_module((select auth.uid()), 'seguimiento_certificados')
);

drop index if exists public.idx_hiring_request_approvals_approver_status;
drop index if exists public.idx_recruitment_case_candidates_profile;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_candidates_recruitment_case_id_candidate_p_key'
      and conrelid = 'public.recruitment_case_candidates'::regclass
  ) then
    if exists (
      select 1
      from pg_constraint
      where conname = 'recruitment_case_candidates_case_profile_key'
        and conrelid = 'public.recruitment_case_candidates'::regclass
    ) then
      alter table public.recruitment_case_candidates
        drop constraint recruitment_case_candidates_recruitment_case_id_candidate_p_key;
    else
      alter table public.recruitment_case_candidates
        rename constraint recruitment_case_candidates_recruitment_case_id_candidate_p_key
        to recruitment_case_candidates_case_profile_key;
    end if;
  end if;
end
$$;

drop index if exists public.recruitment_case_candidates_recruitment_case_id_candidate_p_key;

notify pgrst, 'reload schema';

commit;
