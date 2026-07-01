begin;

delete from public.role_module_access
where role_code = 'operaciones_l_2'
  and module_code = 'movilidad_interna';

with target_user as (
  select p.id
  from public.profiles p
  where lower(p.email) = 'iarratia@busesjm.com'
  limit 1
)
delete from public.user_roles ur
using target_user tu
where ur.user_id = tu.id
  and ur.role_code = 'operaciones_l_2';

with target_user as (
  select p.id
  from public.profiles p
  where lower(p.email) = 'iarratia@busesjm.com'
  limit 1
),
existing_assignment as (
  select ur.assigned_by
  from public.user_roles ur
  join target_user tu
    on tu.id = ur.user_id
  where ur.role_code = 'operaciones_l_1'
  order by ur.assigned_at desc
  limit 1
),
assigning_user as (
  select coalesce(
    (select ea.assigned_by from existing_assignment ea),
    (
      select p.id
      from public.profiles p
      where lower(p.email) = 'maximiliano.contreras@busesjm.com'
      limit 1
    )
  ) as id
)
insert into public.user_roles (user_id, role_code, assigned_by)
select tu.id, 'operaciones_l_1', au.id
from target_user tu
cross join assigning_user au
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = tu.id
    and ur.role_code = 'operaciones_l_1'
);

notify pgrst, 'reload schema';

commit;
