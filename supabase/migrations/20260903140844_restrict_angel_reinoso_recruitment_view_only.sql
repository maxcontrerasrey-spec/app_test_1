-- EEES-DB-005: approved
-- owner: Engineering and Recruitment
-- rollback: forward-only; restore the prior role assignment and read guards through a new migration if required.

begin;

-- El rol control_contratos tiene acceso de lectura a las features de reclutamiento.
-- Este helper debe reconocer esa lectura sin convertirla en capacidad de gestión.
create or replace function public.user_can_access_candidate_control(target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if target_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> target_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_can_access_feature(target_user_id, 'recruitment_candidate_control');
end;
$function$;

create or replace function public.user_can_view_recruitment_case(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.user_is_admin(target_user_id)
    or public.user_has_role(target_user_id, 'reclutamiento')
    or public.user_has_role(target_user_id, 'control_contratos')
    or exists (
      select 1
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = target_case_id
        and rca.user_id = target_user_id
    )
    or (
      public.user_has_capability(target_user_id, 'can_approve_who_stage')
      and exists (
        select 1
        from public.recruitment_case_candidates rcc
        join public.candidate_stage_approvals csa
          on csa.recruitment_case_candidate_id = rcc.id
         and csa.stage_code = 'who_pending'
         and csa.status = 'pending'
        where rcc.recruitment_case_id = target_case_id
      )
    );
$function$;

-- Lectura de precandidatos separada de la facultad de aprobar/rechazar.
create or replace function public.user_can_view_dsal_precandidates(actor_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if actor_id is null or current_user_id is null or current_user_id <> actor_id then
    return false;
  end if;

  return public.user_can_review_dsal_precandidates(actor_id)
      or public.user_has_role(actor_id, 'control_contratos');
end;
$function$;

create or replace function public.assert_dsal_precandidate_view_access(actor_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if actor_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_view_dsal_precandidates(actor_id) then
    raise exception 'Sin permisos para ver precandidatos DSAL';
  end if;
end;
$function$;

create or replace function public.get_recruitment_precandidates_page(
  p_status text default 'pending',
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_status text := coalesce(nullif(trim(p_status), ''), 'pending');
  normalized_search text := nullif(public.normalize_recruitment_search_text(p_search), '');
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_dsal_precandidate_view_access(current_user_id);

  if normalized_status not in ('pending', 'approved', 'rejected', 'archived', 'all') then
    raise exception 'Estado de precandidato inválido';
  end if;

  with filtered as (
    select rp.*, approved_hr.folio as approved_folio,
      coalesce(roster.is_union_representative, false) as is_union_representative,
      coalesce(js.criminal_count, 0) as criminal_cause_count,
      coalesce(js.labor_count, 0) as labor_cause_count,
      coalesce(criminal.details, '[]'::jsonb) as criminal_cause_details,
      coalesce(laboral.details, '[]'::jsonb) as labor_cause_details
      from public.recruitment_precandidates rp
      left join public.recruitment_cases approved_rc
        on approved_rc.id = rp.approved_recruitment_case_id
      left join public.hiring_requests approved_hr
        on approved_hr.id = approved_rc.hiring_request_id
      left join public.recruitment_dsal_roster roster
        on roster.national_id = rp.national_id
       and roster.is_active = true
      left join public.recruitment_dsal_judicial_summary js
        on js.national_id = rp.national_id
      left join lateral (
        select jsonb_agg(
          jsonb_build_object('description', description, 'date', to_char(cause_date, 'DD-MM-YYYY'))
          order by cause_date nulls last, id
        ) as details
          from public.recruitment_dsal_judicial_causes
         where national_id = rp.national_id and category = 'criminal'
      ) criminal on true
      left join lateral (
        select jsonb_agg(
          jsonb_build_object('description', description, 'date', to_char(cause_date, 'DD-MM-YYYY'))
          order by cause_date nulls last, id
        ) as details
          from public.recruitment_dsal_judicial_causes
         where national_id = rp.national_id and category = 'laboral'
      ) laboral on true
     where (normalized_status = 'all' or rp.status = normalized_status)
       and (
         normalized_search is null
         or public.normalize_recruitment_search_text(rp.full_name) like '%' || normalized_search || '%'
         or public.normalize_recruitment_search_text(rp.national_id) like '%' || normalized_search || '%'
         or public.normalize_recruitment_search_text(rp.personal_email) like '%' || normalized_search || '%'
         or public.normalize_recruitment_search_text(rp.phone) like '%' || normalized_search || '%'
         or public.normalize_recruitment_search_text(rp.dsal_role) like '%' || normalized_search || '%'
       )
  ),
  counted as (
    select count(*)::integer as total_count from filtered
  ),
  page_items as (
    select * from filtered
     order by submitted_at desc, created_at desc
     limit safe_limit offset safe_offset
  ),
  role_counts as (
    select status, dsal_role, count(*)::integer as role_count
      from public.recruitment_precandidates
     group by status, dsal_role
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(page_items) order by page_items.submitted_at desc, page_items.created_at desc), '[]'::jsonb),
    'total_count', (select total_count from counted),
    'summary', jsonb_build_object(
      'pending', (select count(*) from public.recruitment_precandidates where status = 'pending'),
      'approved', (select count(*) from public.recruitment_precandidates where status = 'approved'),
      'rejected', (select count(*) from public.recruitment_precandidates where status = 'rejected'),
      'by_role', jsonb_build_object(
        'pending', coalesce((select jsonb_agg(jsonb_build_object('role', dsal_role, 'count', role_count) order by role_count desc, dsal_role) from role_counts where status = 'pending'), '[]'::jsonb),
        'approved', coalesce((select jsonb_agg(jsonb_build_object('role', dsal_role, 'count', role_count) order by role_count desc, dsal_role) from role_counts where status = 'approved'), '[]'::jsonb),
        'rejected', coalesce((select jsonb_agg(jsonb_build_object('role', dsal_role, 'count', role_count) order by role_count desc, dsal_role) from role_counts where status = 'rejected'), '[]'::jsonb)
      )
    )
  ) into payload from page_items;

  return coalesce(payload, jsonb_build_object(
    'items', '[]'::jsonb,
    'total_count', 0,
    'summary', jsonb_build_object(
      'pending', 0, 'approved', 0, 'rejected', 0,
      'by_role', jsonb_build_object('pending', '[]'::jsonb, 'approved', '[]'::jsonb, 'rejected', '[]'::jsonb)
    )
  ));
end;
$function$;

revoke all on function public.user_can_access_candidate_control(uuid) from public, anon;
grant execute on function public.user_can_access_candidate_control(uuid) to authenticated;
revoke all on function public.user_can_view_recruitment_case(uuid, uuid) from public, anon;
grant execute on function public.user_can_view_recruitment_case(uuid, uuid) to authenticated;
revoke all on function public.user_can_view_dsal_precandidates(uuid) from public, anon, authenticated;
revoke all on function public.assert_dsal_precandidate_view_access(uuid) from public, anon, authenticated;
revoke all on function public.get_recruitment_precandidates_page(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_recruitment_precandidates_page(text, text, integer, integer) to authenticated;

-- Angel conserva administrativo y pasa a la matriz de lectura de control de contratos.
delete from public.user_roles
 where user_id = '4913b662-4437-4618-816a-572813536ee4'::uuid
   and role_code = 'reclutamiento';

insert into public.user_roles (user_id, role_code)
select '4913b662-4437-4618-816a-572813536ee4'::uuid, 'control_contratos'
where not exists (
  select 1 from public.user_roles
   where user_id = '4913b662-4437-4618-816a-572813536ee4'::uuid
     and role_code = 'control_contratos'
);

do $$
begin
  if exists (
    select 1 from public.user_roles
     where user_id = '4913b662-4437-4618-816a-572813536ee4'::uuid
       and role_code = 'reclutamiento'
  ) then
    raise exception 'No se pudo retirar el rol reclutamiento a Angel Reinoso';
  end if;
  if not exists (
    select 1 from public.user_roles
     where user_id = '4913b662-4437-4618-816a-572813536ee4'::uuid
       and role_code = 'control_contratos'
  ) then
    raise exception 'No se pudo asignar el rol control_contratos a Angel Reinoso';
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
