begin;

create or replace function public.user_has_capability(target_user_id uuid, target_capability_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_capability_code text := lower(trim(coalesce(target_capability_code, '')));
begin
  if target_user_id is null or normalized_capability_code = '' then
    return false;
  end if;

  if current_user_id is null then
    return false;
  end if;

  if current_user_id <> target_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return exists (
    select 1
    from public.app_capabilities ac
    where ac.code = normalized_capability_code
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
      and rc.capability_code = normalized_capability_code
      and ar.is_active = true
      and ac.is_active = true
  );
end;
$function$;

revoke all on function public.user_has_capability(uuid, text) from public, anon;
grant execute on function public.user_has_capability(uuid, text) to authenticated;

create or replace function public.user_can_access_feature(target_user_id uuid, target_feature_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_feature_code text := lower(trim(coalesce(target_feature_code, '')));
begin
  if target_user_id is null or normalized_feature_code = '' then
    return false;
  end if;

  if current_user_id is null then
    return false;
  end if;

  if current_user_id <> target_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return exists (
    select 1
    from public.app_features af
    where af.code = normalized_feature_code
      and af.is_active = true
      and (
        public.user_is_admin(target_user_id)
        or exists (
          select 1
          from public.user_roles ur
          join public.app_roles ar
            on ar.code = ur.role_code
           and ar.is_active = true
          join public.role_feature_access rfa
            on rfa.role_code = ur.role_code
           and rfa.feature_code = af.code
           and rfa.can_access = true
          where ur.user_id = target_user_id
        )
      )
  );
end;
$function$;

revoke all on function public.user_can_access_feature(uuid, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
