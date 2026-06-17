begin;

do $$
declare
  source_user_id uuid;
  source_is_super_admin boolean;
  target_user_id uuid;
begin
  select
    p.id,
    p.is_super_admin
  into
    source_user_id,
    source_is_super_admin
  from public.profiles p
  where lower(trim(coalesce(p.full_name, ''))) = lower('Maximiliano Contreras Rey')
  order by p.updated_at desc
  limit 1;

  if source_user_id is null then
    raise exception 'No se encontro el perfil fuente de Maximiliano Contreras Rey';
  end if;

  select
    p.id
  into
    target_user_id
  from public.profiles p
  where lower(trim(coalesce(p.full_name, ''))) in (
      lower('Maria Jesus Lagos'),
      lower('Maria Jesus Lagos Minardi')
    )
     or lower(trim(coalesce(p.full_name, ''))) like lower('Maria Jesus Lagos%')
  order by
    case
      when lower(trim(coalesce(p.full_name, ''))) = lower('Maria Jesus Lagos Minardi') then 0
      when lower(trim(coalesce(p.full_name, ''))) = lower('Maria Jesus Lagos') then 1
      else 2
    end,
    p.updated_at desc
  limit 1;

  if target_user_id is null then
    raise exception 'No se encontro el perfil destino de Maria Jesus Lagos';
  end if;

  update public.profiles
     set status = 'active',
         is_super_admin = source_is_super_admin,
         updated_at = timezone('utc', now())
   where id = target_user_id;

  insert into public.user_roles (
    user_id,
    role_code,
    assigned_by
  )
  select
    target_user_id,
    ur.role_code,
    source_user_id
  from public.user_roles ur
  join public.app_roles ar
    on ar.code = ur.role_code
  where ur.user_id = source_user_id
    and ar.is_active = true
  on conflict (user_id, role_code) do nothing;
end $$;

commit;
