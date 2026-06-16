begin;

create or replace function public.audit_hr_incentive_period_folio_integrity(
  p_period_code text default null
)
returns table (
  issue_code text,
  period_code text,
  folio bigint,
  request_count bigint,
  request_ids uuid[],
  details jsonb
)
language sql
security definer
set search_path = public
as $function$
  with normalized_period as (
    select nullif(trim(coalesce(p_period_code, '')), '') as period_code
  ),
  duplicate_folios as (
    select
      'duplicate_folio_in_period'::text as issue_code,
      hir.period_code,
      hir.folio,
      count(*)::bigint as request_count,
      array_agg(hir.id order by hir.created_at asc, hir.id asc) as request_ids,
      jsonb_build_object(
        'statuses', array_agg(hir.status order by hir.created_at asc, hir.id asc),
        'service_dates',
          array_agg(
            timezone('America/Santiago', hir.service_date)::date
            order by hir.created_at asc, hir.id asc
          ),
        'selected_contract_codes',
          array_agg(hir.selected_contract_code order by hir.created_at asc, hir.id asc)
      ) as details
    from public.hr_incentive_requests hir
    cross join normalized_period np
    where np.period_code is null or hir.period_code = np.period_code
    group by hir.period_code, hir.folio
    having count(*) > 1
  ),
  mismatched_periods as (
    select
      'service_date_period_mismatch'::text as issue_code,
      hir.period_code,
      hir.folio,
      1::bigint as request_count,
      array[hir.id]::uuid[] as request_ids,
      jsonb_build_object(
        'service_date', timezone('America/Santiago', hir.service_date)::date,
        'expected_period_code', public.resolve_hr_incentive_period_code(hir.service_date),
        'status', hir.status,
        'selected_contract_code', hir.selected_contract_code
      ) as details
    from public.hr_incentive_requests hir
    cross join normalized_period np
    where (np.period_code is null or hir.period_code = np.period_code)
      and hir.period_code <> public.resolve_hr_incentive_period_code(hir.service_date)
  )
  select *
  from duplicate_folios
  union all
  select *
  from mismatched_periods
  order by period_code asc, folio asc, issue_code asc;
$function$;

