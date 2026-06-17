begin;

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
    'is_super_admin', profile_record.is_super_admin
  );
end;
$function$;

revoke all on function public.get_my_effective_permissions() from public, anon;
grant execute on function public.get_my_effective_permissions() to authenticated;

notify pgrst, 'reload schema';

commit;
