begin;

create or replace function public.extract_buk_contract_number_from_area_name(p_area_name text)
returns text
language sql
immutable
as $function$
  select nullif(
    trim(
      coalesce(
        (regexp_match(coalesce(p_area_name, ''), '\(([^)]+)\)'))[1],
        ''
      )
    ),
    ''
  );
$function$;

create or replace function public.resolve_known_company_name(
  p_company_id bigint default null,
  p_contract_number text default null
)
returns text
language sql
immutable
as $function$
  with resolved_company_keys as (
    select
      p_company_id as company_id,
      case
        when split_part(coalesce(p_contract_number, ''), ':', 2) ~ '^\d+$'
          then split_part(p_contract_number, ':', 2)::bigint
        else null
      end as contract_company_code
  )
  select case
    when resolved_company_keys.company_id = 1 or resolved_company_keys.contract_company_code = 1
      then 'Buses JM Pullman S.A.'
    when resolved_company_keys.company_id = 3 or resolved_company_keys.contract_company_code = 2
      then 'Servicios Industriales Minardi S.A.'
    when resolved_company_keys.company_id = 4 or resolved_company_keys.contract_company_code = 4
      then 'Consorcio nuevo norte SPA'
    when resolved_company_keys.company_id = 5 or resolved_company_keys.contract_company_code = 5
      then 'Consorcio Andino SPA'
    when resolved_company_keys.company_id = 6 or resolved_company_keys.contract_company_code = 6
      then 'Transportes Plaza Vieja Spa'
    else null
  end
  from resolved_company_keys;
$function$;

create or replace function public.extract_buk_job_title(p_payload jsonb)
returns text
language sql
immutable
as $function$
  select nullif(
    trim(
      coalesce(
        p_payload -> 'current_job' -> 'role' ->> 'name',
        p_payload -> 'current_job' ->> 'role_name',
        p_payload -> 'current_job' ->> 'job_title',
        p_payload -> 'jobs' -> 0 -> 'role' ->> 'name',
        p_payload -> 'jobs' -> 0 ->> 'role_name',
        p_payload -> 'jobs' -> 0 ->> 'job_title',
        p_payload ->> 'job_title',
        p_payload -> 'employee' ->> 'job_title'
      )
    ),
    ''
  );
$function$;

create or replace function public.resolve_active_employee_job_title(
  p_payload jsonb,
  p_job_title text default null
)
returns text
language sql
immutable
as $function$
  select coalesce(
    public.extract_buk_job_title(p_payload),
    nullif(trim(coalesce(p_job_title, '')), ''),
    'Sin cargo'
  );
$function$;

create or replace function public.extract_buk_shift_name(p_payload jsonb)
returns text
language sql
immutable
as $function$
  select nullif(
    trim(
      coalesce(
        p_payload -> 'current_job' -> 'custom_attributes' ->> 'Jornada Laboral',
        p_payload -> 'jobs' -> 0 -> 'custom_attributes' ->> 'Jornada Laboral',
        p_payload ->> 'shift_name',
        p_payload ->> 'shift',
        p_payload -> 'current_job' ->> 'shift_name',
        p_payload -> 'current_job' ->> 'shift',
        p_payload -> 'current_job' -> 'schedule' ->> 'name',
        p_payload -> 'current_job' -> 'schedule' ->> 'shift_name',
        p_payload -> 'employee' ->> 'shift_name'
      )
    ),
    ''
  );
$function$;

create or replace function public.resolve_buk_company_name_by_company_id(p_company_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  with ranked_companies as (
    select
      public.extract_buk_company_name(e.raw_payload) as company_name,
      count(*) as row_count,
      max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) as latest_activity_at,
      row_number() over (
        order by
          count(*) desc,
          max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) desc,
          public.extract_buk_company_name(e.raw_payload) asc
      ) as row_rank
    from public.employees e
    where p_company_id is not null
      and public.extract_buk_company_id(e.raw_payload) = p_company_id
      and nullif(trim(coalesce(public.extract_buk_company_name(e.raw_payload), '')), '') is not null
    group by public.extract_buk_company_name(e.raw_payload)
  )
  select coalesce(
    public.resolve_known_company_name(p_company_id, null),
    (
      select rc.company_name
      from ranked_companies rc
      where rc.row_rank = 1
    )
  );
