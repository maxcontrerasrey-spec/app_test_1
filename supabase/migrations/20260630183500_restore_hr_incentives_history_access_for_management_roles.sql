begin;

insert into public.role_module_access (role_code, module_code, can_view)
values
  ('gerencia', 'recursos_humanos', true),
  ('control_contratos', 'recursos_humanos', true)
on conflict (role_code, module_code)
do update set
  can_view = excluded.can_view;

insert into public.role_feature_access (role_code, feature_code, can_access)
values
  ('gerencia', 'hr_incentives_history', true),
  ('control_contratos', 'hr_incentives_history', true)
on conflict (role_code, feature_code)
do update set
  can_access = excluded.can_access,
  updated_at = timezone('utc', now());

commit;
