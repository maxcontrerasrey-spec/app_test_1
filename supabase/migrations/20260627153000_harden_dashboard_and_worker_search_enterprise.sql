begin;

create extension if not exists pg_trgm with schema public;

create or replace function public.build_employee_document_digits(
  p_document_number text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns text
language plpgsql
immutable
set search_path = public
as $function$
declare
  normalized_payload jsonb := coalesce(p_raw_payload, '{}'::jsonb);
  resolved_document_number text := coalesce(
    nullif(trim(coalesce(p_document_number, '')), ''),
    nullif(trim(coalesce(normalized_payload ->> 'document_number', '')), ''),
    nullif(trim(coalesce(normalized_payload ->> 'rut', '')), ''),
    ''
  );
begin
  return regexp_replace(resolved_document_number, '\D', '', 'g');
end;
$function$;

create or replace function public.build_active_employee_identity_key(
  p_document_type text default null,
  p_document_number text default null,
  p_buk_employee_id text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns text
language plpgsql
immutable
set search_path = public
as $function$
declare
  normalized_document_type text := coalesce(nullif(trim(coalesce(p_document_type, '')), ''), 'buk');
  normalized_digits text := nullif(public.build_employee_document_digits(p_document_number, p_raw_payload), '');
begin
  return normalized_document_type
    || ':'
    || coalesce(normalized_digits, nullif(trim(coalesce(p_buk_employee_id, '')), ''), '');
end;
$function$;

create or replace function public.build_active_employee_search_text(
  p_full_name text,
  p_document_number text default null,
  p_job_title text default null,
  p_contract_code text default null,
  p_area_name text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns text
language plpgsql
immutable
set search_path = public
as $function$
declare
  normalized_payload jsonb := coalesce(p_raw_payload, '{}'::jsonb);
  resolved_document_number text := coalesce(
    nullif(trim(coalesce(p_document_number, '')), ''),
    nullif(trim(coalesce(normalized_payload ->> 'document_number', '')), ''),
    nullif(trim(coalesce(normalized_payload ->> 'rut', '')), ''),
    ''
  );
  resolved_job_title text := public.resolve_active_employee_job_title(normalized_payload, p_job_title);
begin
  return public.normalize_recruitment_search_text(
    concat_ws(
      ' ',
      public.build_buk_employee_name_search_key(p_full_name, normalized_payload),
      p_full_name,
      resolved_document_number,
      public.build_employee_document_digits(resolved_document_number, normalized_payload),
      resolved_job_title,
      coalesce(p_contract_code, ''),
      coalesce(p_area_name, '')
    )
  );
end;
$function$;

create index if not exists idx_employees_active_worker_search_text_trgm
  on public.employees
  using gin (
    (
      public.build_active_employee_search_text(
      full_name,
      document_number,
      job_title,
      contract_code,
      area_name,
      raw_payload
      )
    ) gin_trgm_ops
  )
  where is_active = true;

create index if not exists idx_employees_active_name_search_prefix
  on public.employees (
    public.build_buk_employee_name_search_key(full_name, raw_payload) text_pattern_ops
  )
  where is_active = true;

create index if not exists idx_employees_active_document_digits_trgm
  on public.employees
  using gin (
    (
      public.build_employee_document_digits(document_number, raw_payload)
    ) gin_trgm_ops
  )
  where is_active = true
    and public.build_employee_document_digits(document_number, raw_payload) <> '';

create index if not exists idx_internal_mobility_requests_blocked_worker_lookup
  on public.internal_mobility_requests (employee_buk_employee_id)
  where status in ('pending_area_manager', 'pending_contracts_control')
     or (status = 'approved' and hr_execution_status = 'pending');

create or replace function public.user_can_view_hiring_request_process_summary(
  target_user_id uuid,
  requester_user_id uuid,
  request_cost_center_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      requester_user_id = target_user_id
      or public.user_is_admin(target_user_id)
      or public.user_has_role(target_user_id, 'reclutamiento')
      or public.user_has_role(target_user_id, 'control_contratos')
      or public.user_has_role(target_user_id, 'director_eje')
      or public.user_has_role(target_user_id, 'gerente_general')
      or public.user_has_role(target_user_id, 'director_op')
      or (
        public.user_has_role(target_user_id, 'gerencia')
        and exists (
          select 1
          from public.cost_center_approvers cca
          where regexp_replace(trim(coalesce(cca.cost_center_code, '')), '\.0+$', '', 'g')
              = regexp_replace(trim(coalesce(request_cost_center_code, '')), '\.0+$', '', 'g')
            and cca.approver_user_id = target_user_id
            and cca.is_active = true
        )
      )
    );
$function$;

create or replace function public.get_dashboard_operational_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  today_cl date := timezone('America/Santiago', now())::date;
  recruitment_summary_payload jsonb := '{}'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  recruitment_summary_payload := coalesce(public.get_recruitment_control_summary(), '{}'::jsonb);

  return (
    with visible_hiring_scope as (
      select distinct
        hr.cost_center_code,
        hr.contract_number
      from public.hiring_requests hr
      where public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
    ),
    assigned_ceco_scope as (
      select distinct regexp_replace(trim(cca.cost_center_code), '\.0+$', '', 'g')
        as normalized_ceco
      from public.cost_center_approvers cca
      where cca.approver_user_id = current_user_id
        and cca.is_active = true
    ),
    broad_access as (
      select
        public.user_is_admin(current_user_id)
        or public.user_has_role(current_user_id, 'administrativo')
        or public.user_has_role(current_user_id, 'reclutamiento')
        or public.user_has_role(current_user_id, 'control_contratos')
        or public.user_has_role(current_user_id, 'director_eje')
        or public.user_has_role(current_user_id, 'gerente_general')
        or public.user_has_role(current_user_id, 'director_op') as enabled
    ),
    workforce_ceco_scope as (
      select distinct regexp_replace(trim(coalesce(e.contract_code, '')), '\.0+$', '', 'g')
        as normalized_ceco
      from public.employees_active_current e
      cross join broad_access ba
      where ba.enabled

      union

      select normalized_ceco
      from assigned_ceco_scope

      union

      select distinct regexp_replace(trim(vhs.cost_center_code), '\.0+$', '', 'g')
      from visible_hiring_scope vhs
    ),
    incentive_contract_scope as (
      select distinct c.code as contract_code
      from public.contracts c
      cross join broad_access ba
      where c.is_active = true
        and ba.enabled

      union

      select distinct c.code
      from public.contracts c
      join assigned_ceco_scope acs
        on acs.normalized_ceco = regexp_replace(trim(c.cost_center_code), '\.0+$', '', 'g')
      where c.is_active = true

      union

      select distinct c.code
      from visible_hiring_scope vhs
      join public.contracts c
        on c.contract_number = vhs.contract_number
       and c.is_active = true
    ),
    recruitment_metric_cases as (
      select
        rc.id,
        rc.status,
        rc.requested_vacancies
      from public.recruitment_cases rc
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      where public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
    ),
    recruitment_active_cases as (
      select rmc.*
      from recruitment_metric_cases rmc
      where rmc.status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')
    ),
    recruitment_candidate_metrics as (
      select
        rcc.recruitment_case_id,
        count(*) filter (
          where rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
        )::bigint as in_progress_candidates,
        count(*) filter (where rcc.stage_code = 'hired')::bigint as hired_candidates
      from public.recruitment_case_candidates rcc
      join recruitment_active_cases rac
        on rac.id = rcc.recruitment_case_id
      group by rcc.recruitment_case_id
    ),
    recruitment_metric_summary as (
      select
        coalesce(sum(rac.requested_vacancies), 0)::bigint as requested_vacancies,
        coalesce(sum(rcm.in_progress_candidates), 0)::bigint as in_progress_candidates,
        coalesce(sum(rcm.hired_candidates), 0)::bigint as hired_candidates
      from recruitment_active_cases rac
      left join recruitment_candidate_metrics rcm
        on rcm.recruitment_case_id = rac.id
    ),
    visible_population as (
      select e.buk_employee_id
      from public.employees_active_current e
      where exists (
        select 1
        from workforce_ceco_scope wcs
        where wcs.normalized_ceco = regexp_replace(
          trim(coalesce(e.contract_code, '')),
          '\.0+$',
          '',
          'g'
        )
      )
    ),
    workforce_absences_today as (
      select
        count(distinct hre.employee_buk_employee_id) filter (
          where hre.exception_type = 'vacation'
        )::bigint as vacations_today,
        count(distinct hre.employee_buk_employee_id) filter (
          where hre.exception_type = 'medical_leave'
        )::bigint as medical_leaves_today,
        count(distinct hre.employee_buk_employee_id) filter (
          where hre.exception_type in (
            'vacation',
            'medical_leave',
            'absent',
            'administrative_leave',
            'union_leave'
          )
        )::bigint as absent_people_today
      from public.hr_roster_exceptions hre
      join visible_population vp
        on vp.buk_employee_id = hre.employee_buk_employee_id
      where hre.exception_date = today_cl
        and hre.is_active = true
    ),
    workforce_summary as (
      select
        count(*)::bigint as total_employees,
        coalesce(max(wat.medical_leaves_today), 0)::bigint as medical_leaves_today,
        coalesce(max(wat.vacations_today), 0)::bigint as vacations_today,
        case
          when count(*) = 0 then 0::numeric
          else round(
            (coalesce(max(wat.absent_people_today), 0)::numeric / count(*)::numeric) * 100,
            1
          )
        end as absenteeism_pct
      from visible_population vp
      cross join workforce_absences_today wat
    ),
    incentives_summary as (
      select
        count(*) filter (where hir.status <> 'R')::bigint as total_generated,
        count(*) filter (where hir.status in ('P', 'E'))::bigint as pending_approval,
        count(*) filter (where hir.status = 'F')::bigint as approved,
        coalesce(
          sum(hir.calculated_amount) filter (where hir.status <> 'R'),
          0
        )::numeric(14,2) as total_amount
      from public.hr_incentive_requests hir
      where exists (
        select 1
        from incentive_contract_scope ics
        where ics.contract_code = hir.selected_contract_code
      )
    )
    select jsonb_build_object(
      'recruitment',
      jsonb_build_object(
        'open_processes',
        coalesce((recruitment_summary_payload ->> 'active_cases')::bigint, 0),
        'requested_vacancies',
        coalesce((select requested_vacancies from recruitment_metric_summary), 0),
        'in_progress_candidates',
        coalesce((select in_progress_candidates from recruitment_metric_summary), 0),
        'hired_candidates',
        coalesce((select hired_candidates from recruitment_metric_summary), 0),
        'ready_to_hire_cases',
        coalesce((recruitment_summary_payload ->> 'ready_to_hire_cases')::bigint, 0),
        'filled_cases',
        coalesce((recruitment_summary_payload ->> 'filled_cases')::bigint, 0)
      ),
      'workforce',
      jsonb_build_object(
        'total_employees', coalesce((select total_employees from workforce_summary), 0),
        'medical_leaves_today', coalesce((select medical_leaves_today from workforce_summary), 0),
        'vacations_today', coalesce((select vacations_today from workforce_summary), 0),
        'absenteeism_pct', coalesce((select absenteeism_pct from workforce_summary), 0)
      ),
      'incentives',
      jsonb_build_object(
        'total_generated', coalesce((select total_generated from incentives_summary), 0),
        'pending_approval', coalesce((select pending_approval from incentives_summary), 0),
        'approved', coalesce((select approved from incentives_summary), 0),
        'total_amount', coalesce((select total_amount from incentives_summary), 0)
      )
    )
  );
end;
$function$;

create or replace function public.search_hr_incentive_eligible_workers(
  p_search text default null,
  p_limit integer default 20
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  job_title text,
  contract_code text,
  area_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 20), 30));
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores elegibles';
  end if;

  return query
  with eligible_titles as (
    select upper(trim(jt.job_title)) as normalized_job_title
    from public.hr_incentive_allowed_job_titles jt
    where jt.is_active = true
  ),
  matching_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      e.raw_payload,
      coalesce(
        nullif(trim(coalesce(e.document_number, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_number', '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'rut', '')), '')
      ) as document_number,
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as resolved_job_title,
      nullif(trim(e.area_name), '') as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key,
      row_number() over (
        partition by public.build_active_employee_identity_key(
          e.document_type,
          e.document_number,
          e.buk_employee_id,
          e.raw_payload
        )
        order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
      ) as identity_rank
    from public.employees e
    where e.is_active = true
      and (
        normalized_search = ''
        or public.build_active_employee_search_text(
          e.full_name,
          e.document_number,
          e.job_title,
          e.contract_code,
          e.area_name,
          e.raw_payload
        ) like '%' || normalized_search || '%'
      )
  ),
  operable_workers as (
    select
      mw.buk_employee_id,
      mw.full_name,
      mw.raw_payload,
      mw.document_number,
      mw.resolved_job_title,
      c.code as contract_code,
      bcm.buk_area_name as area_name,
      mw.name_search_key
    from matching_workers mw
    join public.buk_contract_mappings bcm
      on bcm.buk_area_name_normalized = public.normalize_buk_area_name(mw.area_name)
     and bcm.is_operational = true
     and bcm.is_one_to_one = true
     and bcm.contract_id is not null
    join public.contracts c
      on c.id = bcm.contract_id
     and c.is_active = true
    join eligible_titles et
      on upper(trim(coalesce(mw.resolved_job_title, ''))) = et.normalized_job_title
    where mw.identity_rank = 1
  )
  select
    ow.buk_employee_id,
    ow.full_name,
    ow.document_number,
    ow.resolved_job_title as job_title,
    ow.contract_code,
    ow.area_name,
    concat_ws(
      ' | ',
      coalesce(ow.document_number, 'Sin RUT'),
      coalesce(ow.resolved_job_title, 'Sin cargo'),
      ow.full_name,
      coalesce(ow.area_name, ow.contract_code, 'Sin contrato')
    ) as display_label
  from operable_workers ow
  order by
    case
      when normalized_search <> '' and ow.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(ow.full_name) like normalized_search || '%' then 1
      else 2
    end,
    ow.full_name
  limit safe_limit;
