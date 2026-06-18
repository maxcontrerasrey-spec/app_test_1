begin;

insert into public.app_roles (code, name, description, is_active)
values (
  'jefe_administrativo',
  'Jefe Administrativo',
  'Rol de jefatura administrativa con alcance acumulado de Administrativo y Reclutamiento.',
  true
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.role_module_access (role_code, module_code, can_view)
select
  'jefe_administrativo',
  rma.module_code,
  bool_or(rma.can_view)
from public.role_module_access rma
where rma.role_code in ('administrativo', 'reclutamiento')
group by rma.module_code
on conflict (role_code, module_code) do update
set can_view = excluded.can_view;

insert into public.role_capabilities (role_code, capability_code)
select distinct
  'jefe_administrativo',
  rc.capability_code
from public.role_capabilities rc
where rc.role_code in ('administrativo', 'reclutamiento')
on conflict (role_code, capability_code) do nothing;

create or replace function public.user_has_role(target_user_id uuid, target_role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with normalized_target as (
    select lower(trim(target_role_code)) as code
  ),
  effective_roles as (
    select ur.role_code
    from public.user_roles ur
    join public.app_roles ar
      on ar.code = ur.role_code
    where ur.user_id = target_user_id
      and ar.is_active = true

    union all

    select 'administrativo'
    from public.user_roles ur
    join public.app_roles ar
      on ar.code = ur.role_code
    where ur.user_id = target_user_id
      and ur.role_code = 'jefe_administrativo'
      and ar.is_active = true

    union all

    select 'reclutamiento'
    from public.user_roles ur
    join public.app_roles ar
      on ar.code = ur.role_code
    where ur.user_id = target_user_id
      and ur.role_code = 'jefe_administrativo'
      and ar.is_active = true
  )
  select exists (
    select 1
    from effective_roles er
    cross join normalized_target nt
    where er.role_code = nt.code
  );
$$;

with francisco as (
  select p.id
  from public.profiles p
  where lower(p.email) = 'francisco.cordero@busesjm.com'
  limit 1
),
assigner as (
  select p.id
  from public.profiles p
  where lower(p.email) = 'maximiliano.contreras@busesjm.com'
  limit 1
)
delete from public.user_roles ur
using francisco f
where ur.user_id = f.id
  and ur.role_code in ('administrativo', 'reclutamiento', 'jefe_administrativo');

with francisco as (
  select p.id
  from public.profiles p
  where lower(p.email) = 'francisco.cordero@busesjm.com'
  limit 1
),
assigner as (
  select p.id
  from public.profiles p
  where lower(p.email) = 'maximiliano.contreras@busesjm.com'
  limit 1
)
insert into public.user_roles (user_id, role_code, assigned_by)
select f.id, 'jefe_administrativo', a.id
from francisco f
cross join assigner a
on conflict (user_id, role_code) do nothing;

notify pgrst, 'reload schema';

commit;
