begin;

insert into public.app_roles (code, name, description, is_active)
values (
  'desarrollador',
  'Desarrollador',
  'Desarrollo del ERP con acceso funcional acotado al dominio de Recursos Humanos.',
  true
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.role_module_access (role_code, module_code, can_view)
select 'desarrollador', am.code, true
from public.app_modules am
where am.code in (
  'recursos_humanos',
  'jornadas_turnos',
  'acreditacion_personas',
  'solicitud_sanciones',
  'bi_analytics'
)
on conflict (role_code, module_code) do update
set can_view = excluded.can_view;

insert into public.role_feature_access (role_code, feature_code, can_access)
select 'desarrollador', af.code, true
from public.app_features af
where af.code in (
  'roster_calendar',
  'roster_assign_pattern',
  'roster_manage_patterns',
  'hr_incentives_register',
  'hr_incentives_approvals',
  'hr_incentives_history',
  'hr_incentives_configuration',
  'bi_dotacion',
  'bi_incentivos'
)
on conflict (role_code, feature_code) do update
set
  can_access = excluded.can_access,
  updated_at = timezone('utc', now());

do $$
declare
  target_profile_id uuid;
begin
  select p.id
  into target_profile_id
  from public.profiles p
  where lower(p.email) = 'renato.martinez@busesjm.com'
  limit 1;

  if target_profile_id is null then
    raise exception 'No existe el perfil de Renato Martinez';
  end if;

  insert into public.user_roles (user_id, role_code, assigned_by)
  values (
    target_profile_id,
    'desarrollador',
    (
      select assigning_user.id
      from public.profiles assigning_user
      where lower(assigning_user.email) = 'maximiliano.contreras@busesjm.com'
      limit 1
    )
  )
  on conflict (user_id, role_code) do nothing;
end;
$$;

create or replace function public.user_can_manage_hr_sanctions(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(public.user_is_admin(p_actor_id), false)
    or coalesce(public.user_has_role(p_actor_id, 'desarrollador'), false);
$function$;

notify pgrst, 'reload schema';

commit;
