create or replace function public.get_hr_incentives_analytics(
  p_period_code text default null,
  p_contract_code text default null,
  p_incentive_type_id uuid default null,
  p_status text default 'A'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_status text := upper(trim(coalesce(p_status, 'A')));
begin
  if not public.user_can_view_hr_incentive_analytics(current_user_id) then
    raise exception 'Sin permisos para ver el analisis de incentivos';
  end if;

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
        hir.employee_full_name
      from public.hr_incentive_requests hir
    ),
    filtered_requests as (
      select *
      from base_requests br
      where
        (p_period_code is null or trim(p_period_code) = '' or br.period_code = trim(p_period_code))
        and (p_contract_code is null or trim(p_contract_code) = '' or br.selected_contract_code = trim(p_contract_code))
        and (p_incentive_type_id is null or br.incentive_type_id = p_incentive_type_id)
        and (normalized_status = 'A' or br.status = normalized_status)
    ),
    summary as (
      select
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as total_amount,
        count(*)::int as request_count,
        count(*) filter (where fr.status = 'F')::int as approved_count,
        count(*) filter (where fr.status = 'R')::int as rejected_count
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
          )
          from contract_options co
        ), '[]'::jsonb),
        'incentive_types',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'value', topt.value,
              'label', topt.label
            )
          )
          from type_options topt
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

revoke all on function public.get_hr_incentives_analytics(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.get_hr_incentives_analytics(text, text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
