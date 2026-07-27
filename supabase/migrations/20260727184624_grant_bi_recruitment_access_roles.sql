begin;

with target_roles(role_code) as (
  values
    ('admin'),
    ('reclutamiento'),
    ('control_contratos'),
    ('director_eje'),
    ('gerente_general'),
    ('director_op'),
    ('gerencia')
)
insert into public.role_module_access (role_code, module_code, can_view)
select tr.role_code, 'bi_analytics', true
from target_roles tr
join public.app_roles ar
  on ar.code = tr.role_code
 and ar.is_active = true
join public.app_modules am
  on am.code = 'bi_analytics'
 and am.is_active = true
on conflict (role_code, module_code)
do update set
  can_view = true,
  updated_at = timezone('utc', now());

with target_roles(role_code) as (
  values
    ('admin'),
    ('reclutamiento'),
    ('control_contratos'),
    ('director_eje'),
    ('gerente_general'),
    ('director_op'),
    ('gerencia')
)
insert into public.role_feature_access (role_code, feature_code, can_access)
select tr.role_code, 'bi_reclutamiento', true
from target_roles tr
join public.app_roles ar
  on ar.code = tr.role_code
 and ar.is_active = true
join public.app_features af
  on af.code = 'bi_reclutamiento'
 and af.is_active = true
on conflict (role_code, feature_code)
do update set
  can_access = true,
  updated_at = timezone('utc', now());

do $$
declare
  missing_count integer;
begin
  select count(*)
    into missing_count
    from (
      values
        ('admin'),
        ('reclutamiento'),
        ('control_contratos'),
        ('director_eje'),
        ('gerente_general'),
        ('director_op'),
        ('gerencia')
    ) as target_roles(role_code)
   where not exists (
      select 1
        from public.role_module_access rma
       where rma.role_code = target_roles.role_code
         and rma.module_code = 'bi_analytics'
         and rma.can_view = true
    )
      or not exists (
        select 1
          from public.role_feature_access rfa
         where rfa.role_code = target_roles.role_code
           and rfa.feature_code = 'bi_reclutamiento'
           and rfa.can_access = true
      );

  if missing_count <> 0 then
    raise exception 'BI recruitment access grant failed for % role(s)', missing_count;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
