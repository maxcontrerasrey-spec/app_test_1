create or replace function public.get_hr_incentive_worker_context(
  p_buk_employee_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_row record;
  resolved_union_status text;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar el trabajador';
  end if;

  select
    e.id,
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(
      nullif(trim(e.job_title), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
      nullif(trim(e.raw_payload ->> 'job_title'), '')
    ) as job_title,
    public.get_hr_incentive_union_name(e.raw_payload) as union_name,
    public.get_hr_incentive_union_status(e.raw_payload) as union_status,
    nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Fecha incorporación al sindicato'), '') as union_joined_at,
    c.code as contract_code,
    bcm.buk_area_name as area_name,
    nullif(trim(e.area_code), '') as area_code,
    bcm.id as mapping_id
  into worker_row
  from public.employees_active_current e
  join public.buk_contract_mappings bcm
    on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
   and bcm.is_operational = true
   and bcm.is_one_to_one = true
   and bcm.contract_id is not null
  join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.id is null then
    raise exception 'Trabajador BUK no encontrado o sin area operativa vinculada';
  end if;

  resolved_union_status := coalesce(worker_row.union_status, 'unknown');

  return jsonb_build_object(
    'worker', jsonb_build_object(
      'buk_employee_id', worker_row.buk_employee_id,
      'full_name', worker_row.full_name,
      'document_number', worker_row.document_number,
      'document_type', worker_row.document_type,
      'job_title', worker_row.job_title,
      'union_name', worker_row.union_name,
      'union_status', resolved_union_status,
      'union_status_label', public.get_hr_incentive_union_status_label(resolved_union_status),
      'union_joined_at', worker_row.union_joined_at,
      'primary_contract_code', worker_row.contract_code,
      'primary_area_name', worker_row.area_name,
      'primary_area_code', worker_row.area_code
    ),
    'available_areas',
    coalesce((
      with worker_identity as (
        select
          coalesce(nullif(trim(worker_row.document_type), ''), 'rut') as document_type,
          coalesce(
            nullif(regexp_replace(coalesce(worker_row.document_number, ''), '\D', '', 'g'), ''),
            worker_row.buk_employee_id
          ) as identity_value
      ),
      ranked_worker_options as (
        select
          bcm.id as mapping_id,
          c.code as contract_code,
          bcm.buk_area_name as area_name,
          nullif(trim(e.area_code), '') as area_code,
          greatest(
            coalesce(e.updated_at, '-infinity'::timestamptz),
            coalesce(e.created_at, '-infinity'::timestamptz)
          ) as activity_at,
          case when bcm.id = worker_row.mapping_id then 0 else 1 end as option_rank,
          row_number() over (
            partition by bcm.id
            order by
              case when e.is_active then 0 else 1 end,
              e.updated_at desc nulls last,
              e.created_at desc nulls last
          ) as row_rank
        from public.employees e
        cross join worker_identity wi
        join public.buk_contract_mappings bcm
          on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
         and bcm.is_operational = true
         and bcm.is_one_to_one = true
         and bcm.contract_id is not null
        join public.contracts c
          on c.id = bcm.contract_id
         and c.is_active = true
        where coalesce(nullif(trim(e.document_type), ''), 'rut') = wi.document_type
          and coalesce(
            nullif(regexp_replace(coalesce(e.document_number, ''), '\D', '', 'g'), ''),
            e.buk_employee_id
          ) = wi.identity_value
      ),
      worker_options as (
        select
          rwo.contract_code,
          rwo.area_name,
          rwo.area_code,
          concat_ws(' · ', coalesce(rwo.contract_code, 'Sin código'), rwo.area_name) as label,
          rwo.option_rank = 0 as is_primary,
          rwo.option_rank,
          rwo.activity_at
        from ranked_worker_options rwo
        where rwo.row_rank = 1
      ),
      active_contract_options as (
        select
          c.code as contract_code,
          c.contract_name as area_name,
          null::text as area_code,
          concat_ws(' · ', c.code, c.contract_name) as label,
          false as is_primary,
          2 as option_rank,
          null::timestamptz as activity_at
        from public.contracts c
        where c.is_active = true
          and not exists (
            select 1
            from worker_options wo
            where wo.contract_code = c.code
          )
      ),
      combined_options as (
        select * from worker_options
        union all
        select * from active_contract_options
      )
      select jsonb_agg(
        jsonb_build_object(
          'contract_code', co.contract_code,
          'area_name', co.area_name,
          'area_code', co.area_code,
          'label', co.label,
          'is_primary', co.is_primary
        )
        order by co.option_rank asc, co.activity_at desc nulls last, co.contract_code nulls last, co.area_name nulls last
      )
      from combined_options co
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_hr_incentive_worker_context(text) from public, anon, authenticated;
grant execute on function public.get_hr_incentive_worker_context(text) to authenticated;

notify pgrst, 'reload schema';
