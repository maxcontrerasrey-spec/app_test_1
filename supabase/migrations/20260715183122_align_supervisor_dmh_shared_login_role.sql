begin;

update public.shared_login_operator_choices
set
  operator_role = 'Supervisor de Operaciones',
  updated_at = timezone('utc', now())
where login_email_normalized = 'supervisor.dmh@busesjm.com'
  and operator_key in ('david_alvarez_alvarez', 'sergio_alvarado_lopez');

update public.profiles
set
  full_name = 'Supervisores Operaciones DMH',
  job_title = 'Supervisor de Operaciones',
  department = 'Operaciones',
  status = 'active',
  must_reset_password = true,
  updated_at = timezone('utc', now())
where lower(email) = 'supervisor.dmh@busesjm.com';

insert into public.user_roles (user_id, role_code, assigned_by)
select p.id, 'operaciones_l_2', null
from public.profiles p
where lower(p.email) = 'supervisor.dmh@busesjm.com'
on conflict (user_id, role_code) do nothing;

notify pgrst, 'reload schema';

commit;
