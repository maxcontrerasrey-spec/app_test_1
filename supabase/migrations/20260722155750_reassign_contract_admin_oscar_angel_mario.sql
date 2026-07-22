begin;

insert into public.app_roles (code, name, description, is_active)
values (
  'aprobador_folios',
  'Aprobador de Folios',
  'Aprueba o rechaza solicitudes de contratacion en la cadena secuencial.',
  true
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = timezone('utc', now());

do $$
declare
  mario_auth_id uuid;
begin
  select au.id
  into mario_auth_id
  from auth.users au
  where lower(au.email) = 'mario.pizarro@busesjm.com'
  order by au.created_at desc
  limit 1;

  if mario_auth_id is not null then
    insert into public.profiles (
      id,
      email,
      full_name,
      job_title,
      status,
      is_super_admin,
      must_reset_password,
      updated_at
    )
    values (
      mario_auth_id,
      'mario.pizarro@busesjm.com',
      'Mario Pizarro Fernandez',
      'Administrador de Contratos',
      'active',
      false,
      true,
      timezone('utc', now())
    )
    on conflict (id) do update
    set
      email = excluded.email,
      full_name = excluded.full_name,
      job_title = excluded.job_title,
      status = 'active',
      is_super_admin = false,
      must_reset_password = true,
      updated_at = timezone('utc', now());
  end if;
end $$;

with target_users as (
  select p.id, lower(p.email) as email
  from public.profiles p
  where lower(p.email) in (
    'angel.guerra@busesjm.com',
    'mario.pizarro@busesjm.com'
  )
)
insert into public.user_roles (user_id, role_code, assigned_by)
select tu.id, 'aprobador_folios', null
from target_users tu
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = tu.id
    and ur.role_code = 'aprobador_folios'
);

update public.buk_contract_mappings bcm
set
  contract_admin_name = 'Mario Pizarro Fernandez',
  updated_at = timezone('utc', now())
where lower(trim(coalesce(bcm.contract_admin_name, ''))) in (
    lower('Oscar Poblete Celedon'),
    lower('Angel Guerra Basso')
  )
  and (
    coalesce(bcm.contract_name, '') ilike '%SIERRA GORDA%'
    or coalesce(bcm.buk_area_name, '') ilike '%SIERRA GORDA%'
  );

update public.buk_contract_mappings bcm
set
  contract_admin_name = 'Angel Guerra Basso',
  updated_at = timezone('utc', now())
where lower(trim(coalesce(bcm.contract_admin_name, ''))) = lower('Oscar Poblete Celedon')
  and not (
    coalesce(bcm.contract_name, '') ilike '%SIERRA GORDA%'
    or coalesce(bcm.buk_area_name, '') ilike '%SIERRA GORDA%'
  );

notify pgrst, 'reload schema';

commit;
