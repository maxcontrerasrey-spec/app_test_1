begin;

-- 1. Restaurar políticas de RLS que pudieron haber sido eliminadas por CASCADE
drop policy if exists "recruitment_cases_select_scoped" on public.recruitment_cases;
create policy "recruitment_cases_select_scoped"
on public.recruitment_cases
for select
to authenticated
using (public.user_can_view_recruitment_case(auth.uid(), id));

drop policy if exists "recruitment_case_assignments_select_scoped" on public.recruitment_case_assignments;
create policy "recruitment_case_assignments_select_scoped"
on public.recruitment_case_assignments
for select
to authenticated
using (public.user_can_view_recruitment_case(auth.uid(), recruitment_case_id));

drop policy if exists "candidate_profiles_select_scoped" on public.candidate_profiles;
create policy "candidate_profiles_select_scoped"
on public.candidate_profiles
for select
to authenticated
using (
  public.user_is_admin(auth.uid())
  or exists (
    select 1
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    where rcc.candidate_profile_id = candidate_profiles.id
      and public.user_can_view_recruitment_case(auth.uid(), rc.id)
  )
);

drop policy if exists "recruitment_case_candidates_select_scoped" on public.recruitment_case_candidates;
create policy "recruitment_case_candidates_select_scoped"
on public.recruitment_case_candidates
for select
to authenticated
using (public.user_can_view_recruitment_case(auth.uid(), recruitment_case_id));

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
      and public.user_can_view_recruitment_case(auth.uid(), rcc.recruitment_case_id)
  )
);

drop policy if exists "recruitment_case_audit_log_select_scoped" on public.recruitment_case_audit_log;
create policy "recruitment_case_audit_log_select_scoped"
on public.recruitment_case_audit_log
for select
to authenticated
using (public.user_can_view_recruitment_case(auth.uid(), recruitment_case_id));

-- 2. Restaurar la función get_recruitment_case_detail
create or replace function public.get_recruitment_case_detail(
  p_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  case_payload jsonb;
  assignments_payload jsonb := '[]'::jsonb;
  candidates_payload jsonb := '[]'::jsonb;
  audit_payload jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_view_recruitment_case(current_user_id, p_case_id) then
    raise exception 'Sin permisos para ver este caso';
  end if;

  select jsonb_build_object(
    'id', rc.id,
    'case_code', rc.case_code,
    'status', rc.status,
    'requested_vacancies', rc.requested_vacancies,
    'filled_vacancies', rc.filled_vacancies,
    'title', rc.title,
    'contract_name', rc.contract_name,
    'job_position_name', rc.job_position_name,
    'cost_center_code', rc.cost_center_code,
    'cost_center_name', rc.cost_center_name,
    'requested_entry_date', rc.requested_entry_date,
    'target_close_date', rc.target_close_date,
    'opened_at', rc.opened_at,
    'close_reason', rc.close_reason,
    'hiring_request', jsonb_build_object(
      'id', hr.id,
      'folio', hr.folio,
      'requester_name', hr.requester_name,
      'requester_email', hr.requester_email,
      'start_date', hr.start_date,
      'end_date', hr.end_date,
      'shift_name', hr.shift_name,
      'salary_offer', hr.salary_offer,
      'campamento', hr.campamento,
      'pasajes', hr.pasajes,
      'other_benefits', hr.other_benefits
    )
  )
  into case_payload
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  where rc.id = p_case_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rca.id,
        'user_id', rca.user_id,
        'assignment_role', rca.assignment_role,
        'is_primary', rca.is_primary,
        'assigned_at', rca.assigned_at,
        'full_name', p.full_name,
        'email', p.email
      )
      order by rca.is_primary desc, rca.id asc
    ),
    '[]'::jsonb
  )
  into assignments_payload
  from public.recruitment_case_assignments rca
  join public.profiles p
    on p.id = rca.user_id
  where rca.recruitment_case_id = p_case_id;

  select coalesce(
    jsonb_agg(candidate_row.payload order by candidate_row.sort_created_at asc),
    '[]'::jsonb
  )
  into candidates_payload
  from (
    select
      jsonb_build_object(
        'id', rcc.id,
        'candidate_profile_id', cp.id,
        'national_id', cp.national_id,
        'full_name', cp.full_name,
        'email', cp.email,
        'phone', cp.phone,
        'driver_license_number', cp.driver_license_number,
        'driver_license_class', cp.driver_license_class,
        'driver_license_expiry', cp.driver_license_expiry,
        'stage_code', rcc.stage_code,
        'stage_entered_at', rcc.stage_entered_at,
        'suitability_status', rcc.suitability_status,
        'is_selected', rcc.is_selected,
        'hired_at', rcc.hired_at,
        'created_at', rcc.created_at,
        'stage_history', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', sh.id,
              'from_stage', sh.from_stage,
              'to_stage', sh.to_stage,
              'changed_by', sh.changed_by,
              'reason_code', sh.reason_code,
              'comment', sh.comment,
              'created_at', sh.created_at
            )
            order by sh.created_at desc
          )
          from public.recruitment_case_candidate_stage_history sh
          where sh.recruitment_case_candidate_id = rcc.id
        ), '[]'::jsonb)
      ) as payload,
      rcc.created_at as sort_created_at
    from public.recruitment_case_candidates rcc
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
    where rcc.recruitment_case_id = p_case_id
  ) as candidate_row;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action_type', al.action_type,
        'actor_user_id', al.actor_user_id,
        'actor_name', actor_profile.full_name,
        'old_values', al.old_values,
        'new_values', al.new_values,
        'metadata', al.metadata,
        'created_at', al.created_at
      )
      order by al.created_at desc
    ),
    '[]'::jsonb
  )
  into audit_payload
  from public.recruitment_case_audit_log al
  left join public.profiles actor_profile
    on actor_profile.id = al.actor_user_id
  where al.recruitment_case_id = p_case_id
  limit 40;

  return jsonb_build_object(
    'case', case_payload,
    'assignments', assignments_payload,
    'candidates', candidates_payload,
    'audit', audit_payload
  );
end;
$function$;

grant execute on function public.get_recruitment_case_detail(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