end;
$function$;

create or replace function public.search_internal_mobility_workers(
  p_search text,
  p_limit integer default 12
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  job_title text,
  contract_code text,
  area_name text,
  company_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_digits text := public.build_employee_document_digits(p_search, '{}'::jsonb);
  safe_limit integer := greatest(1, least(coalesce(p_limit, 12), 25));
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para buscar trabajadores';
  end if;

  if length(normalized_search) < 2 and length(normalized_digits) < 4 then
    return;
  end if;

  return query
  with blocked_workers as (
    select distinct imr.employee_buk_employee_id as buk_employee_id
    from public.internal_mobility_requests imr
    where imr.status in ('pending_area_manager', 'pending_contracts_control')
       or (imr.status = 'approved' and imr.hr_execution_status = 'pending')
  ),
  matching_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      e.raw_payload,
      coalesce(
        nullif(trim(coalesce(e.document_number, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_number', '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'rut', '')), '')
      ) as document_number,
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name,
      public.resolve_active_employee_company_name(e.raw_payload, e.area_name) as resolved_company_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key,
      public.build_employee_document_digits(e.document_number, e.raw_payload) as document_digits,
      row_number() over (
        partition by public.build_active_employee_identity_key(
          e.document_type,
          e.document_number,
          e.buk_employee_id,
          e.raw_payload
        )
        order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
      ) as identity_rank
    from public.employees e
    where e.is_active = true
      and (
        (
          normalized_search <> ''
          and public.build_active_employee_search_text(
            e.full_name,
            e.document_number,
            e.job_title,
            e.contract_code,
            e.area_name,
            e.raw_payload
          ) like '%' || normalized_search || '%'
        )
        or (
          normalized_digits <> ''
          and public.build_employee_document_digits(e.document_number, e.raw_payload)
            like '%' || normalized_digits || '%'
        )
      )
  )
  select
    mw.buk_employee_id,
    mw.full_name,
    mw.document_number,
    mw.resolved_job_title as job_title,
    mw.contract_code,
    mw.area_name,
    mw.resolved_company_name as company_name,
    concat_ws(
      ' · ',
      mw.full_name,
      mw.document_number,
      mw.resolved_job_title,
      mw.area_name
    ) as display_label
  from matching_workers mw
  left join blocked_workers bw
    on bw.buk_employee_id = mw.buk_employee_id
  where mw.identity_rank = 1
    and bw.buk_employee_id is null
  order by
    case
      when normalized_search <> '' and mw.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(mw.full_name) like normalized_search || '%' then 1
      when normalized_digits <> '' and mw.document_digits like normalized_digits || '%' then 2
      else 3
    end,
    mw.full_name asc
  limit safe_limit;
