-- EEES-DB-005: approved
-- owner: Engineering and Human Resources
-- rollback: forward-only; remove the private cache and restore the prior implementations in a later migration.

begin;

create table if not exists private.hr_incentive_worker_search_cache (
  employee_id uuid primary key
    references public.employees(id) on delete cascade,
  buk_employee_id text not null,
  full_name text,
  resolved_document_number text,
  resolved_job_title text not null,
  area_name text,
  normalized_area_name text,
  name_search_key text not null,
  identity_key text not null,
  search_text text not null,
  employee_updated_at timestamptz,
  employee_created_at timestamptz,
  cached_at timestamptz not null default timezone('utc', now())
);

alter table private.hr_incentive_worker_search_cache enable row level security;
revoke all on table private.hr_incentive_worker_search_cache from public, anon, authenticated;

create index if not exists idx_hr_incentive_worker_search_cache_trgm
  on private.hr_incentive_worker_search_cache
  using gin (search_text gin_trgm_ops);

create index if not exists idx_hr_incentive_worker_search_cache_title
  on private.hr_incentive_worker_search_cache (
    upper(trim(resolved_job_title))
  );

create index if not exists idx_hr_incentive_worker_search_cache_identity
  on private.hr_incentive_worker_search_cache (
    identity_key,
    employee_updated_at desc,
    employee_created_at desc,
    buk_employee_id desc
  );

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
    resolved_job_title,
    area_name,
    normalized_area_name,
    name_search_key,
    identity_key,
    search_text,
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
    public.resolve_active_employee_job_title(new.raw_payload, new.job_title),
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
    new.updated_at,
    new.created_at,
    timezone('utc', now())
  )
  on conflict (employee_id) do update
  set
    buk_employee_id = excluded.buk_employee_id,
    full_name = excluded.full_name,
    resolved_document_number = excluded.resolved_document_number,
    resolved_job_title = excluded.resolved_job_title,
    area_name = excluded.area_name,
    normalized_area_name = excluded.normalized_area_name,
    name_search_key = excluded.name_search_key,
    identity_key = excluded.identity_key,
    search_text = excluded.search_text,
    employee_updated_at = excluded.employee_updated_at,
    employee_created_at = excluded.employee_created_at,
    cached_at = excluded.cached_at;

  return new;
end;
$function$;

revoke all on function private.sync_hr_incentive_worker_search_cache()
  from public, anon, authenticated;

drop trigger if exists trg_sync_hr_incentive_worker_search_cache
  on public.employees;

create trigger trg_sync_hr_incentive_worker_search_cache
after insert or delete or update of
  buk_employee_id,
  full_name,
  document_number,
  document_type,
  job_title,
  contract_code,
  area_name,
  raw_payload,
  is_active,
  updated_at
on public.employees
for each row
execute function private.sync_hr_incentive_worker_search_cache();

insert into private.hr_incentive_worker_search_cache (
  employee_id,
  buk_employee_id,
  full_name,
  resolved_document_number,
  resolved_job_title,
  area_name,
  normalized_area_name,
  name_search_key,
  identity_key,
  search_text,
  employee_updated_at,
  employee_created_at,
  cached_at
)
select
  e.id,
  trim(e.buk_employee_id),
  e.full_name,
  coalesce(
    nullif(trim(coalesce(e.document_number, '')), ''),
    nullif(trim(coalesce(e.raw_payload ->> 'document_number', '')), ''),
    nullif(trim(coalesce(e.raw_payload ->> 'rut', '')), '')
  ),
  public.resolve_active_employee_job_title(e.raw_payload, e.job_title),
  nullif(trim(coalesce(e.area_name, '')), ''),
  public.normalize_buk_area_name(e.area_name),
  public.build_buk_employee_name_search_key(e.full_name, e.raw_payload),
  public.build_active_employee_identity_key(
    e.document_type,
    e.document_number,
    e.buk_employee_id,
    e.raw_payload
  ),
  public.build_active_employee_search_text(
    e.full_name,
    e.document_number,
    e.job_title,
    e.contract_code,
    e.area_name,
    e.raw_payload
  ),
  e.updated_at,
  e.created_at,
  timezone('utc', now())
from public.employees e
where e.is_active is true
  and nullif(trim(coalesce(e.buk_employee_id, '')), '') is not null