create or replace function public.assert_hr_incentive_period_folio_integrity(
  p_period_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_period_code text := nullif(trim(coalesce(p_period_code, '')), '');
  anomaly_summary text;
begin
  select string_agg(
           format(
             '[%s] periodo=%s folio=%s cantidad=%s',
             anomaly.issue_code,
             coalesce(anomaly.period_code, '(null)'),
             coalesce(anomaly.folio::text, '(null)'),
             anomaly.request_count::text
           ),
           '; '
           order by anomaly.period_code asc, anomaly.folio asc, anomaly.issue_code asc
         )
  into anomaly_summary
  from (
    select *
    from public.audit_hr_incentive_period_folio_integrity(normalized_period_code)
    limit 10
  ) anomaly;

  if anomaly_summary is not null then
    raise exception
      'Auditoria de integridad de incentivos fallida para periodo %: %',
      coalesce(normalized_period_code, 'TODOS'),
      anomaly_summary;
  end if;
end;
$function$;

create or replace function public.run_hr_incentive_period_folio_integrity_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public.assert_hr_incentive_period_folio_integrity(new.period_code);

  if tg_op = 'UPDATE' and old.period_code is distinct from new.period_code then
    perform public.assert_hr_incentive_period_folio_integrity(old.period_code);
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_hr_incentive_requests_period_integrity_audit on public.hr_incentive_requests;
create trigger trg_hr_incentive_requests_period_integrity_audit
after insert or update of period_code, service_date on public.hr_incentive_requests
for each row
execute function public.run_hr_incentive_period_folio_integrity_audit();

create or replace function public.get_hr_incentive_requests(
  p_period_code text default null,
  p_statuses text[] default null,
  p_contract_codes text[] default null,
  p_worker_search text default null,
  p_type_ids uuid[] default null,
  p_service_date_until date default null
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
  declared_rest_day boolean
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
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para ver incentivos';
  end if;

  perform public.assert_hr_incentive_period_folio_integrity(p_period_code);

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
    pending_approval.approver_name as current_flow_user,
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
  left join lateral (
    select
      hira.approver_name
    from public.hr_incentive_request_approvals hira
    where hira.incentive_request_id = hir.id
      and hira.status = 'pending'
    order by hira.step_order asc, hira.created_at asc
    limit 1
  ) pending_approval on true
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
      or lower(
        concat_ws(
          ' ',
          hir.employee_full_name,
          coalesce(hir.employee_document_number, ''),
          coalesce(hir.employee_job_title, ''),
          coalesce(hir.replacement_full_name, ''),
          coalesce(hir.selected_area_name, ''),
          coalesce(hir.selected_contract_code, ''),
          coalesce(hir.incentive_type_name, ''),
          coalesce(pending_approval.approver_name, '')
        )
      ) like '%' || normalized_search || '%'
    )
  order by hir.created_at desc, hir.folio desc;
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

  perform public.assert_hr_incentive_period_folio_integrity(p_period_code);

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
      limit 12
    ),
    worker_contract_amounts as (
      select
        coalesce(nullif(trim(fr.employee_full_name), ''), 'Trabajador no disponible') as worker_name,
        coalesce(nullif(trim(fr.selected_contract_code), ''), 'SIN-CONTRATO') as contract_code,
        coalesce(
          nullif(trim(fr.selected_area_name), ''),
          nullif(trim(fr.selected_contract_code), ''),
          'SIN-CONTRATO'
        ) as contract_label,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as amount
      from filtered_requests fr
      group by
        coalesce(nullif(trim(fr.employee_full_name), ''), 'Trabajador no disponible'),
        coalesce(nullif(trim(fr.selected_contract_code), ''), 'SIN-CONTRATO'),
        coalesce(
          nullif(trim(fr.selected_area_name), ''),
          nullif(trim(fr.selected_contract_code), ''),
          'SIN-CONTRATO'
        )
    ),
    amount_by_worker as (
      select
        wca.worker_name,
        coalesce(sum(wca.amount), 0)::numeric(14,2) as total_amount
      from worker_contract_amounts wca
      group by wca.worker_name
      order by total_amount desc, wca.worker_name asc
      limit 12
    ),
    contract_options as (
      select distinct
        br.selected_contract_code as value,
        coalesce(br.selected_area_name, br.selected_contract_code) || ' · ' || br.selected_contract_code as label
      from base_requests br
      where br.selected_contract_code is not null
        and br.selected_contract_code <> ''
      order by label asc
    ),
    type_options as (
      select distinct
        br.incentive_type_id::text as value,
        br.incentive_type_name as label
      from base_requests br
      where br.incentive_type_id is not null
      order by label asc
    )
    select jsonb_build_object(
      'summary_cards',
      (
        select jsonb_build_object(
          'total_amount', s.total_amount,
          'request_count', s.request_count,
          'approved_count', s.approved_count,
          'rejected_count', s.rejected_count,
          'declared_rest_day_count', s.declared_rest_day_count,
          'approval_rate',
            case
              when s.request_count = 0 then 0
              else round((s.approved_count::numeric / s.request_count::numeric) * 100, 1)
            end,
          'rejection_rate',
            case
              when s.request_count = 0 then 0
              else round((s.rejected_count::numeric / s.request_count::numeric) * 100, 1)
            end
        )
        from summary s
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
            'contracts',
            coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'contract_code', wca.contract_code,
                  'contract_label', wca.contract_label,
                  'amount', wca.amount
                )
                order by wca.amount desc, wca.contract_label asc
              )
              from worker_contract_amounts wca
              where wca.worker_name = abw.worker_name
            ), '[]'::jsonb)
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
              'value', co.value,
              'label', co.label
            )
            order by co.label asc
          )
          from contract_options co
        ), '[]'::jsonb),
        'types',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'value', "to".value,
              'label', "to".label
            )
            order by "to".label asc
          )
          from type_options "to"
        ), '[]'::jsonb),
        'statuses',
        jsonb_build_array(
          jsonb_build_object('value', 'P', 'label', 'Pendiente'),
          jsonb_build_object('value', 'E', 'label', 'En aprobacion'),
          jsonb_build_object('value', 'F', 'label', 'Aprobado'),
          jsonb_build_object('value', 'R', 'label', 'Rechazado'),
          jsonb_build_object('value', 'C', 'label', 'Anulado')
        )
      )
    )
  );
end;
$function$;

create or replace function public.get_hr_incentive_approval_queue()
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
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_view_all boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_view_all := public.user_can_manage_hr_incentives(current_user_id);

  if not can_view_all and not exists (
    select 1
    from public.hr_incentive_request_approvals hira
    where hira.approver_user_id = current_user_id
      and hira.status = 'pending'
  ) then
    raise exception 'Sin permisos para ver aprobaciones de incentivos';
  end if;

  perform public.assert_hr_incentive_period_folio_integrity(null);

  return query
  select
    hira.id,
    hir.id,
    hir.folio,
    hira.step_code,
    hira.step_name,
    hira.step_order,
    hira.status,
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
    coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible') as requester_name,
    hir.created_at
  from public.hr_incentive_request_approvals hira
  join public.hr_incentive_requests hir
    on hir.id = hira.incentive_request_id
  left join public.profiles requester_profile
    on requester_profile.id = hir.created_by
  where hira.status = 'pending'
    and (can_view_all or hira.approver_user_id = current_user_id)
  order by hira.step_order asc, hir.service_date asc, hir.created_at asc, hir.folio asc;
end;
$function$;

