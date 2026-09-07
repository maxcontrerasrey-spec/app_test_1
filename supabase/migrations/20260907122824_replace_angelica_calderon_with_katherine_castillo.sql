-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; restore access only through an audited successor change.
begin;

do $$
declare
  katherine_id uuid := '82376c17-532c-4d12-ae38-dca3bbcce447';
  angelica_id uuid := 'eefcf398-5d20-47b9-af89-afedfdce0ef2';
begin
  if not exists (select 1 from auth.users where id = katherine_id) then
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      katherine_id,
      'authenticated',
      'authenticated',
      'katherine.castillo@busesjm.com',
      crypt(encode(gen_random_bytes(32), 'base64'), gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Katherine Castillo Herrera","name":"Katherine Castillo Herrera","job_title":"Asistente de RRHH"}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now())
    );
  end if;

  update public.profiles
     set email = 'katherine.castillo@busesjm.com',
         full_name = 'Katherine Castillo Herrera',
         job_title = 'Asistente de RRHH',
         department = null,
         status = 'active',
         is_super_admin = false,
         must_reset_password = true,
         updated_at = timezone('utc', now())
   where id = katherine_id;

  insert into public.user_roles (user_id, role_code, assigned_by)
  values (katherine_id, 'administrativo', null)
  on conflict (user_id, role_code) do nothing;

  update public.profiles
     set status = 'inactive',
         updated_at = timezone('utc', now())
   where id = angelica_id;

  update auth.users
     set banned_until = timezone('utc', now()) + interval '100 years',
         updated_at = timezone('utc', now())
   where id = angelica_id;

  delete from auth.sessions where user_id = angelica_id;
end;
$$;

commit;
