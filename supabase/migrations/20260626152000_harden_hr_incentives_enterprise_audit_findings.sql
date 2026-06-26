begin;

create extension if not exists pg_trgm with schema public;

alter table public.hr_incentive_requests
  add column if not exists current_approver_name text null;

create or replace function public.build_hr_incentive_request_search_text(
  p_employee_full_name text,
  p_employee_document_number text,
  p_employee_job_title text,
  p_replacement_full_name text,
  p_selected_area_name text,
  p_selected_contract_code text,
  p_incentive_type_name text,
  p_current_approver_name text
)
returns text
language sql
immutable
as $function$
  select lower(
    btrim(
      coalesce(p_employee_full_name, '')
      || ' ' || coalesce(p_employee_document_number, '')
      || ' ' || coalesce(p_employee_job_title, '')
      || ' ' || coalesce(p_replacement_full_name, '')
      || ' ' || coalesce(p_selected_area_name, '')
      || ' ' || coalesce(p_selected_contract_code, '')
      || ' ' || coalesce(p_incentive_type_name, '')
      || ' ' || coalesce(p_current_approver_name, '')
    )
  );
$function$;

create or replace function public.sync_hr_incentive_request_current_approver(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  resolved_approver_name text;
begin
  if p_request_id is null then
    return;
  end if;

  select hira.approver_name
    into resolved_approver_name
  from public.hr_incentive_request_approvals hira
  where hira.incentive_request_id = p_request_id
    and hira.status = 'pending'
  order by hira.step_order asc, hira.created_at asc, hira.id asc
  limit 1;

  update public.hr_incentive_requests hir
     set current_approver_name = resolved_approver_name,
         updated_at = case
           when hir.current_approver_name is distinct from resolved_approver_name
             then timezone('utc', now())
           else hir.updated_at
         end
   where hir.id = p_request_id;
end;
$function$;

create or replace function public.trg_sync_hr_incentive_request_current_approver()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_request_id uuid;
begin
  target_request_id := case
    when tg_op = 'DELETE' then old.incentive_request_id
    else new.incentive_request_id
  end;

  perform public.sync_hr_incentive_request_current_approver(target_request_id);

  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_hr_incentive_request_approvals_sync_current_approver
  on public.hr_incentive_request_approvals;

create trigger trg_hr_incentive_request_approvals_sync_current_approver
after insert or update or delete
on public.hr_incentive_request_approvals
for each row
execute function public.trg_sync_hr_incentive_request_current_approver();

update public.hr_incentive_requests hir
   set current_approver_name = pending_approval.approver_name
  from (
    select distinct on (hira.incentive_request_id)
      hira.incentive_request_id,
      hira.approver_name
    from public.hr_incentive_request_approvals hira
    where hira.status = 'pending'
    order by hira.incentive_request_id, hira.step_order asc, hira.created_at asc, hira.id asc
  ) pending_approval
 where hir.id = pending_approval.incentive_request_id;

update public.hr_incentive_requests hir
   set current_approver_name = null
 where not exists (
   select 1
   from public.hr_incentive_request_approvals hira
   where hira.incentive_request_id = hir.id
     and hira.status = 'pending'
 )
   and hir.current_approver_name is not null;

create index if not exists idx_hr_incentive_request_approvals_pending_request_order
  on public.hr_incentive_request_approvals (
    incentive_request_id,
    step_order,
    created_at,
    id
  )
  where status = 'pending';

create index if not exists idx_employees_area_name_normalized_active
  on public.employees (public.normalize_buk_area_name(area_name))
  where is_active = true
    and nullif(trim(coalesce(area_name, '')), '') is not null;

create index if not exists idx_hr_incentive_requests_search_trgm
  on public.hr_incentive_requests
  using gin (
    (
      public.build_hr_incentive_request_search_text(
        employee_full_name,
        employee_document_number,
        employee_job_title,
        replacement_full_name,
        selected_area_name,
        selected_contract_code,
        incentive_type_name,
        current_approver_name
      )
    ) gin_trgm_ops
  );

create or replace function public.get_hr_incentive_requests(
  p_period_code text default null,
  p_statuses text[] default null,
  p_contract_codes text[] default null,
  p_worker_search text default null,
  p_type_ids uuid[] default null,
  p_service_date_until date default null,
  p_limit integer default null,
  p_offset integer default 0,
  p_sort_column text default null,
  p_sort_direction text default 'desc'
)
returns table (
  id uuid,
  folio bigint,
  employee_buk_employee_id text,
  employee_document_type text,
  employee_document_number text,
  employee_full_name text,
  employee_job_title text,
  employee_union_name text,
  employee_union_status text,
  employee_union_joined_at date,
  primary_contract_code text,
  primary_area_name text,
  selected_contract_code text,
  selected_area_name text,
  selected_area_code text,
  incentive_type_id uuid,
  incentive_type_name text,
  requires_replacement boolean,
  replacement_buk_employee_id text,
  replacement_document_number text,
  replacement_full_name text,
  motive text,
  description text,
  service_date timestamptz,
  duration_hours numeric,
  period_code text,
  calculation_basis text,
  rate_rule_id uuid,
  rate_rule_amount numeric,
  calculated_amount numeric,
  created_by uuid,
  requester_name text,
  requester_email text,
  status text,
  current_flow_user text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_comment text,
  created_at timestamptz,
  updated_at timestamptz,
  entry_lag_days integer,
  is_out_of_deadline boolean,
  is_contract_mismatch boolean,
  declared_rest_day boolean,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_worker_search, '')));
  normalized_contract_codes text[];
  normalized_type_ids uuid[];
  normalized_statuses text[];
  include_all_statuses boolean := false;
  normalized_sort_column text := lower(trim(coalesce(p_sort_column, '')));
  normalized_sort_direction text := case
    when lower(trim(coalesce(p_sort_direction, 'desc'))) = 'asc' then 'asc'
    else 'desc'
  end;
  resolved_limit integer := nullif(greatest(coalesce(p_limit, 0), 0), 0);
  resolved_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para ver incentivos';
  end if;

  select coalesce(array_agg(distinct trimmed_value), '{}'::text[])
    into normalized_contract_codes
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_contract_codes, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_contracts;

  select coalesce(array_agg(distinct raw_value), '{}'::uuid[])
    into normalized_type_ids
  from unnest(coalesce(p_type_ids, '{}'::uuid[])) as raw_value
  where raw_value is not null;

  select coalesce(array_agg(distinct upper(trimmed_value)), '{}'::text[])
    into normalized_statuses
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_statuses, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_statuses;

  include_all_statuses := 'A' = any(normalized_statuses);

  return query
  with filtered_requests as (
    select
      hir.id,
      hir.folio,
      hir.employee_buk_employee_id,
      hir.employee_document_type,
      hir.employee_document_number,
      hir.employee_full_name,
      hir.employee_job_title,
      hir.employee_union_name,
      hir.employee_union_status,
      hir.employee_union_joined_at,
      hir.primary_contract_code,
      hir.primary_area_name,
      hir.selected_contract_code,
      hir.selected_area_name,
      hir.selected_area_code,
      hir.incentive_type_id,
      hir.incentive_type_name,
      hir.requires_replacement,
      hir.replacement_buk_employee_id,
      hir.replacement_document_number,
      hir.replacement_full_name,
      hir.motive,
      hir.description,
      hir.service_date,
      hir.duration_hours,
      hir.period_code,
      hir.calculation_basis,
      hir.rate_rule_id,
      hir.rate_rule_amount,
      hir.calculated_amount,
      hir.created_by,
      coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible') as requester_name,
      requester_profile.email as requester_email,
      hir.status,
      hir.current_approver_name as current_flow_user,
      hir.cancelled_at,
      hir.cancelled_by,
      hir.cancellation_comment,
      hir.created_at,
      hir.updated_at,
      hir.entry_lag_days,
      hir.is_out_of_deadline,
      hir.is_contract_mismatch,
      hir.declared_rest_day
    from public.hr_incentive_requests hir
    left join public.profiles requester_profile
      on requester_profile.id = hir.created_by
    where
      (p_period_code is null or trim(p_period_code) = '' or hir.period_code = trim(p_period_code))
      and (
        coalesce(array_length(normalized_statuses, 1), 0) = 0
        or include_all_statuses
        or hir.status = any(normalized_statuses)
      )
      and (
        coalesce(array_length(normalized_contract_codes, 1), 0) = 0
        or hir.selected_contract_code = any(normalized_contract_codes)
      )
      and (
        coalesce(array_length(normalized_type_ids, 1), 0) = 0
        or hir.incentive_type_id = any(normalized_type_ids)
      )
      and (p_service_date_until is null or hir.service_date::date <= p_service_date_until)
      and (
        normalized_search = ''
        or public.build_hr_incentive_request_search_text(
          hir.employee_full_name,
          hir.employee_document_number,
          hir.employee_job_title,
          hir.replacement_full_name,
          hir.selected_area_name,
          hir.selected_contract_code,
          hir.incentive_type_name,
          hir.current_approver_name
        ) like '%' || normalized_search || '%'
      )
  ),
  filtered_count as (
    select count(*)::bigint as total_count
    from filtered_requests
  ),
  paged_requests as (
    select
      fr.*
    from filtered_requests fr
    order by
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'asc' then fr.folio end asc nulls last,
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'desc' then fr.folio end desc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'asc' then lower(fr.employee_full_name) end asc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'desc' then lower(fr.employee_full_name) end desc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'asc' then lower(fr.incentive_type_name) end asc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'desc' then lower(fr.incentive_type_name) end desc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'asc' then lower(fr.selected_area_name) end asc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'desc' then lower(fr.selected_area_name) end desc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'asc' then fr.service_date end asc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'desc' then fr.service_date end desc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'asc' then fr.calculated_amount end asc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'desc' then fr.calculated_amount end desc nulls last,
      case when normalized_sort_column = 'estado' and normalized_sort_direction = 'asc' then
        case fr.status
          when 'F' then 1
          when 'C' then 2
          when 'P' then 3
          when 'E' then 4
          when 'R' then 5
          else 99
        end
      end asc nulls last,
      case when normalized_sort_column = 'estado' and normalized_sort_direction = 'desc' then
        case fr.status
          when 'F' then 1
          when 'C' then 2
          when 'P' then 3
          when 'E' then 4
          when 'R' then 5
          else 99
        end
      end desc nulls last,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto', 'estado') then fr.created_at end desc,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto', 'estado') then fr.folio end desc,
      fr.id desc
    offset resolved_offset
    limit resolved_limit
  )
  select
    pr.id,
    pr.folio,
    pr.employee_buk_employee_id,
    pr.employee_document_type,
    pr.employee_document_number,
    pr.employee_full_name,
    pr.employee_job_title,
    pr.employee_union_name,
    pr.employee_union_status,
    pr.employee_union_joined_at,
    pr.primary_contract_code,
    pr.primary_area_name,
    pr.selected_contract_code,
    pr.selected_area_name,
    pr.selected_area_code,
    pr.incentive_type_id,
    pr.incentive_type_name,
    pr.requires_replacement,
    pr.replacement_buk_employee_id,
    pr.replacement_document_number,
    pr.replacement_full_name,
    pr.motive,
    pr.description,
    pr.service_date,
    pr.duration_hours,
    pr.period_code,
    pr.calculation_basis,
    pr.rate_rule_id,
    pr.rate_rule_amount,
    pr.calculated_amount,
    pr.created_by,
    pr.requester_name,
    pr.requester_email,
    pr.status,
    pr.current_flow_user,
    pr.cancelled_at,
    pr.cancelled_by,
    pr.cancellation_comment,
    pr.created_at,
    pr.updated_at,
    pr.entry_lag_days,
    pr.is_out_of_deadline,
    pr.is_contract_mismatch,
    pr.declared_rest_day,
    fc.total_count
  from paged_requests pr
  cross join filtered_count fc;
