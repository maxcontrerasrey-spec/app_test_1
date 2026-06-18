create or replace function public.current_request_has_service_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with request_context as (
    select
      coalesce(current_setting('request.jwt.claims', true), '') as request_claims,
      coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        case
          when coalesce(current_setting('request.jwt.claims', true), '') <> ''
            then current_setting('request.jwt.claims', true)::jsonb ->> 'role'
          else null
        end,
        ''
      ) as request_role
  )
  select request_role = 'service_role'
  from request_context;
$$;

create or replace function public.capture_buk_employee_daily_snapshot(p_snapshot_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  request_claims text := coalesce(current_setting('request.jwt.claims', true), '');
  target_snapshot_date date := coalesce(p_snapshot_date, current_date);
  inserted_count integer := 0;
begin
  if request_claims <> ''
     and not public.current_request_has_service_role()
     and not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para capturar snapshot diario BUK';
  end if;

  insert into public.buk_employees_daily_snapshot (
    snapshot_date,
    buk_employee_id,
    full_name,
    email,
    job_title,
    contract_code,
    area_name,
    area_code,
    document_number,
    document_type,
    birth_date,
    hire_date,
    city_name,
    region_name,
    status,
    is_active,
    raw_payload
  )
  select
    target_snapshot_date,
    e.buk_employee_id,
    e.full_name,
    e.email,
    coalesce(
      nullif(trim(e.job_title), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
      nullif(trim(e.raw_payload ->> 'job_title'), '')
    ) as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name,
    nullif(trim(e.area_code), '') as area_code,
    nullif(trim(e.document_number), '') as document_number,
    coalesce(nullif(trim(e.document_type), ''), 'rut') as document_type,
    e.birth_date,
    public.extract_buk_employee_hire_date(e.raw_payload) as hire_date,
    public.extract_buk_employee_city_name(e.raw_payload) as city_name,
    public.extract_buk_employee_region_name(e.raw_payload) as region_name,
    e.status,
    e.is_active,
    e.raw_payload
  from public.employees e
  on conflict (snapshot_date, buk_employee_id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    job_title = excluded.job_title,
    contract_code = excluded.contract_code,
    area_name = excluded.area_name,
    area_code = excluded.area_code,
    document_number = excluded.document_number,
    document_type = excluded.document_type,
    birth_date = excluded.birth_date,
    hire_date = excluded.hire_date,
    city_name = excluded.city_name,
    region_name = excluded.region_name,
    status = excluded.status,
    is_active = excluded.is_active,
    raw_payload = excluded.raw_payload,
    captured_at = timezone('utc', now());

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;
