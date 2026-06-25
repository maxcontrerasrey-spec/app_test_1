begin;

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
        fr.employee_full_name as worker_name,
        fr.selected_contract_code as contract_code,
        max(fr.selected_area_name) as area_name,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as amount
      from filtered_requests fr
      group by fr.employee_full_name, fr.selected_contract_code
    ),
    amount_by_worker as (
      select
        awc.worker_name,
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
      group by awc.worker_name
      order by total_amount desc, awc.worker_name asc
      limit 10
    ),
    contract_options as (
      with contract_catalog as (
        select distinct on (c.code)
          c.code as value,
          concat_ws(
            ' · ',
            coalesce(
              nullif(trim(bcm.buk_area_name), ''),
              nullif(trim(c.contract_name), ''),
              c.code
            ),
            c.code
          ) as label
        from public.contracts c
        left join public.buk_contract_mappings bcm
          on bcm.contract_id = c.id
         and bcm.is_operational = true
        where c.is_active = true
        order by c.code, bcm.is_one_to_one desc, bcm.updated_at desc nulls last, bcm.id desc nulls last
      )
      select
        cc.value,
        cc.label
      from contract_catalog cc
    ),
    type_options as (
      select
        it.id as value,
        it.name as label
      from public.hr_incentive_types it
      where it.is_active = true
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
              'value', co.value,
              'label', co.label
            )
            order by upper(co.label), co.label
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
            order by upper("to".label), "to".label
          )
          from type_options "to"
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

notify pgrst, 'reload schema';

commit;
