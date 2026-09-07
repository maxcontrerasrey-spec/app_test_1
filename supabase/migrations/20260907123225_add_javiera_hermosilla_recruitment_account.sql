-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; access changes require a subsequent audited migration.
begin;

do $$
declare
  javiera_id uuid := '96a2fc9b-bd95-43ef-94ef-d2c3fb67b1aa';
begin
  if not exists (select 1 from auth.users where id = javiera_id) then
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      javiera_id,
      'authenticated',
      'authenticated',
      'javiera.hermosilla@busesjm.com',
      crypt(encode(gen_random_bytes(32), 'base64'), gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Javiera Hermosilla Badilla","name":"Javiera Hermosilla Badilla","job_title":"Asistente de RRHH"}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now())
    );
  end if;

  update public.profiles
     set email = 'javiera.hermosilla@busesjm.com',
         full_name = 'Javiera Hermosilla Badilla',
         job_title = 'Asistente de RRHH',
         department = null,
         status = 'active',
         is_super_admin = false,
         must_reset_password = true,
         updated_at = timezone('utc', now())
   where id = javiera_id;

  insert into public.user_roles (user_id, role_code, assigned_by)
  values (javiera_id, 'administrativo', null)
  on conflict (user_id, role_code) do nothing;
end;
$$;

commit;