$function$;

create or replace function public.resolve_buk_area_company_name(p_area_name text)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  with normalized_area as (
    select public.normalize_buk_area_name(p_area_name) as area_name_normalized
  ),
  ranked_companies as (
    select
      public.extract_buk_company_name(e.raw_payload) as company_name,
      max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) as latest_activity_at,
      count(*) as row_count,
      row_number() over (
        order by
          count(*) desc,
          max(coalesce(e.updated_at, e.created_at, '-infinity'::timestamptz)) desc,
          public.extract_buk_company_name(e.raw_payload) asc
      ) as row_rank
    from public.employees e
    cross join normalized_area na
    where na.area_name_normalized is not null
      and public.normalize_buk_area_name(e.area_name) = na.area_name_normalized
      and nullif(trim(coalesce(public.extract_buk_company_name(e.raw_payload), '')), '') is not null
    group by public.extract_buk_company_name(e.raw_payload)
  )
  select coalesce(
    public.resolve_known_company_name(
      null,
      public.extract_buk_contract_number_from_area_name(p_area_name)
    ),
    (
      select rc.company_name
      from ranked_companies rc
      where rc.row_rank = 1
    )
  );
$function$;

create or replace function public.resolve_active_employee_company_name(
  p_payload jsonb,
  p_area_name text default null
)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    public.extract_buk_company_name(p_payload),
    public.resolve_known_company_name(
      public.extract_buk_company_id(p_payload),
      public.extract_buk_contract_number_from_area_name(p_area_name)
    ),
    public.resolve_buk_company_name_by_company_id(public.extract_buk_company_id(p_payload)),
    public.resolve_buk_area_company_name(p_area_name)
  );
$function$;

update public.buk_contract_mappings bcm
set company_name = coalesce(
  nullif(trim(coalesce(bcm.company_name, '')), ''),
  public.resolve_known_company_name(null, bcm.contract_number),
  public.resolve_buk_area_company_name(bcm.buk_area_name)
)
where nullif(trim(coalesce(bcm.company_name, '')), '') is null;

create or replace function public.get_internal_mobility_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para ver movilidad interna';
  end if;

  return jsonb_build_object(
    'buk_job_titles',
    coalesce((
      select jsonb_agg(job_title_value order by job_title_value)
      from (
        select distinct public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as job_title_value
        from public.employees_active_current e
        where nullif(trim(public.resolve_active_employee_job_title(e.raw_payload, e.job_title)), '') is not null
      ) job_titles
    ), '[]'::jsonb),
    'shift_catalog',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'active', s.is_active
        )
        order by s.name asc
      )
      from public.shifts s
      where s.is_active = true
    ), '[]'::jsonb),
    'destinations',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'contract_id', bcm.contract_id,
          'contract_code', c.code,
          'contract_number', bcm.contract_number,
          'area_name', bcm.buk_area_name,
          'area_code', bcm.buk_area_code,
          'cost_center_code', bcm.cost_center_code,
          'cost_center_name', bcm.cost_center_name,
          'company_name', coalesce(
            nullif(trim(coalesce(bcm.company_name, '')), ''),
            public.resolve_known_company_name(null, bcm.contract_number)
          ),
          'label', concat_ws(
            ' · ',
            c.code,
            bcm.buk_area_name,
            coalesce(
              nullif(trim(coalesce(bcm.company_name, '')), ''),
              public.resolve_known_company_name(null, bcm.contract_number)
            )
          )
        )
        order by bcm.buk_area_name asc
      )
      from public.buk_contract_mappings bcm
      join public.contracts c
        on c.id = bcm.contract_id
       and c.is_active = true
      where bcm.is_operational = true
        and bcm.is_one_to_one = true
        and bcm.contract_id is not null
        and coalesce(
          nullif(trim(coalesce(bcm.company_name, '')), ''),
          public.resolve_known_company_name(null, bcm.contract_number)
        ) is not null
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.search_internal_mobility_workers(
  p_search text,
  p_limit integer default 12
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  job_title text,
  contract_code text,
  area_name text,
  company_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  safe_limit integer := greatest(1, least(coalesce(p_limit, 12), 25));
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para buscar trabajadores';
  end if;

  if length(normalized_search) < 2 and length(normalized_digits) < 4 then
    return;
  end if;

  return query
  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name,
    public.resolve_active_employee_company_name(e.raw_payload, e.area_name) as company_name,
    concat_ws(
      ' · ',
      e.full_name,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut'),
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title),
      nullif(trim(e.area_name), '')
    ) as display_label
  from public.employees_active_current e
  where (
      normalized_search <> ''
      and (
        lower(coalesce(e.full_name, '')) like '%' || normalized_search || '%'
        or lower(public.resolve_active_employee_job_title(e.raw_payload, e.job_title)) like '%' || normalized_search || '%'
        or lower(coalesce(e.area_name, '')) like '%' || normalized_search || '%'
        or lower(coalesce(e.contract_code, '')) like '%' || normalized_search || '%'
      )
    )
    or (
      normalized_digits <> ''
      and regexp_replace(coalesce(e.document_number, ''), '\D', '', 'g') like '%' || normalized_digits || '%'
    )
  order by e.full_name asc
  limit safe_limit;
