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
  'compact_buk_employee_daily_snapshot_drop_raw_payload',
  count(*)::bigint,
  count(distinct snapshot_date)::integer,
  min(snapshot_date),
  max(snapshot_date),
  count(*) filter (where is_active)::bigint,
  count(*) filter (where not is_active)::bigint,
  coalesce(sum(pg_column_size(raw_payload)), 0)::bigint,
  pg_total_relation_size('public.buk_employees_daily_snapshot'::regclass)::bigint,
  coalesce(pg_total_relation_size(
    (select reltoastrelid from pg_class where oid = 'public.buk_employees_daily_snapshot'::regclass)
  ), 0)::bigint,
  'Conserva columnas historicas normalizadas para BI y elimina la copia diaria del JSON crudo BUK. El payload crudo vigente permanece en public.employees para operacion actual.'
from public.buk_employees_daily_snapshot;

create table public.buk_employees_daily_snapshot_compact (
  snapshot_date date not null,
  buk_employee_id text not null,
  full_name text not null,
  email text,
  job_title text,
  contract_code text,
  area_name text,
  area_code text,
  document_number text,
  document_type text,
  birth_date date,
  hire_date date,
  city_name text,
  region_name text,
  status text,
  is_active boolean not null default true,
  captured_at timestamptz not null default timezone('utc', now()),
  primary key (snapshot_date, buk_employee_id)
);

insert into public.buk_employees_daily_snapshot_compact (
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
  captured_at
)
select
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
  captured_at
from public.buk_employees_daily_snapshot;

alter table public.buk_employees_daily_snapshot rename to buk_employees_daily_snapshot_raw_archive_drop_20260715;
alter table public.buk_employees_daily_snapshot_compact rename to buk_employees_daily_snapshot;

drop table public.buk_employees_daily_snapshot_raw_archive_drop_20260715;

alter table public.buk_employees_daily_snapshot enable row level security;

drop policy if exists "buk_employee_snapshot_select_authenticated" on public.buk_employees_daily_snapshot;
create policy "buk_employee_snapshot_select_authenticated"
on public.buk_employees_daily_snapshot
for select
to authenticated
using (
  public.user_can_access_module(auth.uid(), 'bi_analytics')
  or public.user_is_admin(auth.uid())
);

grant select on public.buk_employees_daily_snapshot to authenticated;

create index if not exists idx_buk_employee_snapshot_date_active
  on public.buk_employees_daily_snapshot (snapshot_date desc, is_active);

create index if not exists idx_buk_employee_snapshot_contract
  on public.buk_employees_daily_snapshot (snapshot_date desc, contract_code, area_name);

create index if not exists idx_buk_employee_snapshot_job
  on public.buk_employees_daily_snapshot (snapshot_date desc, job_title);

create index if not exists idx_buk_employee_snapshot_city
  on public.buk_employees_daily_snapshot (snapshot_date desc, region_name, city_name);

create or replace function public.capture_buk_employee_daily_snapshot(p_snapshot_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  target_snapshot_date date := coalesce(p_snapshot_date, current_date);
  inserted_count integer := 0;
begin
  if not public.current_request_has_service_role()
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

revoke all on function public.capture_buk_employee_daily_snapshot(date) from public, anon;
grant execute on function public.capture_buk_employee_daily_snapshot(date) to authenticated, service_role;

with latest_audit as (
  select id
  from public.buk_employee_snapshot_compaction_audit
  where action = 'compact_buk_employee_daily_snapshot_drop_raw_payload'
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

commit;