end;
$function$;

create or replace function public.search_hr_roster_workers(
  p_search text default null,
  p_limit integer default 12
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  document_type text,
  job_title text,
  contract_code text,
  area_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores de jornadas';
  end if;

  return query
  with matching_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      e.raw_payload,
      coalesce(
        nullif(trim(coalesce(e.document_number, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_number', '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'rut', '')), '')
      ) as document_number,
      coalesce(
        nullif(trim(coalesce(e.document_type, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_type', '')), ''),
        'rut'
      ) as document_type,
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key,
      row_number() over (
        partition by public.build_active_employee_identity_key(
          e.document_type,
          e.document_number,
          e.buk_employee_id,
          e.raw_payload
        )
        order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
      ) as identity_rank
    from public.employees e
    where e.is_active = true
      and (
        normalized_search = ''
        or public.build_active_employee_search_text(
          e.full_name,
          e.document_number,
          e.job_title,
          e.contract_code,
          e.area_name,
          e.raw_payload
        ) like '%' || normalized_search || '%'
      )
  )
  select
    mw.buk_employee_id,
    mw.full_name,
    mw.document_number,
    mw.document_type,
    mw.resolved_job_title as job_title,
    mw.contract_code,
    mw.area_name,
    concat_ws(
      ' | ',
      coalesce(mw.document_number, 'Sin RUT'),
      coalesce(mw.resolved_job_title, 'Sin cargo'),
      mw.full_name,
      coalesce(mw.area_name, mw.contract_code, 'Sin contrato')
    ) as display_label
  from matching_workers mw
  where mw.identity_rank = 1
  order by
    case
      when normalized_search <> '' and mw.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(mw.full_name) like normalized_search || '%' then 1
      else 2
    end,
    mw.full_name
  limit safe_limit;
end;
$function$;

create or replace function public.get_hr_roster_calendar_summary(
  p_month date default current_date,
  p_search text default null,
  p_contract_filter text default null,
  p_area_filter text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  target_month date := coalesce(p_month, current_date);
  month_start date := date_trunc('month', target_month)::date;
  month_end date := (date_trunc('month', target_month) + interval '1 month - 1 day')::date;
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_scope text := lower(trim(coalesce(nullif(p_area_filter, ''), nullif(p_contract_filter, ''), '')));
begin
  if not public.user_can_manage_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar el resumen de jornadas';
  end if;

  return (
    with matching_workers as (
      select
        e.buk_employee_id,
        nullif(trim(coalesce(e.area_name, e.contract_code)), '') as operational_scope,
        row_number() over (
          partition by public.build_active_employee_identity_key(
            e.document_type,
            e.document_number,
            e.buk_employee_id,
            e.raw_payload
          )
          order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
        ) as identity_rank
      from public.employees e
      where e.is_active = true
        and (
          normalized_search = ''
          or public.build_active_employee_search_text(
            e.full_name,
            e.document_number,
            e.job_title,
            e.contract_code,
            coalesce(e.area_name, e.contract_code),
            e.raw_payload
          ) like '%' || normalized_search || '%'
        )
    ),
    filtered_workers as (
      select mw.buk_employee_id
      from matching_workers mw
      where mw.identity_rank = 1
        and (
          normalized_scope = ''
          or lower(coalesce(mw.operational_scope, '')) = normalized_scope
        )
    ),
    assigned_workers as (
      select distinct wr.employee_buk_employee_id as buk_employee_id
      from public.hr_worker_rosters wr
      inner join filtered_workers fw
        on fw.buk_employee_id = wr.employee_buk_employee_id
      where wr.start_date <= month_end
        and coalesce(wr.end_date, 'infinity'::date) >= month_start
    )
    select jsonb_build_object(
      'month_start', month_start,
      'month_end', month_end,
      'assigned_count', (select count(*) from assigned_workers),
      'pending_count', (
        select count(*)
        from filtered_workers fw
        where not exists (
          select 1
          from assigned_workers aw
          where aw.buk_employee_id = fw.buk_employee_id
        )
      ),
      'total_count', (select count(*) from filtered_workers)
    )
  );
end;
$function$;

revoke all on function public.user_can_view_hiring_request_process_summary(uuid, uuid, text) from public, anon;
grant execute on function public.user_can_view_hiring_request_process_summary(uuid, uuid, text) to authenticated;
revoke all on function public.get_dashboard_operational_summary() from public, anon;
grant execute on function public.get_dashboard_operational_summary() to authenticated;

notify pgrst, 'reload schema';

commit;