on conflict (employee_id) do update
set
  buk_employee_id = excluded.buk_employee_id,
  full_name = excluded.full_name,
  resolved_document_number = excluded.resolved_document_number,
  resolved_job_title = excluded.resolved_job_title,
  area_name = excluded.area_name,
  normalized_area_name = excluded.normalized_area_name,
  name_search_key = excluded.name_search_key,
  identity_key = excluded.identity_key,
  search_text = excluded.search_text,
  employee_updated_at = excluded.employee_updated_at,
  employee_created_at = excluded.employee_created_at,
  cached_at = excluded.cached_at;

create or replace function public.hr_incentive_worker_search_impl(
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
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := public.normalize_recruitment_search_text(
    trim(coalesce(p_search, ''))
  );
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
      cache.*,
      row_number() over (
        partition by cache.identity_key
        order by
          cache.employee_updated_at desc nulls last,
          cache.employee_created_at desc nulls last,
          cache.buk_employee_id desc
      ) as identity_rank
    from private.hr_incentive_worker_search_cache cache
    where normalized_search = ''
       or cache.search_text like '%' || normalized_search || '%'
  ),
  operable_workers as (
    select
      mw.buk_employee_id,
      mw.full_name,
      mw.resolved_document_number,
      mw.resolved_job_title,
      c.code as contract_code,
      coalesce(
        nullif(trim(bcm.buk_area_name), ''),
        mw.normalized_area_name,
        mw.area_name
      ) as resolved_area_name,
      mw.name_search_key
    from matching_workers mw
    join eligible_titles et
      on upper(trim(mw.resolved_job_title)) = et.normalized_job_title
    left join public.buk_contract_mappings bcm
      on bcm.buk_area_name_normalized = mw.normalized_area_name
     and bcm.is_operational = true
     and bcm.is_one_to_one = true
     and bcm.contract_id is not null
    left join public.contracts c
      on c.id = bcm.contract_id
     and c.is_active = true
    where mw.identity_rank = 1
  )
  select
    ow.buk_employee_id,
    ow.full_name,
    ow.resolved_document_number,
    ow.resolved_job_title,
    ow.contract_code,
    ow.resolved_area_name,
    concat_ws(
      ' | ',
      coalesce(ow.resolved_document_number, 'Sin RUT'),
      coalesce(ow.resolved_job_title, 'Sin cargo'),
      ow.full_name,
      coalesce(ow.resolved_area_name, ow.contract_code, 'Sin contrato')
    )
  from operable_workers ow
  order by
    case
      when normalized_search <> '' and ow.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(ow.full_name) like normalized_search || '%' then 1
      else 2
    end,
    ow.full_name,
    ow.buk_employee_id
  limit safe_limit;
end;
$function$;

revoke all on function public.hr_incentive_worker_search_impl(text, integer)
  from public, anon, authenticated;

alter function public.hr_incentive_decide_approval_impl(bigint, text, text)
  rename to hr_incentive_decide_approval_once_impl_20260915;

revoke all on function public.hr_incentive_decide_approval_once_impl_20260915(
  bigint,
  text,
  text
) from public, anon, authenticated;

