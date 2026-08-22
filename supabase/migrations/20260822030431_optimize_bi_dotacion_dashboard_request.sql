begin;

create or replace function public.get_bi_dotacion_dashboard(
  p_period_code text,
  p_contract_codes text[],
  p_job_titles text[],
  p_management_names text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  params record;
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  select
    p_period_code as period_code,
    p_contract_codes as contract_codes,
    p_job_titles as job_titles,
    p_management_names as management_names
  into params;

  -- One HTTP/RPC request for the complete dotacion view. The individual
  -- functions remain the source of truth, so this change does not duplicate
  -- metric semantics or alter existing consumers.
  return jsonb_build_object(
    'overview', coalesce((
      select to_jsonb(row)
      from public.get_bi_workforce_overview(
        params.period_code,
        params.contract_codes,
        params.job_titles,
        params.management_names
      ) row
      limit 1
    ), '{}'::jsonb),
    'headcountByContract', coalesce((
      select jsonb_agg(to_jsonb(row))
      from public.get_bi_headcount_by_contract(
        params.period_code,
        params.contract_codes,
        params.job_titles,
        params.management_names
      ) row
    ), '[]'::jsonb),
    'headcountByManagement', coalesce((
      select jsonb_agg(to_jsonb(row))
      from public.get_bi_headcount_by_management(
        params.period_code,
        params.contract_codes,
        params.job_titles,
        params.management_names
      ) row
    ), '[]'::jsonb),
    'headcountByRegion', coalesce((
      select jsonb_agg(to_jsonb(row))
      from public.get_bi_headcount_by_region(
        params.period_code,
        params.contract_codes,
        params.job_titles,
        params.management_names
      ) row
    ), '[]'::jsonb),
    'ageDistribution', coalesce((
      select jsonb_agg(to_jsonb(row))
      from public.get_bi_age_distribution(
        params.period_code,
        params.contract_codes,
        params.job_titles,
        params.management_names
      ) row
    ), '[]'::jsonb),
    'exceptionsToday', coalesce((
      select jsonb_agg(to_jsonb(row))
      from public.get_bi_exceptions_today(
        params.period_code,
        params.contract_codes,
        params.job_titles,
        params.management_names
      ) row
    ), '[]'::jsonb),
    'presenceSummaryToday', coalesce((
      select jsonb_agg(to_jsonb(row))
      from public.get_bi_presence_summary_today(
        params.period_code,
        params.contract_codes,
        params.job_titles,
        params.management_names
      ) row
    ), '[]'::jsonb),
    'exceptionsMonthly', coalesce((
      select jsonb_agg(to_jsonb(row))
      from public.get_bi_exceptions_monthly(
        params.period_code,
        params.contract_codes,
        params.job_titles,
        params.management_names
      ) row
    ), '[]'::jsonb),
    'recruitmentPipeline', coalesce((
      select jsonb_agg(to_jsonb(row))
      from public.get_bi_recruitment_pipeline(
        params.period_code,
        params.contract_codes,
        params.job_titles,
        params.management_names
      ) row
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_bi_dotacion_dashboard(text, text[], text[], text[])
  from public, anon;
grant execute on function public.get_bi_dotacion_dashboard(text, text[], text[], text[])
  to authenticated;

notify pgrst, 'reload schema';
commit;
