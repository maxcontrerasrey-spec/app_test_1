begin;

create table if not exists public.buk_employee_snapshot_compaction_audit (
  id uuid primary key default gen_random_uuid(),
  executed_at timestamptz not null default timezone('utc', now()),
  executed_by text not null default current_user,
  action text not null,
  rows_before bigint not null,
  distinct_snapshot_dates_before integer not null,
  min_snapshot_date date,
  max_snapshot_date date,
  active_rows_before bigint not null,
  inactive_rows_before bigint not null,
  logical_raw_payload_bytes_before bigint not null,
  total_relation_bytes_before bigint not null,
  toast_relation_bytes_before bigint not null,
  normalized_rows_after bigint,
  distinct_snapshot_dates_after integer,
  total_relation_bytes_after bigint,
  notes text not null
);

revoke all on public.buk_employee_snapshot_compaction_audit from public, anon, authenticated;
grant select, insert on public.buk_employee_snapshot_compaction_audit to service_role;

insert into public.buk_employee_snapshot_compaction_audit (
  action,
  rows_before,
  distinct_snapshot_dates_before,
  min_snapshot_date,
  max_snapshot_date,
  active_rows_before,
  inactive_rows_before,
  logical_raw_payload_bytes_before,
  total_relation_bytes_before,
  toast_relation_bytes_before,
  notes
)
select
  'convert_buk_employee_snapshot_to_monthly_closed_periods',
  count(*)::bigint,
  count(distinct snapshot_date)::integer,
  min(snapshot_date),
  max(snapshot_date),
  count(*) filter (where is_active)::bigint,
  count(*) filter (where not is_active)::bigint,
  case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'buk_employees_daily_snapshot'
        and column_name = 'raw_payload'
    )
      then 0::bigint
    else 0::bigint
  end,
  pg_total_relation_size('public.buk_employees_daily_snapshot'::regclass)::bigint,
  coalesce(pg_total_relation_size(
    (select reltoastrelid from pg_class where oid = 'public.buk_employees_daily_snapshot'::regclass)
  ), 0)::bigint,
  'Convierte la foto BUK desde granularidad diaria a mensual. Se conserva una foto por mes cerrado; meses parciales se eliminan y se capturan al cierre.'
from public.buk_employees_daily_snapshot;

delete from public.buk_employees_daily_snapshot snapshot
where snapshot.snapshot_date >= date_trunc('month', current_date)::date
   or snapshot.snapshot_date <> (
     select max(month_snapshot.snapshot_date)
     from public.buk_employees_daily_snapshot month_snapshot
     where date_trunc('month', month_snapshot.snapshot_date)::date = date_trunc('month', snapshot.snapshot_date)::date
       and month_snapshot.snapshot_date < date_trunc('month', current_date)::date
   );

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
  target_snapshot_date date := coalesce(
    p_snapshot_date,
    (date_trunc('month', current_date)::date - interval '1 day')::date
  );
  inserted_count integer := 0;
begin
  if not public.current_request_has_service_role()
     and not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para capturar snapshot mensual BUK';
  end if;

  if target_snapshot_date >= date_trunc('month', current_date)::date then
    raise exception 'Solo se pueden capturar periodos BUK cerrados';
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
    is_active
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
    e.is_active
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

drop function if exists public.capture_buk_employee_daily_snapshot(date);

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule(jobid)
      from cron.job
      where jobname in (
        'capture-buk-employee-daily-snapshot',
        'capture-buk-employee-monthly-snapshot'
      );
    exception
      when undefined_table then
        null;
    end;

    perform cron.schedule(
      'capture-buk-employee-monthly-snapshot',
      '30 3 1 * *',
      $cron$select public.capture_buk_employee_monthly_snapshot((date_trunc('month', current_date)::date - interval '1 day')::date);$cron$
    );
  end if;
exception
  when others then
    raise notice 'No fue posible programar snapshot mensual BUK: %', sqlerrm;
end
$$;

with latest_audit as (
  select id
  from public.buk_employee_snapshot_compaction_audit
  where action = 'convert_buk_employee_snapshot_to_monthly_closed_periods'
  order by executed_at desc
  limit 1
)
update public.buk_employee_snapshot_compaction_audit audit
set
  normalized_rows_after = snapshot_stats.rows_after,
  distinct_snapshot_dates_after = snapshot_stats.dates_after,
  total_relation_bytes_after = snapshot_stats.total_bytes_after
from latest_audit
cross join lateral (
  select
    count(*)::bigint as rows_after,
    count(distinct snapshot_date)::integer as dates_after,
    pg_total_relation_size('public.buk_employees_daily_snapshot'::regclass)::bigint as total_bytes_after
  from public.buk_employees_daily_snapshot
) snapshot_stats
where audit.id = latest_audit.id;

notify pgrst, 'reload schema';

commit;
