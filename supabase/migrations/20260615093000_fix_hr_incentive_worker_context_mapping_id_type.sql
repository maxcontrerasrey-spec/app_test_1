begin;

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
  worker_data jsonb;
  worker_mapping_id bigint;
  worker_document_type text;
  worker_identity_value text;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar el trabajador';
  end if;

  worker_data := public.get_hr_incentive_worker_core(p_buk_employee_id);
  worker_mapping_id := nullif(worker_data ->> 'mapping_id', '')::bigint;
  worker_document_type := coalesce(nullif(trim(coalesce(worker_data ->> 'document_type', '')), ''), 'rut');
  worker_identity_value := coalesce(
    nullif(regexp_replace(coalesce(worker_data ->> 'document_number', ''), '\D', '', 'g'), ''),
    worker_data ->> 'buk_employee_id'
  );

  return jsonb_build_object(
    'worker',
    worker_data - 'mapping_id',
    'available_areas',
    coalesce((
      with ranked_worker_options as (
        select
          bcm.id as mapping_id,
          c.code as contract_code,
          bcm.buk_area_name as area_name,
          nullif(trim(e.area_code), '') as area_code,
          greatest(
            coalesce(e.updated_at, '-infinity'::timestamptz),
            coalesce(e.created_at, '-infinity'::timestamptz)
          ) as activity_at,
          case when bcm.id = worker_mapping_id then 0 else 1 end as option_rank,
          row_number() over (
            partition by bcm.id
            order by
              case when e.is_active then 0 else 1 end,
              e.updated_at desc nulls last,
              e.created_at desc nulls last
          ) as row_rank
        from public.employees e
        join public.buk_contract_mappings bcm
          on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
         and bcm.is_operational = true
         and bcm.is_one_to_one = true
         and bcm.contract_id is not null
        join public.contracts c
          on c.id = bcm.contract_id
         and c.is_active = true
        where coalesce(nullif(trim(e.document_type), ''), 'rut') = worker_document_type
          and coalesce(
            nullif(regexp_replace(coalesce(e.document_number, ''), '\D', '', 'g'), ''),
            e.buk_employee_id
          ) = worker_identity_value
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

notify pgrst, 'reload schema';

commit;
