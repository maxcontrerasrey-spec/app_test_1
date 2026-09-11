-- EEES-DB-005: approved
-- owner: Engineering and Recruitment
-- rollback: forward-only; restore the prior role assignment and access mappings through a new migration if required.

begin;

insert into public.app_roles (code, name, description, is_active)
values (
  'reclutamiento_consulta',
  'Reclutamiento - Consulta',
  'Consulta de procesos, precandidatos y candidatos sin facultades de modificación.',
  true
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true;

insert into public.role_module_access (role_code, module_code, can_view)
select 'reclutamiento_consulta', 'control_contrataciones', true
where exists (select 1 from public.app_modules where code = 'control_contrataciones' and is_active = true)
on conflict (role_code, module_code) do update
set can_view = true;

insert into public.role_feature_access (role_code, feature_code, can_access)
select 'reclutamiento_consulta', requested.feature_code, true
from (values
  ('recruitment_processes_summary'),
  ('recruitment_candidate_control'),
  ('recruitment_personnel_to_hire'),
  ('recruitment_internal_mobility')
) as requested(feature_code)
join public.app_features af
  on af.code = requested.feature_code
 and af.module_code = 'control_contrataciones'
 and af.is_active = true
on conflict (role_code, feature_code) do update
set can_access = true,
    updated_at = timezone('utc', now());

create or replace function public.user_can_view_recruitment_case(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if target_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> target_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(target_user_id)
    or public.user_has_role(target_user_id, 'reclutamiento')
    or public.user_has_role(target_user_id, 'reclutamiento_consulta')
    or public.user_has_role(target_user_id, 'control_contratos')
    or exists (
      select 1
      from public.recruitment_cases rc
      where rc.id = target_case_id
        and (rc.owner_user_id = target_user_id or rc.recruiter_user_id = target_user_id)
    )
    or public.user_has_capability(target_user_id, 'who_recruitment_access');
end;
$function$;

create or replace function public.user_can_view_dsal_precandidates(actor_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if actor_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> actor_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_can_review_dsal_precandidates(actor_id)
      or public.user_has_role(actor_id, 'reclutamiento_consulta')
      or public.user_has_role(actor_id, 'control_contratos');
end;
$function$;

do $identity$
declare
  angel_id uuid;
begin
  select p.id into angel_id
  from public.profiles p
  where lower(p.email) = 'angel.reinoso@busesjm.com';

  if angel_id is null then
    raise exception 'No se encontró el perfil de Angel Reinoso';
  end if;

  delete from public.user_roles
  where user_id = angel_id
    and role_code in ('reclutamiento', 'control_contratos');

  insert into public.user_roles (user_id, role_code)
  values (angel_id, 'reclutamiento_consulta')
  on conflict (user_id, role_code) do nothing;
end $identity$;

notify pgrst, 'reload schema';

commit;
