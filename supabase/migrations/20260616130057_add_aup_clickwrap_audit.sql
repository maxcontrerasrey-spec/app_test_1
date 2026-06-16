begin;

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists aup_accepted_at timestamptz;

create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  ip_address text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_security_audit_logs_user_created_at
  on public.security_audit_logs (user_id, created_at desc);

create index if not exists idx_security_audit_logs_event_created_at
  on public.security_audit_logs (event_type, created_at desc);

alter table public.security_audit_logs enable row level security;

drop policy if exists "security_audit_logs_insert_self" on public.security_audit_logs;
create policy "security_audit_logs_insert_self"
on public.security_audit_logs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "security_audit_logs_select_admin" on public.security_audit_logs;
create policy "security_audit_logs_select_admin"
on public.security_audit_logs
for select
to authenticated
using (public.user_is_admin(auth.uid()));

revoke all on public.security_audit_logs from public, anon, authenticated;
grant select on public.security_audit_logs to authenticated;

create or replace function public.resolve_request_ip_address(p_ip_address text default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  request_headers jsonb;
  resolved_ip text;
begin
  resolved_ip := nullif(trim(coalesce(p_ip_address, '')), '');

  if resolved_ip is not null then
    return left(resolved_ip, 255);
  end if;

  begin
    request_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception
    when others then
      request_headers := '{}'::jsonb;
  end;

  resolved_ip := nullif(trim(coalesce(
    request_headers ->> 'cf-connecting-ip',
    request_headers ->> 'x-real-ip',
    split_part(coalesce(request_headers ->> 'x-forwarded-for', ''), ',', 1)
  )), '');

  return left(resolved_ip, 255);
end;
$function$;

create or replace function public.log_profile_aup_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.aup_accepted_at is not null
    and old.aup_accepted_at is distinct from new.aup_accepted_at then
    insert into public.security_audit_logs (
      user_id,
      event_type,
      ip_address
    )
    values (
      new.id,
      'aup_accepted',
      public.resolve_request_ip_address(current_setting('app.aup_ip_address', true))
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_profiles_log_aup_acceptance on public.profiles;
create trigger trg_profiles_log_aup_acceptance
after update of aup_accepted_at on public.profiles
for each row
execute function public.log_profile_aup_acceptance();

create or replace function public.accept_aup_policy(p_ip_address text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  accepted_timestamp timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = current_user_id
  ) then
    raise exception 'Perfil de usuario no encontrado';
  end if;

  perform set_config('app.aup_ip_address', nullif(trim(coalesce(p_ip_address, '')), ''), true);

  update public.profiles
  set
    aup_accepted_at = accepted_timestamp,
    updated_at = accepted_timestamp
  where id = current_user_id;

  return accepted_timestamp;
end;
$function$;

create or replace function public.get_my_effective_permissions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  profile_record public.profiles%rowtype;
  role_codes text[] := '{}'::text[];
  module_codes text[] := '{}'::text[];
  capability_codes text[] := '{}'::text[];
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into profile_record
    from public.profiles p
   where p.id = current_user_id;

  if profile_record.id is null then
    return jsonb_build_object(
      'profile', null,
      'app_roles', '[]'::jsonb,
      'accessible_modules', '[]'::jsonb,
      'capabilities', '[]'::jsonb,
      'is_super_admin', false
    );
  end if;

  select coalesce(array_agg(distinct ur.role_code order by ur.role_code), '{}'::text[])
    into role_codes
    from public.user_roles ur
    join public.app_roles ar
      on ar.code = ur.role_code
   where ur.user_id = current_user_id
     and ar.is_active = true;

  if profile_record.is_super_admin = true or 'admin' = any(role_codes) then
    select coalesce(array_agg(am.code order by am.sort_order, am.code), '{}'::text[])
      into module_codes
      from public.app_modules am
     where am.is_active = true;

    select coalesce(array_agg(ac.code order by ac.code), '{}'::text[])
      into capability_codes
      from public.app_capabilities ac
     where ac.is_active = true;
  else
    select coalesce(array_agg(module_row.code order by module_row.sort_order, module_row.code), '{}'::text[])
      into module_codes
      from (
        select distinct
          am.code,
          am.sort_order
        from public.user_roles ur
        join public.app_roles ar
          on ar.code = ur.role_code
        join public.role_module_access rma
          on rma.role_code = ur.role_code
        join public.app_modules am
          on am.code = rma.module_code
       where ur.user_id = current_user_id
         and ar.is_active = true
         and rma.can_view = true
         and am.is_active = true
      ) as module_row;

    if exists (
      select 1
      from public.hr_incentive_request_approvals hira
      where hira.approver_user_id = current_user_id
        and hira.status = 'pending'
    ) then
      module_codes := array(
        select distinct module_code
        from unnest(array_append(module_codes, 'recursos_humanos')) as module_code
        order by module_code
      );
    end if;

    select coalesce(array_agg(capability_row.code order by capability_row.code), '{}'::text[])
      into capability_codes
      from (
        select distinct ac.code
        from public.user_roles ur
        join public.app_roles ar
          on ar.code = ur.role_code
        join public.role_capabilities rc
          on rc.role_code = ur.role_code
        join public.app_capabilities ac
          on ac.code = rc.capability_code
       where ur.user_id = current_user_id
         and ar.is_active = true
         and ac.is_active = true
      ) as capability_row;
  end if;

  return jsonb_build_object(
    'profile',
    jsonb_build_object(
      'id', profile_record.id,
      'email', profile_record.email,
      'full_name', profile_record.full_name,
      'job_title', profile_record.job_title,
      'department', profile_record.department,
      'status', profile_record.status,
      'is_super_admin', profile_record.is_super_admin,
      'must_reset_password', profile_record.must_reset_password,
      'aup_accepted_at', profile_record.aup_accepted_at
    ),
    'app_roles', to_jsonb(role_codes),
    'accessible_modules', to_jsonb(module_codes),
    'capabilities', to_jsonb(capability_codes),
    'is_super_admin', profile_record.is_super_admin
  );
end;
$function$;

revoke all on function public.resolve_request_ip_address(text) from public, anon, authenticated;
revoke all on function public.accept_aup_policy(text) from public, anon;
revoke all on function public.get_my_effective_permissions() from public, anon;

grant execute on function public.accept_aup_policy(text) to authenticated;
grant execute on function public.get_my_effective_permissions() to authenticated;

notify pgrst, 'reload schema';

commit;
