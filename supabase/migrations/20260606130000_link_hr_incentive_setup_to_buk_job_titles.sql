create or replace function public.get_hr_incentive_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  return jsonb_build_object(
    'buk_job_titles',
    coalesce((
      with active_job_titles as (
        select distinct
          coalesce(
            nullif(trim(e.job_title), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
            nullif(trim(e.raw_payload ->> 'job_title'), '')
          ) as resolved_job_title
        from public.employees_active_current e
      )
      select jsonb_agg(ajt.resolved_job_title order by upper(ajt.resolved_job_title), ajt.resolved_job_title)
      from active_job_titles ajt
      where ajt.resolved_job_title is not null
    ), '[]'::jsonb),
    'allowed_job_titles',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', jt.id,
          'job_title', jt.job_title,
          'is_active', jt.is_active,
          'created_at', jt.created_at
        )
        order by jt.is_active desc, jt.job_title
      )
      from public.hr_incentive_allowed_job_titles jt
    ), '[]'::jsonb),
    'incentive_types',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', it.id,
          'code', it.code,
          'name', it.name,
          'calculation_basis', it.calculation_basis,
          'requires_replacement', it.requires_replacement,
          'is_active', it.is_active,
          'created_at', it.created_at
        )
        order by it.is_active desc, it.name
      )
      from public.hr_incentive_types it
    ), '[]'::jsonb),
    'rate_rules',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rr.id,
          'incentive_type_id', rr.incentive_type_id,
          'incentive_type_name', it.name,
          'contract_code', rr.contract_code,
          'job_title', rr.job_title,
          'amount', rr.amount,
          'priority', rr.priority,
          'valid_from', rr.valid_from,
          'valid_to', rr.valid_to,
          'is_active', rr.is_active,
          'created_at', rr.created_at
        )
        order by rr.is_active desc, it.name, rr.priority asc, rr.contract_code nulls last, rr.job_title nulls last
      )
      from public.hr_incentive_rate_rules rr
      join public.hr_incentive_types it
        on it.id = rr.incentive_type_id
    ), '[]'::jsonb)
  );
end;
$function$;

notify pgrst, 'reload schema';
