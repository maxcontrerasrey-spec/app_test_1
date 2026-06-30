begin;

create or replace function public.get_hr_incentive_worker_core(
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
  resolved_base_salary numeric;
  resolved_weekly_hours numeric;
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
    coalesce(
      nullif(trim(bcm.buk_area_name), ''),
      nullif(trim(public.normalize_buk_area_name(e.area_name)), ''),
      nullif(trim(e.area_name), '')
    ) as area_name,
    nullif(trim(e.area_code), '') as area_code,
    bcm.id as mapping_id,
    e.raw_payload
  into worker_row
  from public.employees_active_current e
  left join lateral (
    select
      candidate_bcm.id,
      candidate_bcm.buk_area_name,
      candidate_bcm.contract_id
    from public.buk_contract_mappings candidate_bcm
    where candidate_bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
      and candidate_bcm.is_operational = true
      and candidate_bcm.is_one_to_one = true
      and candidate_bcm.contract_id is not null
    order by candidate_bcm.updated_at desc nulls last, candidate_bcm.id desc
    limit 1
  ) bcm on true
  left join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.id is null then
    raise exception 'Trabajador BUK no encontrado';
  end if;

  resolved_union_status := coalesce(worker_row.union_status, 'unknown');
  resolved_base_salary := public.extract_hr_incentive_worker_base_salary(worker_row.raw_payload);
  resolved_weekly_hours := public.extract_hr_incentive_worker_weekly_hours(worker_row.raw_payload);

  return jsonb_build_object(
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
    'primary_area_code', worker_row.area_code,
    'mapping_id', worker_row.mapping_id,
    'base_salary', resolved_base_salary,
    'weekly_hours', resolved_weekly_hours
  );
end;
$function$;

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
      ),
      resolved_options as (
        select * from worker_options
        union all
        select *
        from active_contract_options
        where not exists (
          select 1
          from worker_options
        )
      )
      select jsonb_agg(
        jsonb_build_object(
          'contract_code', ro.contract_code,
          'area_name', ro.area_name,
          'area_code', ro.area_code,
          'label', ro.label,
          'is_primary', ro.is_primary
        )
        order by ro.option_rank asc, ro.activity_at desc nulls last, ro.contract_code nulls last, ro.area_name nulls last
      )
      from resolved_options ro
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.search_hr_incentive_eligible_workers(
  p_search text default null,
  p_limit integer default 20
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  job_title text,
  contract_code text,
  area_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 20), 30));
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores elegibles';
  end if;

  return query
  with eligible_titles as (
    select upper(trim(jt.job_title)) as normalized_job_title
    from public.hr_incentive_allowed_job_titles jt
    where jt.is_active = true
  ),
  matching_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      e.raw_payload,
      coalesce(
        nullif(trim(coalesce(e.document_number, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_number', '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'rut', '')), '')
      ) as document_number,
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as resolved_job_title,
      nullif(trim(e.area_name), '') as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key,
      row_number() over (
        partition by public.build_active_employee_identity_key(
          e.document_type,
          e.document_number,
          e.buk_employee_id,
          e.raw_payload
        )
        order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
      ) as identity_rank
    from public.employees e
    where e.is_active = true
      and (
        normalized_search = ''
        or public.build_active_employee_search_text(
          e.full_name,
          e.document_number,
          e.job_title,
          e.contract_code,
          e.area_name,
          e.raw_payload
        ) like '%' || normalized_search || '%'
      )
  ),
  operable_workers as (
    select
      mw.buk_employee_id,
      mw.full_name,
      mw.raw_payload,
      mw.document_number,
      mw.resolved_job_title,
      c.code as contract_code,
      coalesce(
        nullif(trim(bcm.buk_area_name), ''),
        nullif(trim(public.normalize_buk_area_name(mw.area_name)), ''),
        mw.area_name
      ) as area_name,
      mw.name_search_key
    from matching_workers mw
    join eligible_titles et
      on upper(trim(coalesce(mw.resolved_job_title, ''))) = et.normalized_job_title
    left join lateral (
      select
        candidate_bcm.id,
        candidate_bcm.buk_area_name,
        candidate_bcm.contract_id
      from public.buk_contract_mappings candidate_bcm
      where candidate_bcm.buk_area_name_normalized = public.normalize_buk_area_name(mw.area_name)
        and candidate_bcm.is_operational = true
        and candidate_bcm.is_one_to_one = true
        and candidate_bcm.contract_id is not null
      order by candidate_bcm.updated_at desc nulls last, candidate_bcm.id desc
      limit 1
    ) bcm on true
    left join public.contracts c
      on c.id = bcm.contract_id
     and c.is_active = true
    where mw.identity_rank = 1
  )
  select
    ow.buk_employee_id,
    ow.full_name,
    ow.document_number,
    ow.resolved_job_title as job_title,
    ow.contract_code,
    ow.area_name,
    concat_ws(
      ' | ',
      coalesce(ow.document_number, 'Sin RUT'),
      coalesce(ow.resolved_job_title, 'Sin cargo'),
      ow.full_name,
      coalesce(ow.area_name, ow.contract_code, 'Sin contrato')
    ) as display_label
  from operable_workers ow
  order by
    case
      when normalized_search <> '' and ow.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(ow.full_name) like normalized_search || '%' then 1
      else 2
    end,
    ow.full_name
  limit safe_limit;
end;
$function$;

notify pgrst, 'reload schema';

commit;
