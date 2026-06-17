begin;

create table if not exists public.app_capabilities (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint app_capabilities_code_format check (code = lower(code))
);

create table if not exists public.role_capabilities (
  role_code text not null references public.app_roles (code) on delete cascade,
  capability_code text not null references public.app_capabilities (code) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_code, capability_code)
);

create index if not exists idx_role_capabilities_capability_code
  on public.role_capabilities (capability_code);

drop trigger if exists trg_app_capabilities_set_updated_at on public.app_capabilities;
create trigger trg_app_capabilities_set_updated_at
before update on public.app_capabilities
for each row
execute function public.set_updated_at();

alter table public.app_capabilities enable row level security;
alter table public.role_capabilities enable row level security;

drop policy if exists "app_capabilities_select_authenticated" on public.app_capabilities;
create policy "app_capabilities_select_authenticated"
on public.app_capabilities
for select
to authenticated
using (true);

drop policy if exists "role_capabilities_select_authenticated" on public.role_capabilities;
create policy "role_capabilities_select_authenticated"
on public.role_capabilities
for select
to authenticated
using (true);

insert into public.app_capabilities (code, name, description)
values (
  'can_approve_who_stage',
  'Aprobar etapa Who',
  'Permite aprobar antecedentes y desbloquear la transición desde who_pending.'
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.role_capabilities (role_code, capability_code)
values ('admin', 'can_approve_who_stage')
on conflict (role_code, capability_code) do nothing;

create or replace function public.user_has_capability(target_user_id uuid, target_capability_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_capabilities ac
    where ac.code = lower(target_capability_code)
      and ac.is_active = true
      and public.user_is_admin(target_user_id)
  ) or exists (
    select 1
    from public.user_roles ur
    join public.app_roles ar
      on ar.code = ur.role_code
    join public.role_capabilities rc
      on rc.role_code = ur.role_code
    join public.app_capabilities ac
      on ac.code = rc.capability_code
    where ur.user_id = target_user_id
      and rc.capability_code = lower(target_capability_code)
      and ar.is_active = true
      and ac.is_active = true
  );
$$;

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
      'must_reset_password', profile_record.must_reset_password
    ),
    'app_roles', to_jsonb(role_codes),
    'accessible_modules', to_jsonb(module_codes),
    'capabilities', to_jsonb(capability_codes),
    'is_super_admin', profile_record.is_super_admin
  );
end;
$function$;

revoke all on function public.user_has_capability(uuid, text) from public, anon;
grant execute on function public.user_has_capability(uuid, text) to authenticated;

revoke all on function public.get_my_effective_permissions() from public, anon;
grant execute on function public.get_my_effective_permissions() to authenticated;

notify pgrst, 'reload schema';

commit;
