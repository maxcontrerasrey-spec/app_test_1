begin;

create or replace function public.capture_buk_employee_monthly_snapshot(
  p_snapshot_date date default ((date_trunc('month', current_date)::date - interval '1 day')::date)
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  request_claims text := coalesce(current_setting('request.jwt.claims', true), '');
  target_snapshot_date date := coalesce(
    p_snapshot_date,
    (date_trunc('month', current_date)::date - interval '1 day')::date
  );
  inserted_count integer := 0;
begin
  -- pg_cron invokes this function without JWT claims. API calls still require BI access.
  if request_claims <> ''
     and not public.current_request_has_service_role()
     and not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para capturar snapshot mensual BUK';
  end if;

  if target_snapshot_date >= date_trunc('month', current_date)::date then
    raise exception 'Solo se pueden capturar periodos BUK cerrados';
  end if;

  insert into public.buk_employees_daily_snapshot (
    snapshot_date, buk_employee_id, full_name, email, job_title, contract_code,
    area_name, area_code, document_number, document_type, birth_date, hire_date,
    city_name, region_name, status, is_active
  )
  select
    target_snapshot_date, e.buk_employee_id, e.full_name, e.email,
    coalesce(
      nullif(trim(e.job_title), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
      nullif(trim(e.raw_payload ->> 'job_title'), '')
    ),
    nullif(trim(e.contract_code), ''), nullif(trim(e.area_name), ''),
    nullif(trim(e.area_code), ''), nullif(trim(e.document_number), ''),
    coalesce(nullif(trim(e.document_type), ''), 'rut'), e.birth_date,
    public.extract_buk_employee_hire_date(e.raw_payload),
    public.extract_buk_employee_city_name(e.raw_payload),
    public.extract_buk_employee_region_name(e.raw_payload), e.status, e.is_active
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
    captured_at = timezone('utc', now());

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

revoke all on function public.capture_buk_employee_monthly_snapshot(date) from public, anon;
grant execute on function public.capture_buk_employee_monthly_snapshot(date) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
