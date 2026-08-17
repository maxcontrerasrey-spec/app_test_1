begin;

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

  delete from public.user_roles
  where user_id = target_profile_id
    and role_code = 'desarrollador';

  insert into public.user_roles (user_id, role_code, assigned_by)
  values (
    target_profile_id,
    'admin',
    (
      select assigning_user.id
      from public.profiles assigning_user
      where lower(assigning_user.email) = 'maximiliano.contreras@busesjm.com'
      limit 1
    )
  )
  on conflict (user_id, role_code) do nothing;

  update public.profiles
  set is_super_admin = false,
      updated_at = timezone('utc', now())
  where id = target_profile_id;
end;
$$;

notify pgrst, 'reload schema';

commit;
