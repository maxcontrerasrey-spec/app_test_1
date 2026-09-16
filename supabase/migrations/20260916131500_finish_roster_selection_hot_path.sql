-- EEES-DB-005: approved
-- owner: Human Resources / Operations
-- rollback: forward-only; restore the prior cache trigger and summary RPC in a later audited migration.
begin;

alter table private.hr_incentive_worker_search_cache
  add column if not exists document_type text,
  add column if not exists contract_code text,
  add column if not exists is_private_role boolean not null default false;

create or replace function private.sync_hr_incentive_worker_search_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    delete from private.hr_incentive_worker_search_cache cache
    where cache.employee_id = old.id;
    return old;
  end if;

  if new.is_active is not true
     or nullif(trim(coalesce(new.buk_employee_id, '')), '') is null then
    delete from private.hr_incentive_worker_search_cache cache
    where cache.employee_id = new.id;
    return new;
  end if;

  insert into private.hr_incentive_worker_search_cache (
    employee_id,
    buk_employee_id,
    full_name,
    resolved_document_number,
    document_type,
    resolved_job_title,
    contract_code,
    area_name,
    normalized_area_name,
    name_search_key,
    identity_key,
    search_text,
    is_private_role,
    employee_updated_at,
    employee_created_at,
    cached_at
  )
  values (
    new.id,
    trim(new.buk_employee_id),
    new.full_name,
    coalesce(
      nullif(trim(coalesce(new.document_number, '')), ''),
      nullif(trim(coalesce(new.raw_payload ->> 'document_number', '')), ''),
      nullif(trim(coalesce(new.raw_payload ->> 'rut', '')), '')
    ),
    coalesce(nullif(trim(coalesce(new.document_type, '')), ''), 'rut'),
    public.resolve_active_employee_job_title(new.raw_payload, new.job_title),
    nullif(trim(coalesce(new.contract_code, '')), ''),
    nullif(trim(coalesce(new.area_name, '')), ''),
    public.normalize_buk_area_name(new.area_name),
    public.build_buk_employee_name_search_key(new.full_name, new.raw_payload),
    public.build_active_employee_identity_key(
      new.document_type,
      new.document_number,
      new.buk_employee_id,
      new.raw_payload
    ),
    public.build_active_employee_search_text(
      new.full_name,
      new.document_number,
      new.job_title,
      new.contract_code,
      new.area_name,
      new.raw_payload
    ),
    coalesce(lower(trim(new.raw_payload ->> 'private_role')), 'false')
      in ('true', '1', 'yes', 'si', 'sí'),
    new.updated_at,
    new.created_at,
    timezone('utc', now())
  )
  on conflict (employee_id) do update
  set
    buk_employee_id = excluded.buk_employee_id,
    full_name = excluded.full_name,
    resolved_document_number = excluded.resolved_document_number,
    document_type = excluded.document_type,
    resolved_job_title = excluded.resolved_job_title,
    contract_code = excluded.contract_code,
    area_name = excluded.area_name,
    normalized_area_name = excluded.normalized_area_name,
    name_search_key = excluded.name_search_key,
    identity_key = excluded.identity_key,
    search_text = excluded.search_text,
    is_private_role = excluded.is_private_role,
    employee_updated_at = excluded.employee_updated_at,
    employee_created_at = excluded.employee_created_at,
    cached_at = excluded.cached_at;

  return new;
end;
$function$;

revoke all on function private.sync_hr_incentive_worker_search_cache()
  from public, anon, authenticated;

update private.hr_incentive_worker_search_cache cache
set
  document_type = coalesce(nullif(trim(coalesce(e.document_type, '')), ''), 'rut'),
  contract_code = nullif(trim(coalesce(e.contract_code, '')), ''),
  is_private_role = coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false')
    in ('true', '1', 'yes', 'si', 'sí'),
  cached_at = timezone('utc', now())
from public.employees e
where e.id = cache.employee_id;