create function public.hr_incentive_decide_approval_impl(
  p_approval_id bigint,
  p_decision text,
  p_comment text default null
)
returns table (
  request_id uuid,
  request_status text,
  decided_step text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  existing_approval record;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select
    hira.incentive_request_id,
    hira.step_code,
    hira.status,
    hira.decision_by,
    hir.status as request_status
  into existing_approval
  from public.hr_incentive_request_approvals hira
  join public.hr_incentive_requests hir
    on hir.id = hira.incentive_request_id
  where hira.id = p_approval_id;

  if existing_approval.incentive_request_id is not null
     and existing_approval.status = p_decision
     and existing_approval.decision_by = current_user_id then
    return query
    select
      existing_approval.incentive_request_id::uuid,
      existing_approval.request_status::text,
      existing_approval.step_code::text;
    return;
  end if;

  return query
  select *
  from public.hr_incentive_decide_approval_once_impl_20260915(
    p_approval_id,
    p_decision,
    p_comment
  );
end;
$function$;

revoke all on function public.hr_incentive_decide_approval_impl(bigint, text, text)
  from public, anon, authenticated;

create or replace function public.hr_incentive_bulk_decide_impl(
  p_approval_ids bigint[],
  p_decision text,
  p_comment text default null
)
returns table (
  approval_id bigint,
  request_id uuid,
  success boolean,
  request_status text,
  error text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_approval_ids bigint[];
  current_approval_id bigint;
  decision_row record;
  expected_approval_count integer;
  failure_message text;
  failure_state text;
  locked_request_id uuid;
begin
  normalized_approval_ids := array(
    select distinct selected_approval_id
    from unnest(coalesce(p_approval_ids, '{}'::bigint[])) as selected_ids(selected_approval_id)
    where selected_approval_id is not null
    order by selected_approval_id
  );

  expected_approval_count := coalesce(array_length(normalized_approval_ids, 1), 0);

  if expected_approval_count = 0 then
    raise exception 'Debe seleccionar al menos una aprobación';
  end if;

  if expected_approval_count > 100 then
    raise exception 'El lote excede el máximo de 100 aprobaciones';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decisión inválida';
  end if;

  if p_decision = 'rejected'
     and nullif(trim(coalesce(p_comment, '')), '') is null then
    raise exception 'Debe indicar un comentario al rechazar incentivos';
  end if;

  foreach current_approval_id in array normalized_approval_ids
  loop
    begin
      locked_request_id := null;
      select hira.incentive_request_id
      into locked_request_id
      from public.hr_incentive_request_approvals hira
      where hira.id = current_approval_id
      for update skip locked;

      if locked_request_id is null then
        raise exception
          'La aprobación ya no existe o está siendo procesada por otro usuario';
      end if;

      select *
      into strict decision_row
      from public.hr_incentive_decide_approval_impl(
        current_approval_id,
        p_decision,
        p_comment
      );

      approval_id := current_approval_id;
      request_id := decision_row.request_id;
      success := true;
      request_status := decision_row.request_status;
      error := null;
      return next;
    exception
      when others then
        get stacked diagnostics
          failure_message = message_text,
          failure_state = returned_sqlstate;

        approval_id := current_approval_id;
        select hira.incentive_request_id
        into request_id
        from public.hr_incentive_request_approvals hira
        where hira.id = current_approval_id;
        success := false;
        request_status := null;
        error := case
          when failure_state in ('P0001', 'P0002', '23503', '23505', '23514')
            then failure_message
          else 'No fue posible procesar esta aprobación.'
        end;
        return next;
    end;
  end loop;
end;
$function$;

revoke all on function public.hr_incentive_bulk_decide_impl(bigint[], text, text)
  from public, anon, authenticated;

create or replace function public.hr_incentive_approval_queue_impl(
  p_search text default null,
  p_limit integer default null,
  p_offset integer default 0,
  p_sort_column text default null,
  p_sort_direction text default 'asc'
)
returns table (
  approval_id bigint,
  request_id uuid,
  folio bigint,
  step_code text,
  step_name text,
  step_order integer,
  approval_status text,
  approver_user_id uuid,
  approver_name text,
  employee_full_name text,
  employee_document_number text,
  employee_job_title text,
  employee_union_name text,
  selected_contract_code text,
  selected_area_name text,
  incentive_type_name text,
  service_date timestamptz,
  calculated_amount numeric,
  period_code text,
  entry_lag_days integer,
  is_out_of_deadline boolean,
  is_contract_mismatch boolean,
  requester_name text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  can_view_all boolean := false;
  normalized_search text := public.normalize_recruitment_search_text(
    trim(coalesce(p_search, ''))
  );
  normalized_sort_column text := lower(trim(coalesce(p_sort_column, '')));
  normalized_sort_direction text := case
    when lower(trim(coalesce(p_sort_direction, 'asc'))) = 'desc' then 'desc'
    else 'asc'
  end;
  resolved_limit integer := greatest(1, least(coalesce(nullif(p_limit, 0), 50), 100));
  resolved_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_view_all := public.user_is_admin(current_user_id);

  return query
  with matching_request_ids as materialized (
    select hir.id as request_id
    from public.hr_incentive_requests hir
    where normalized_search <> ''
      and public.build_hr_incentive_request_search_text(
        hir.employee_full_name,
        hir.employee_document_number,
        hir.employee_job_title,
        hir.replacement_full_name,
        hir.selected_area_name,
        hir.selected_contract_code,
        hir.incentive_type_name,
        hir.current_approver_name
      ) like '%' || normalized_search || '%'

    union

    select hir.id as request_id
    from public.hr_incentive_requests hir
    join public.profiles requester_profile
      on requester_profile.id = hir.created_by
    where normalized_search <> ''
      and public.normalize_recruitment_search_text(
        concat_ws(' ', requester_profile.full_name, requester_profile.email)
      ) like '%' || normalized_search || '%'
  ),
  filtered_queue as (
    select
      hira.id as approval_id,
      hir.id as request_id,
      hir.folio,
      hira.step_code,
      hira.step_name,
      hira.step_order,
      hira.status as approval_status,
      hira.approver_user_id,
      hira.approver_name,
      hir.employee_full_name,
      hir.employee_document_number,
      hir.employee_job_title,
      hir.employee_union_name,
      hir.selected_contract_code,
      hir.selected_area_name,
      hir.incentive_type_name,
      hir.service_date,
      hir.calculated_amount,
      hir.period_code,
      hir.entry_lag_days,
      hir.is_out_of_deadline,
      hir.is_contract_mismatch,
      coalesce(
        requester_profile.full_name,
        requester_profile.email,
        'Usuario no disponible'
      ) as requester_name,
      hir.created_at
    from public.hr_incentive_request_approvals hira
    join public.hr_incentive_requests hir
      on hir.id = hira.incentive_request_id
    left join public.profiles requester_profile
      on requester_profile.id = hir.created_by
    where hira.status = 'pending'
      and (can_view_all or hira.approver_user_id = current_user_id)
      and (
        normalized_search = ''
        or exists (
          select 1
          from matching_request_ids match
          where match.request_id = hir.id
        )
        or public.normalize_recruitment_search_text(
          case hira.step_code
            when 'contract_admin' then 'administrador de contrato'
            when 'area_manager' then 'gerente de area'
            else hira.step_code
          end
        ) like '%' || normalized_search || '%'
      )
  ),
  ordered_queue as (
    select
      fq.*,
      count(*) over () as total_count
    from filtered_queue fq
    order by
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'asc' then fq.folio end asc nulls last,
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'desc' then fq.folio end desc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'asc' then lower(fq.employee_full_name) end asc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'desc' then lower(fq.employee_full_name) end desc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'asc' then lower(fq.incentive_type_name) end asc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'desc' then lower(fq.incentive_type_name) end desc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'asc' then lower(fq.selected_area_name) end asc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'desc' then lower(fq.selected_area_name) end desc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'asc' then fq.service_date end asc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'desc' then fq.service_date end desc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'asc' then fq.calculated_amount end asc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'desc' then fq.calculated_amount end desc nulls last,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto') then fq.step_order end asc,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto') then fq.service_date end asc,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto') then fq.created_at end asc,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto') then fq.folio end asc,
      fq.approval_id asc
    offset resolved_offset
    limit resolved_limit
  )
  select *
  from ordered_queue;
end;
$function$;

revoke all on function public.hr_incentive_approval_queue_impl(
  text,
  integer,
  integer,
  text,
  text
) from public, anon, authenticated;

alter function public.hr_incentive_request_detail_impl(uuid)
  rename to hr_incentive_request_detail_unscoped_impl_20260915;

revoke all on function public.hr_incentive_request_detail_unscoped_impl_20260915(uuid)
  from public, anon, authenticated;

create function public.hr_incentive_request_detail_impl(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_is_admin(current_user_id)
     and not public.user_can_access_feature(current_user_id, 'hr_incentives_history')
     and not exists (
       select 1
       from public.hr_incentive_request_approvals hira
       where hira.incentive_request_id = p_request_id
         and hira.approver_user_id = current_user_id
     ) then
    raise exception 'Sin permisos para ver el detalle del incentivo';
  end if;

  return public.hr_incentive_request_detail_unscoped_impl_20260915(p_request_id);
end;
$function$;

revoke all on function public.hr_incentive_request_detail_impl(uuid)
  from public, anon, authenticated;

create or replace function public.get_hr_incentive_worker_context(p_buk_employee_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  payload jsonb;
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_register']);
  payload := public.hr_incentive_worker_context_impl(p_buk_employee_id);

  if jsonb_typeof(payload -> 'worker') = 'object' then
    payload := jsonb_set(
      payload,
      '{worker}',
      (payload -> 'worker') - 'base_salary' - 'weekly_hours'
    );
  end if;

  return payload;
end;
$function$;

revoke all on function public.reconcile_hr_roster_extra_shift_from_incentives(
  text,
  date,
  text,
  text,
  text
) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