end;
$function$;

create or replace function public.get_internal_mobility_worker_context(
  p_buk_employee_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_record record;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para consultar el trabajador';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as current_job_title,
    coalesce(c.code, nullif(trim(e.contract_code), '')) as current_contract_code,
    coalesce(bcm.buk_area_name, nullif(trim(e.area_name), '')) as current_area_name,
    coalesce(bcm.buk_area_code, nullif(trim(e.area_code), '')) as current_area_code,
    public.resolve_active_employee_company_name(e.raw_payload, e.area_name) as current_company_name,
    public.resolve_active_employee_shift_name(
      e.raw_payload,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut')
    ) as current_shift_name,
    bcm.contract_id as matched_destination_contract_id,
    c.code as matched_destination_contract_code,
    bcm.buk_area_name as matched_destination_area_name,
    coalesce(
      nullif(trim(coalesce(bcm.company_name, '')), ''),
      public.resolve_known_company_name(null, bcm.contract_number)
    ) as matched_destination_company_name
  into worker_record
  from public.employees_active_current e
  left join public.buk_contract_mappings bcm
    on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
   and bcm.is_operational = true
   and bcm.is_one_to_one = true
   and bcm.contract_id is not null
  left join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_record.buk_employee_id is null then
    raise exception 'Trabajador activo no encontrado en BUK';
  end if;

  return jsonb_build_object(
    'worker',
    jsonb_build_object(
      'buk_employee_id', worker_record.buk_employee_id,
      'full_name', worker_record.full_name,
      'document_number', worker_record.document_number,
      'document_type', worker_record.document_type,
      'current_job_title', worker_record.current_job_title,
      'current_contract_code', worker_record.current_contract_code,
      'current_area_name', worker_record.current_area_name,
      'current_area_code', worker_record.current_area_code,
      'current_company_name', worker_record.current_company_name,
      'current_shift_name', worker_record.current_shift_name,
      'matched_destination_contract_id', worker_record.matched_destination_contract_id,
      'matched_destination_contract_code', worker_record.matched_destination_contract_code,
      'matched_destination_area_name', worker_record.matched_destination_area_name,
      'matched_destination_company_name', worker_record.matched_destination_company_name
    )
  );
end;
$function$;

create or replace function public.submit_internal_mobility_request(
  p_buk_employee_id text,
  p_destination_contract_id bigint,
  p_destination_job_title text,
  p_destination_shift_id bigint,
  p_motive text,
  p_requester_signed boolean default false
)
returns table (
  request_id uuid,
  folio text,
  status text,
  requires_termination boolean,
  current_company_name text,
  destination_company_name text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  requester_profile public.profiles%rowtype;
  worker_record record;
  destination_record record;
  destination_shift_record public.shifts%rowtype;
  area_manager_record public.cost_center_approvers%rowtype;
  area_manager_profile public.profiles%rowtype;
  created_request_id uuid;
  request_snapshot jsonb;
  next_folio text;
  should_require_termination boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para crear solicitudes de movilidad interna';
  end if;

  if coalesce(p_requester_signed, false) is not true then
    raise exception 'Debe confirmar la firma del solicitante';
  end if;

  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    raise exception 'Debe seleccionar un trabajador activo';
  end if;

  if p_destination_contract_id is null then
    raise exception 'Debe seleccionar el contrato o area destino';
  end if;

  if nullif(trim(coalesce(p_destination_job_title, '')), '') is null then
    raise exception 'Debe seleccionar el cargo destino';
  end if;

  if p_destination_shift_id is null then
    raise exception 'Debe seleccionar el turno destino';
  end if;

  if nullif(trim(coalesce(p_motive, '')), '') is null then
    raise exception 'Debe ingresar el motivo del cambio';
  end if;

  select *
    into requester_profile
    from public.profiles
   where id = current_user_id
   for share;

  if requester_profile.id is null then
    raise exception 'No existe perfil para el usuario autenticado';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as current_job_title,
    coalesce(c.code, nullif(trim(e.contract_code), '')) as current_contract_code,
    coalesce(bcm.buk_area_name, nullif(trim(e.area_name), '')) as current_area_name,
    coalesce(bcm.buk_area_code, nullif(trim(e.area_code), '')) as current_area_code,
    public.resolve_active_employee_company_name(e.raw_payload, e.area_name) as current_company_name,
    public.resolve_active_employee_shift_name(
      e.raw_payload,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut')
    ) as current_shift_name
  into worker_record
  from public.employees_active_current e
  left join public.buk_contract_mappings bcm
    on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
   and bcm.is_operational = true
   and bcm.is_one_to_one = true
   and bcm.contract_id is not null
  left join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_record.buk_employee_id is null then
    raise exception 'Trabajador activo no encontrado';
  end if;

  select *
    into destination_shift_record
    from public.shifts s
   where s.id = p_destination_shift_id
     and s.is_active = true
   limit 1;

  if destination_shift_record.id is null then
    raise exception 'Turno destino invalido o inactivo';
  end if;

  select
    bcm.contract_id,
    bcm.contract_number,
    c.code as contract_code,
    bcm.buk_area_name as area_name,
    bcm.buk_area_code as area_code,
    bcm.cost_center_code,
    bcm.cost_center_name,
    coalesce(
      nullif(trim(coalesce(bcm.company_name, '')), ''),
      public.resolve_known_company_name(null, bcm.contract_number)
    ) as company_name
  into destination_record
  from public.buk_contract_mappings bcm
  join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where bcm.contract_id = p_destination_contract_id
    and bcm.is_operational = true
    and bcm.is_one_to_one = true
    and bcm.contract_id is not null
  order by bcm.buk_area_name
  limit 1;

  if destination_record.contract_id is null then
    raise exception 'Destino invalido o inactivo';
  end if;

  if nullif(trim(coalesce(destination_record.company_name, '')), '') is null then
    raise exception 'El destino seleccionado no tiene empresa configurada';
  end if;

  select *
    into area_manager_record
    from public.cost_center_approvers
   where cost_center_code = destination_record.cost_center_code
     and is_active = true
   for share;

  if area_manager_record.id is null then
    raise exception 'No existe gerente configurado para el centro de costo del destino';
  end if;

  if area_manager_record.approver_user_id is null then
    raise exception 'El gerente del destino aun no tiene usuario vinculado en la plataforma';
  end if;

  select *
    into area_manager_profile
    from public.profiles
   where id = area_manager_record.approver_user_id
     and status = 'active'
   for share;

  if area_manager_profile.id is null then
    raise exception 'El gerente del destino no tiene una cuenta activa';
  end if;

  should_require_termination :=
    worker_record.current_company_name is not null
    and worker_record.current_company_name is distinct from destination_record.company_name;

  next_folio := 'MI-' || lpad(nextval('public.internal_mobility_folio_seq')::text, 4, '0');

  insert into public.internal_mobility_requests (
    folio,
    requester_id,
    requester_name,
    requester_job_title,
    requester_email,
    employee_buk_employee_id,
    employee_document_number,
    employee_document_type,
    employee_full_name,
    current_job_title,
    current_contract_code,
    current_area_name,
    current_area_code,
    current_company_name,
    current_shift_name,
    destination_job_title,
    destination_contract_id,
    destination_contract_code,
    destination_contract_number,
    destination_area_name,
    destination_area_code,
    destination_cost_center_code,
    destination_cost_center_name,
    destination_company_name,
    destination_shift_id,
    destination_shift_name,
    requires_termination,
    motive,
    status,
    current_step_code,
    submitted_at,
    submitted_by,
    created_at,
    updated_at
  )
  values (
    next_folio,
    current_user_id,
    coalesce(requester_profile.full_name, requester_profile.email),
    requester_profile.job_title,
    requester_profile.email,
    worker_record.buk_employee_id,
    worker_record.document_number,
    worker_record.document_type,
    worker_record.full_name,
    worker_record.current_job_title,
    worker_record.current_contract_code,
    worker_record.current_area_name,
    worker_record.current_area_code,
    worker_record.current_company_name,
    worker_record.current_shift_name,
    trim(p_destination_job_title),
    destination_record.contract_id,
    destination_record.contract_code,
    destination_record.contract_number,
    destination_record.area_name,
    destination_record.area_code,
    destination_record.cost_center_code,
    destination_record.cost_center_name,
    destination_record.company_name,
    destination_shift_record.id,
    destination_shift_record.name,
    should_require_termination,
    trim(p_motive),
    'pending_area_manager',
    'area_manager',
    timezone('utc', now()),
    current_user_id,
    timezone('utc', now()),
    timezone('utc', now())
  )
  returning id into created_request_id;

  request_snapshot := jsonb_build_object(
    'folio', next_folio,
    'requester_id', current_user_id,
    'requester_name', coalesce(requester_profile.full_name, requester_profile.email),
    'requester_job_title', requester_profile.job_title,
    'requester_email', requester_profile.email,
    'employee_buk_employee_id', worker_record.buk_employee_id,
    'employee_document_number', worker_record.document_number,
    'employee_document_type', worker_record.document_type,
    'employee_full_name', worker_record.full_name,
    'current_job_title', worker_record.current_job_title,
    'current_contract_code', worker_record.current_contract_code,
    'current_area_name', worker_record.current_area_name,
    'current_area_code', worker_record.current_area_code,
    'current_company_name', worker_record.current_company_name,
    'current_shift_name', worker_record.current_shift_name,
    'destination_job_title', trim(p_destination_job_title),
    'destination_contract_id', destination_record.contract_id,
    'destination_contract_code', destination_record.contract_code,
    'destination_contract_number', destination_record.contract_number,
    'destination_area_name', destination_record.area_name,
    'destination_area_code', destination_record.area_code,
    'destination_cost_center_code', destination_record.cost_center_code,
    'destination_cost_center_name', destination_record.cost_center_name,
    'destination_company_name', destination_record.company_name,
    'destination_shift_id', destination_shift_record.id,
    'destination_shift_name', destination_shift_record.name,
    'requires_termination', should_require_termination,
    'motive', trim(p_motive),
    'requester_signed', true
  );

  insert into public.internal_mobility_request_snapshots (
    internal_mobility_request_id,
    snapshot_type,
    payload,
    created_by
  )
  values (
    created_request_id,
    'submitted',
    request_snapshot,
    current_user_id
  );

  insert into public.internal_mobility_request_approvals (
    internal_mobility_request_id,
    step_code,
    step_name,
    step_order,
    approver_user_id,
    approver_name,
    approver_email,
    status,
    decision_by,
    decision_comment,
    decided_at,
    locked_at,
    created_at,
    updated_at
  )
  values (
    created_request_id,
    'requester_signature',
    'Firma solicitante',
    1,
    current_user_id,
    coalesce(requester_profile.full_name, requester_profile.email),
    requester_profile.email,
    'approved',
    current_user_id,
    null,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (internal_mobility_request_id, step_code) do nothing;

  insert into public.internal_mobility_request_approvals (
    internal_mobility_request_id,
    step_code,
    step_name,
    step_order,
    approver_user_id,
    approver_name,
    approver_email,
    status,
    created_at,
    updated_at
  )
  values (
    created_request_id,
    'area_manager',
    'Gerente de area',
    2,
    area_manager_record.approver_user_id,
    area_manager_record.approver_name,
    coalesce(area_manager_record.approver_email, area_manager_profile.email),
    'pending',
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  )
  values (
    created_request_id,
    current_user_id,
    'submitted',
    request_snapshot,
    jsonb_build_object(
      'current_step_code', 'area_manager',
      'status', 'pending_area_manager'
    )
  );

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
    approval_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  )
  select
    created_request_id,
    imra.id,
    current_user_id,
    'approval_created',
    jsonb_build_object(
      'step_code', imra.step_code,
      'step_name', imra.step_name,
      'approver_user_id', imra.approver_user_id,
      'approver_name', imra.approver_name,
      'approver_email', imra.approver_email,
      'status', imra.status
    ),
    jsonb_build_object('created_by_flow', 'submit_internal_mobility_request')
  from public.internal_mobility_request_approvals imra
  where imra.internal_mobility_request_id = created_request_id
    and imra.step_code = 'area_manager';

  return query
  select
    created_request_id,
    next_folio,
    'pending_area_manager'::text,
    should_require_termination,
    worker_record.current_company_name::text,
    destination_record.company_name::text;
end;
$function$;

update public.internal_mobility_requests imr
set
  current_job_title = coalesce(
    nullif(trim(coalesce(imr.current_job_title, '')), ''),
    public.resolve_active_employee_job_title(e.raw_payload, e.job_title)
  ),
  current_company_name = coalesce(
    nullif(trim(coalesce(imr.current_company_name, '')), ''),
    public.resolve_active_employee_company_name(e.raw_payload, e.area_name)
  ),
  current_shift_name = coalesce(
    nullif(trim(coalesce(imr.current_shift_name, '')), ''),
    public.resolve_active_employee_shift_name(
      e.raw_payload,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut')
    )
  ),
  destination_company_name = coalesce(
    nullif(trim(coalesce(imr.destination_company_name, '')), ''),
    (
      select nullif(trim(coalesce(bcm.company_name, '')), '')
      from public.buk_contract_mappings bcm
      where bcm.contract_id = imr.destination_contract_id
        and bcm.is_operational = true
        and bcm.is_one_to_one = true
      order by bcm.id asc
      limit 1
    ),
    (
      select public.resolve_known_company_name(null, bcm.contract_number)
      from public.buk_contract_mappings bcm
      where bcm.contract_id = imr.destination_contract_id
        and bcm.is_operational = true
        and bcm.is_one_to_one = true
      order by bcm.id asc
      limit 1
    )
  ),
  updated_at = timezone('utc', now())
from public.employees_active_current e
where e.buk_employee_id = imr.employee_buk_employee_id
  and (
    nullif(trim(coalesce(imr.current_job_title, '')), '') is null
    or nullif(trim(coalesce(imr.current_company_name, '')), '') is null
    or nullif(trim(coalesce(imr.current_shift_name, '')), '') is null
    or nullif(trim(coalesce(imr.destination_company_name, '')), '') is null
  );

notify pgrst, 'reload schema';

commit;