create index if not exists idx_hr_incentive_worker_search_cache_public_scope
  on private.hr_incentive_worker_search_cache (identity_key, employee_updated_at desc)
  where is_private_role = false;

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
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := public.normalize_recruitment_search_text(trim(coalesce(p_search, '')));
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
begin
  if not public.user_can_view_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores de jornadas';
  end if;

  return query
  with matching_workers as (
    select
      cache.*,
      row_number() over (
        partition by cache.identity_key
        order by
          cache.employee_updated_at desc nulls last,
          cache.employee_created_at desc nulls last,
          cache.buk_employee_id desc
      ) as identity_rank
    from private.hr_incentive_worker_search_cache cache
    where cache.is_private_role = false
      and (normalized_search = '' or cache.search_text like '%' || normalized_search || '%')
  )
  select
    mw.buk_employee_id,
    mw.full_name,
    mw.resolved_document_number,
    coalesce(mw.document_type, 'rut'),
    mw.resolved_job_title,
    mw.contract_code,
    mw.area_name,
    concat_ws(
      ' | ',
      coalesce(mw.resolved_document_number, 'Sin RUT'),
      coalesce(mw.resolved_job_title, 'Sin cargo'),
      mw.full_name,
      coalesce(mw.area_name, mw.contract_code, 'Sin contrato')
    )
  from matching_workers mw
  where mw.identity_rank = 1
  order by
    case
      when normalized_search <> '' and mw.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(mw.full_name) like normalized_search || '%' then 1
      else 2
    end,
    mw.full_name,
    mw.buk_employee_id
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
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  target_month date := coalesce(p_month, current_date);
  month_start date := date_trunc('month', target_month)::date;
  month_end date := (date_trunc('month', target_month) + interval '1 month - 1 day')::date;
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_contract text := lower(trim(coalesce(p_contract_filter, '')));
  normalized_area text := lower(trim(coalesce(p_area_filter, '')));
begin
  if not public.user_can_view_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar el resumen de jornadas';
  end if;

  return (
    with filtered_workers as materialized (
      select
        e.buk_employee_id,
        nullif(trim(e.contract_code), '') as contract_code,
        nullif(trim(e.area_name), '') as area_name
      from public.employees e
      where (e.is_active = true or e.buk_exit_date >= month_start)
        and coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') not in ('true', '1', 'yes', 'si', 'sí')
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
        and (
          normalized_contract = ''
          or public.normalize_buk_contract_code(e.contract_code)
             like '%' || public.normalize_buk_contract_code(normalized_contract) || '%'
        )
        and (
          normalized_area = ''
          or public.normalize_buk_area_name(coalesce(e.area_name, e.contract_code, ''))
             = public.normalize_buk_area_name(normalized_area)
        )
    ), worker_states as materialized (
      select
        fw.buk_employee_id,
        exists (
          select 1
          from public.hr_worker_rosters wr
          where wr.employee_buk_employee_id = fw.buk_employee_id
            and wr.start_date <= month_end
            and coalesce(wr.end_date, 'infinity'::date) >= month_start
            and public.hr_roster_assignment_applies_on_buk_date(
              wr.contract_code,
              wr.area_name,
              wr.invalidated_at,
              wr.invalidated_effective_date,
              fw.contract_code,
              fw.area_name,
              greatest(wr.start_date, month_start)
            )
        ) as is_assigned
      from filtered_workers fw
    )
    select jsonb_build_object(
      'month_start', month_start,
      'month_end', month_end,
      'assigned_count', count(*) filter (where ws.is_assigned),
      'pending_count', count(*) filter (where not ws.is_assigned),
      'total_count', count(*)
    )
    from worker_states ws
  );
end;
$function$;

revoke all on function public.search_hr_roster_workers(text, integer) from public, anon, authenticated;
grant execute on function public.search_hr_roster_workers(text, integer) to authenticated;
revoke all on function public.get_hr_roster_calendar_summary(date, text, text, text) from public, anon, authenticated;
grant execute on function public.get_hr_roster_calendar_summary(date, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
