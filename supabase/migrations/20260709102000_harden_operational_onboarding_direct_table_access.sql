begin;

create or replace function public.user_can_access_operational_onboarding(target_user_id uuid)
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
      or public.user_can_access_module(target_user_id, 'alta_operacional_personal');
end;
$function$;

create or replace function public.user_can_manage_operational_onboarding(p_actor_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if p_actor_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> p_actor_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(p_actor_id)
      or public.user_can_access_module(p_actor_id, 'alta_operacional_personal');
end;
$function$;

alter function public.create_operational_onboarding_template(
  text, text, text, text, text, text, text, text, text, boolean, text
) security definer;

alter function public.update_operational_onboarding_template(
  uuid, text, text, text, text, text, text, text, text, text, boolean, text
) security definer;

alter function public.upsert_operational_onboarding_template_task(
  uuid, uuid, text, text, text, text, boolean, boolean, boolean, text, integer, integer, uuid, boolean, text
) security definer;

alter function public.delete_operational_onboarding_template_task(uuid, text)
security definer;

revoke all on public.onboarding_templates from public, anon, authenticated;
revoke all on public.onboarding_template_tasks from public, anon, authenticated;
revoke all on public.onboarding_template_activity_log from public, anon, authenticated;
revoke all on public.employee_onboarding_cases from public, anon, authenticated;
revoke all on public.employee_onboarding_tasks from public, anon, authenticated;
revoke all on public.employee_onboarding_evidence from public, anon, authenticated;
revoke all on public.employee_onboarding_activity_log from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'onboarding_courses_catalog',
    'onboarding_processes',
    'onboarding_employee_courses'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