end;
$function$;

create or replace function public.get_hr_incentives_analytics(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_type_ids uuid[] default null,
  p_statuses text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_contract_codes text[];
  normalized_type_ids uuid[];
  normalized_statuses text[];
  include_all_statuses boolean := false;
begin
  if not public.user_can_view_hr_incentive_analytics(current_user_id) then
    raise exception 'Sin permisos para ver el analisis de incentivos';
  end if;

  select coalesce(array_agg(distinct trimmed_value), '{}'::text[])
    into normalized_contract_codes
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_contract_codes, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_contracts;

  select coalesce(array_agg(distinct raw_value), '{}'::uuid[])
    into normalized_type_ids
  from unnest(coalesce(p_type_ids, '{}'::uuid[])) as raw_value
  where raw_value is not null;

  select coalesce(array_agg(distinct upper(trimmed_value)), '{}'::text[])
    into normalized_statuses
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_statuses, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_statuses;

  include_all_statuses := 'A' = any(normalized_statuses);

  return (
    with base_requests as (
      select
        hir.id,
        hir.period_code,
        hir.selected_contract_code,
        hir.selected_area_name,
        hir.incentive_type_id,
        hir.incentive_type_name,
        hir.status,
        hir.calculated_amount,
        hir.employee_buk_employee_id,
        hir.employee_full_name,
        hir.declared_rest_day
      from public.hr_incentive_requests hir
    ),
    filtered_requests as (
      select *
      from base_requests br
      where
        (p_period_code is null or trim(p_period_code) = '' or br.period_code = trim(p_period_code))
        and (
          coalesce(array_length(normalized_contract_codes, 1), 0) = 0
          or br.selected_contract_code = any(normalized_contract_codes)
        )
        and (
          coalesce(array_length(normalized_type_ids, 1), 0) = 0
          or br.incentive_type_id = any(normalized_type_ids)
        )
        and (
          coalesce(array_length(normalized_statuses, 1), 0) = 0
          or include_all_statuses
          or br.status = any(normalized_statuses)
        )
    ),
    summary as (
      select
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as total_amount,
        count(*)::int as request_count,
        count(*) filter (where fr.status = 'F')::int as approved_count,
        count(*) filter (where fr.status = 'R')::int as rejected_count,
        count(*) filter (where fr.declared_rest_day is true)::int as declared_rest_day_count
      from filtered_requests fr
    ),
    amount_by_period as (
      select
        fr.period_code,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as total_amount,
        count(*)::int as request_count,
        coalesce(sum(fr.calculated_amount) filter (where fr.status = 'F'), 0)::numeric(14,2) as approved_amount,
        coalesce(sum(fr.calculated_amount) filter (where fr.status = 'R'), 0)::numeric(14,2) as rejected_amount
      from filtered_requests fr
      group by fr.period_code
      order by fr.period_code asc
    ),
    amount_by_type as (
      select
        fr.incentive_type_id,
        fr.incentive_type_name,
        count(*)::int as request_count,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as total_amount
      from filtered_requests fr
      group by fr.incentive_type_id, fr.incentive_type_name
      order by total_amount desc, fr.incentive_type_name asc
    ),
    amount_by_contract as (
      select
        fr.selected_contract_code as contract_code,
        max(fr.selected_area_name) as area_name,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as total_amount
      from filtered_requests fr
      group by fr.selected_contract_code
      order by total_amount desc, fr.selected_contract_code asc
    ),
    amount_by_worker_contracts as (
      select
        fr.employee_buk_employee_id as worker_id,
        max(fr.employee_full_name) as worker_name,
        fr.selected_contract_code as contract_code,
        max(fr.selected_area_name) as area_name,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as amount
      from filtered_requests fr
      group by fr.employee_buk_employee_id, fr.selected_contract_code
    ),
    amount_by_worker as (
      select
        awc.worker_id,
        max(awc.worker_name) as worker_name,
        coalesce(sum(awc.amount), 0)::numeric(14,2) as total_amount,
        jsonb_agg(
          jsonb_build_object(
            'contract_code', awc.contract_code,
            'contract_label',
              coalesce(
                nullif(trim(awc.area_name), ''),
                nullif(trim(awc.contract_code), ''),
                'Sin contrato'
              ),
            'amount', awc.amount
          )
          order by awc.amount desc, awc.contract_code asc
        ) as contracts
      from amount_by_worker_contracts awc
      group by awc.worker_id
      order by total_amount desc, max(awc.worker_name) asc
      limit 10
    )
    select jsonb_build_object(
      'summary_cards',
      jsonb_build_object(
        'total_amount', coalesce((select total_amount from summary), 0),
        'request_count', coalesce((select request_count from summary), 0),
        'approved_count', coalesce((select approved_count from summary), 0),
        'rejected_count', coalesce((select rejected_count from summary), 0),
        'approval_rate',
          case
            when coalesce((select request_count from summary), 0) = 0 then 0
            else round(
              ((select approved_count from summary)::numeric / (select request_count from summary)::numeric) * 100,
              2
            )
          end,
        'rejection_rate',
          case
            when coalesce((select request_count from summary), 0) = 0 then 0
            else round(
              ((select rejected_count from summary)::numeric / (select request_count from summary)::numeric) * 100,
              2
            )
          end,
        'declared_rest_day_count', coalesce((select declared_rest_day_count from summary), 0)
      ),
      'total_amount_by_period',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'period_code', abp.period_code,
            'total_amount', abp.total_amount,
            'request_count', abp.request_count,
            'approved_amount', abp.approved_amount,
            'rejected_amount', abp.rejected_amount
          )
          order by abp.period_code asc
        )
        from amount_by_period abp
      ), '[]'::jsonb),
      'count_by_incentive_type',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'incentive_type_id', abt.incentive_type_id,
            'incentive_type_name', abt.incentive_type_name,
            'request_count', abt.request_count,
            'total_amount', abt.total_amount
          )
          order by abt.total_amount desc, abt.incentive_type_name asc
        )
        from amount_by_type abt
      ), '[]'::jsonb),
      'amount_by_contract',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'contract_code', abc.contract_code,
            'area_name', abc.area_name,
            'total_amount', abc.total_amount
          )
          order by abc.total_amount desc, abc.contract_code asc
        )
        from amount_by_contract abc
      ), '[]'::jsonb),
      'amount_by_worker',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'worker_name', abw.worker_name,
            'total_amount', abw.total_amount,
            'contracts', abw.contracts
          )
          order by abw.total_amount desc, abw.worker_name asc
        )
        from amount_by_worker abw
      ), '[]'::jsonb),
      'filter_options',
      jsonb_build_object(
        'contracts',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'value', fr.selected_contract_code,
              'label', coalesce(fr.selected_area_name, fr.selected_contract_code) || ' · ' || fr.selected_contract_code
            )
            order by fr.selected_area_name asc, fr.selected_contract_code asc
          )
          from (
            select distinct
              br.selected_contract_code,
              br.selected_area_name
            from base_requests br
            where br.selected_contract_code is not null
              and br.selected_contract_code <> ''
          ) fr
        ), '[]'::jsonb),
        'types',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'value', fr.incentive_type_id,
              'label', fr.incentive_type_name
            )
            order by fr.incentive_type_name asc
          )
          from (
            select distinct
              br.incentive_type_id,
              br.incentive_type_name
            from base_requests br
          ) fr
        ), '[]'::jsonb),
        'statuses',
        jsonb_build_array(
          jsonb_build_object('value', 'A', 'label', 'Todos'),
          jsonb_build_object('value', 'P', 'label', 'Pendiente administrador contrato'),
          jsonb_build_object('value', 'E', 'label', 'Pendiente gerente de area'),
          jsonb_build_object('value', 'R', 'label', 'Rechazado'),
          jsonb_build_object('value', 'F', 'label', 'Aprobado'),
          jsonb_build_object('value', 'C', 'label', 'Anulado')
        )
      )
    )
  );
end;
$function$;

revoke all on function public.sync_hr_incentive_request_current_approver(uuid) from public, anon, authenticated;
revoke all on function public.trg_sync_hr_incentive_request_current_approver() from public, anon, authenticated;
revoke all on function public.build_hr_incentive_request_search_text(text, text, text, text, text, text, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
