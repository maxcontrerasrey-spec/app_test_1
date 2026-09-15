-- EEES-DB-005: approved
-- owner: Engineering and Human Resources
-- rollback: forward-only; restore the prior analytics RPC in a later audited migration.

alter function public.get_hr_incentives_analytics(text, text[], uuid[], text[])
  rename to get_hr_incentives_analytics_base_20260915;

revoke all on function public.get_hr_incentives_analytics_base_20260915(text, text[], uuid[], text[])
  from public, anon, authenticated;

create or replace function public.get_hr_incentives_analytics(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_type_ids uuid[] default null,
  p_statuses text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  base_payload jsonb;
  normalized_contract_codes text[];
  normalized_type_ids uuid[];
  normalized_statuses text[];
  include_all_statuses boolean := false;
  daily_totals jsonb;
begin
  base_payload := public.get_hr_incentives_analytics_base_20260915(
    p_period_code,
    p_contract_codes,
    p_type_ids,
    p_statuses
  );

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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'service_date', grouped.service_date,
        'total_amount', grouped.total_amount
      )
      order by grouped.service_date
    ),
    '[]'::jsonb
  )
  into daily_totals
  from (
    select
      request.service_date,
      coalesce(sum(request.calculated_amount), 0)::numeric(14,2) as total_amount
    from public.hr_incentive_requests request
    where
      (p_period_code is null or trim(p_period_code) = '' or request.period_code = trim(p_period_code))
      and (
        coalesce(array_length(normalized_contract_codes, 1), 0) = 0
        or request.selected_contract_code = any(normalized_contract_codes)
      )
      and (
        coalesce(array_length(normalized_type_ids, 1), 0) = 0
        or request.incentive_type_id = any(normalized_type_ids)
      )
      and (
        coalesce(array_length(normalized_statuses, 1), 0) = 0
        or include_all_statuses
        or request.status = any(normalized_statuses)
      )
    group by request.service_date
  ) grouped;

  return base_payload || jsonb_build_object('total_amount_by_date', daily_totals);
end;
$function$;

revoke all on function public.get_hr_incentives_analytics(text, text[], uuid[], text[])
  from public, anon, authenticated;
grant execute on function public.get_hr_incentives_analytics(text, text[], uuid[], text[])
  to authenticated;

notify pgrst, 'reload schema';
