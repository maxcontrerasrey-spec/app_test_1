begin;

insert into public.role_module_access (role_code, module_code, can_view)
select 'control_contratos', 'control_contrataciones', true
where exists (
  select 1 from public.app_roles where code = 'control_contratos' and is_active = true
)
  and exists (
    select 1 from public.app_modules where code = 'control_contrataciones' and is_active = true
  )
on conflict (role_code, module_code)
do update set can_view = true;

insert into public.role_feature_access (role_code, feature_code, can_access)
select 'control_contratos', feature_code, true
from (
  values
    ('recruitment_processes_summary'),
    ('recruitment_candidate_control'),
    ('recruitment_personnel_to_hire'),
    ('recruitment_internal_mobility')
) as requested(feature_code)
join public.app_features af
  on af.code = requested.feature_code
 and af.module_code = 'control_contrataciones'
 and af.is_active = true
where exists (
  select 1 from public.app_roles where code = 'control_contratos' and is_active = true
)
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
        ('module', 'control_contrataciones'),
        ('feature', 'recruitment_processes_summary'),
        ('feature', 'recruitment_candidate_control'),
        ('feature', 'recruitment_personnel_to_hire'),
        ('feature', 'recruitment_internal_mobility')
    ) as required(kind, code)
   where (required.kind = 'module' and not exists (
            select 1
              from public.role_module_access rma
             where rma.module_code = required.code
               and rma.role_code = 'control_contratos'
               and rma.can_view = true
          ))
      or (required.kind = 'feature' and not exists (
            select 1
              from public.role_feature_access rfa
             where rfa.feature_code = required.code
               and rfa.role_code = 'control_contratos'
               and rfa.can_access = true
          ));

  if missing_count <> 0 then
    raise exception 'Control de contratos read access grant failed for % permission(s)', missing_count;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