create or replace function public.get_hr_incentive_request_detail(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_view_request boolean := false;
  request_payload jsonb;
  request_period_code text;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_view_request :=
    public.user_can_manage_hr_incentives(current_user_id)
    or exists (
      select 1
      from public.hr_incentive_request_approvals hira
      where hira.incentive_request_id = p_request_id
        and hira.approver_user_id = current_user_id
    );

  if not can_view_request then
    raise exception 'Sin permisos para ver el detalle del incentivo';
  end if;

  select hir.period_code
  into request_period_code
  from public.hr_incentive_requests hir
  where hir.id = p_request_id
  limit 1;

  if request_period_code is null then
    raise exception 'No existe el incentivo solicitado';
  end if;

  perform public.assert_hr_incentive_period_folio_integrity(request_period_code);

  select jsonb_build_object(
    'request',
    jsonb_build_object(
      'id', hir.id,
      'folio', hir.folio,
      'status', hir.status,
      'employee_buk_employee_id', hir.employee_buk_employee_id,
      'employee_document_type', hir.employee_document_type,
      'employee_document_number', hir.employee_document_number,
      'employee_full_name', hir.employee_full_name,
      'employee_job_title', hir.employee_job_title,
      'employee_union_name', hir.employee_union_name,
      'employee_union_status', hir.employee_union_status,
      'employee_union_joined_at', hir.employee_union_joined_at,
      'primary_contract_code', hir.primary_contract_code,
      'primary_area_name', hir.primary_area_name,
      'selected_contract_code', hir.selected_contract_code,
      'selected_area_name', hir.selected_area_name,
      'selected_area_code', hir.selected_area_code,
      'incentive_type_name', hir.incentive_type_name,
      'requires_replacement', hir.requires_replacement,
      'replacement_buk_employee_id', hir.replacement_buk_employee_id,
      'replacement_document_number', hir.replacement_document_number,
      'replacement_full_name', hir.replacement_full_name,
      'motive', hir.motive,
      'description', hir.description,
      'service_date', hir.service_date,
      'duration_hours', hir.duration_hours,
      'period_code', hir.period_code,
      'entry_lag_days', hir.entry_lag_days,
      'is_out_of_deadline', hir.is_out_of_deadline,
      'is_contract_mismatch', hir.is_contract_mismatch,
      'declared_rest_day', hir.declared_rest_day,
      'calculation_basis', hir.calculation_basis,
      'rate_rule_amount', hir.rate_rule_amount,
      'calculated_amount', hir.calculated_amount,
      'requester_name', coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible'),
      'requester_email', requester_profile.email,
      'current_step_code', pending_approval.step_code,
      'current_step_name', pending_approval.step_name,
      'current_approver_name', pending_approval.approver_name,
      'cancelled_at', hir.cancelled_at,
      'cancellation_comment', hir.cancellation_comment,
      'created_at', hir.created_at,
      'updated_at', hir.updated_at
    ),
    'approvals',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hira.id,
          'step_code', hira.step_code,
          'step_name', hira.step_name,
          'step_order', hira.step_order,
          'approver_user_id', hira.approver_user_id,
          'approver_name', hira.approver_name,
          'approver_email', hira.approver_email,
          'status', hira.status,
          'decision_by', hira.decision_by,
          'decision_comment', hira.decision_comment,
          'decided_at', hira.decided_at,
          'created_at', hira.created_at
        )
        order by hira.step_order asc, hira.created_at asc
      )
      from public.hr_incentive_request_approvals hira
      where hira.incentive_request_id = hir.id
    ), '[]'::jsonb),
    'history',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hih.id,
          'action_type', hih.action_type,
          'actor_user_id', hih.actor_user_id,
          'actor_name', coalesce(actor_profile.full_name, actor_profile.email, 'Usuario no disponible'),
          'comment', hih.comment,
          'metadata', hih.metadata,
          'created_at', hih.created_at
        )
        order by hih.created_at desc, hih.id desc
      )
      from public.hr_incentive_request_history hih
      left join public.profiles actor_profile
        on actor_profile.id = hih.actor_user_id
      where hih.incentive_request_id = hir.id
    ), '[]'::jsonb)
  )
  into request_payload
  from public.hr_incentive_requests hir
  left join public.profiles requester_profile
    on requester_profile.id = hir.created_by
  left join lateral (
    select
      hira.step_code,
      hira.step_name,
      hira.approver_name
    from public.hr_incentive_request_approvals hira
    where hira.incentive_request_id = hir.id
      and hira.status = 'pending'
    order by hira.step_order asc, hira.created_at asc
    limit 1
  ) pending_approval on true
  where hir.id = p_request_id;

  return coalesce(request_payload, '{}'::jsonb);
end;
$function$;

revoke all on function public.audit_hr_incentive_period_folio_integrity(text) from public, anon, authenticated;
grant execute on function public.audit_hr_incentive_period_folio_integrity(text) to authenticated;

revoke all on function public.assert_hr_incentive_period_folio_integrity(text) from public, anon, authenticated;
grant execute on function public.assert_hr_incentive_period_folio_integrity(text) to authenticated;

notify pgrst, 'reload schema';

commit;
