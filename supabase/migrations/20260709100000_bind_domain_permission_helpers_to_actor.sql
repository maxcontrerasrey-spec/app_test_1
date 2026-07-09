begin;

create or replace function public.user_can_access_candidate_control(target_user_id uuid)
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
      or public.user_has_capability(target_user_id, 'candidate_control_access');
end;
$function$;

create or replace function public.user_can_manage_operations(target_user_id uuid)
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
      or public.user_can_access_module(target_user_id, 'operaciones');
end;
$function$;

create or replace function public.user_can_manage_accreditation(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if p_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> p_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_can_access_module(p_user_id, 'acreditacion_personas')
      or public.user_is_admin(p_user_id);
end;
$function$;

create or replace function public.user_can_manage_hr_incentives(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if p_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> p_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(p_user_id)
      or public.user_can_access_feature(p_user_id, 'hr_incentives_register')
      or public.user_can_access_feature(p_user_id, 'hr_incentives_approvals')
      or public.user_can_access_feature(p_user_id, 'hr_incentives_history')
      or public.user_can_access_feature(p_user_id, 'hr_incentives_configuration');
end;
$function$;

create or replace function public.user_can_view_hr_incentive_analytics(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if p_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> p_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(p_user_id)
      or public.user_can_access_feature(p_user_id, 'bi_incentivos');
end;
$function$;

create or replace function public.user_can_access_bi_analytics(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if p_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> p_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(p_user_id)
      or public.user_can_access_feature(p_user_id, 'bi_dotacion')
      or public.user_can_access_feature(p_user_id, 'bi_incentivos')
      or public.user_can_access_feature(p_user_id, 'bi_reclutamiento');
end;
$function$;

revoke all on function public.user_can_generate_buk_candidates(uuid)
from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
