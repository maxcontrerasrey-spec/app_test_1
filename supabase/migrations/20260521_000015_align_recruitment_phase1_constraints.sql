begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_assignments_case_user_role_key'
      and conrelid = 'public.recruitment_case_assignments'::regclass
  ) then
    alter table public.recruitment_case_assignments
      add constraint recruitment_case_assignments_case_user_role_key
      unique (recruitment_case_id, user_id, assignment_role);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'candidate_profiles_national_id_key'
      and conrelid = 'public.candidate_profiles'::regclass
  ) then
    alter table public.candidate_profiles
      add constraint candidate_profiles_national_id_key
      unique (national_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_candidates_case_profile_key'
      and conrelid = 'public.recruitment_case_candidates'::regclass
  ) then
    alter table public.recruitment_case_candidates
      add constraint recruitment_case_candidates_case_profile_key
      unique (recruitment_case_id, candidate_profile_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_cases_status_check'
      and conrelid = 'public.recruitment_cases'::regclass
  ) then
    alter table public.recruitment_cases
      add constraint recruitment_cases_status_check
      check (status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled', 'filled', 'closed_unfilled', 'cancelled'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'candidate_profiles_status_check'
      and conrelid = 'public.candidate_profiles'::regclass
  ) then
    alter table public.candidate_profiles
      add constraint candidate_profiles_status_check
      check (status in ('active', 'inactive', 'blocked'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_candidates_stage_code_check'
      and conrelid = 'public.recruitment_case_candidates'::regclass
  ) then
    alter table public.recruitment_case_candidates
      add constraint recruitment_case_candidates_stage_code_check
      check (stage_code in ('lead', 'contacted', 'screening', 'shortlisted', 'documents_pending', 'ready_for_hire', 'hired', 'rejected', 'withdrawn'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_candidates_suitability_status_check'
      and conrelid = 'public.recruitment_case_candidates'::regclass
  ) then
    alter table public.recruitment_case_candidates
      add constraint recruitment_case_candidates_suitability_status_check
      check (suitability_status in ('unknown', 'fit', 'risk', 'blocked'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_audit_log_action_type_check'
      and conrelid = 'public.recruitment_case_audit_log'::regclass
  ) then
    alter table public.recruitment_case_audit_log
      add constraint recruitment_case_audit_log_action_type_check
      check (action_type in ('case_opened', 'owner_assigned', 'candidate_added', 'candidate_stage_changed', 'candidate_hired', 'case_status_synced'));
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
