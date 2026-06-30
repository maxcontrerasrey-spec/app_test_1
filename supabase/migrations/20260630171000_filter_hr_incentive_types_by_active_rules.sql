begin;

create or replace function public.get_hr_incentive_eligible_types(
  p_buk_employee_id text,
  p_selected_contract_code text,
  p_service_date date default null
)
returns table (
  id uuid,
  code text,
  name text,
  calculation_basis text,
  requires_replacement boolean,
  requires_rest_day boolean,
  allows_manual_amount boolean,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_data jsonb;
  worker_job_title text;
  worker_union_name text;
  worker_union_status text;
  resolved_service_date date := coalesce(p_service_date, current_date);
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar incentivos elegibles';
  end if;

  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    return;
  end if;

  if nullif(trim(coalesce(p_selected_contract_code, '')), '') is null then
    return;
  end if;

  worker_data := public.get_hr_incentive_worker_core(p_buk_employee_id);
  worker_job_title := worker_data ->> 'job_title';
  worker_union_name := worker_data ->> 'union_name';
  worker_union_status := worker_data ->> 'union_status';

  return query
  select
    it.id,
    it.code,
    it.name,
    it.calculation_basis,
    it.requires_replacement,
    it.requires_rest_day,
    it.allows_manual_amount,
    it.is_active,
    it.created_at
  from public.hr_incentive_types it
  join lateral public.resolve_hr_incentive_rate_rule(
    it.id,
    worker_job_title,
    trim(p_selected_contract_code),
    worker_union_name,
    worker_union_status,
    resolved_service_date
  ) matched_rule on true
  where it.is_active = true
  order by it.name asc, it.code asc;
end;
$function$;

grant execute on function public.get_hr_incentive_eligible_types(text, text, date) to authenticated;

notify pgrst, 'reload schema';

commit;
