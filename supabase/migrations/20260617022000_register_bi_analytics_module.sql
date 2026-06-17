-- Migration: register_bi_analytics_module
-- Description: Registers the Business Intelligence analytics module and its role grants.

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values (
  'bi_analytics',
  'Business Intelligence (BI)',
  '/bi',
  'Dashboards analíticos de dotación, ausentismo e incentivos.',
  15,
  true
) on conflict (code) do nothing;

insert into public.role_module_access (role_code, module_code, can_view)
values
  ('director_eje', 'bi_analytics', true),
  ('gerente_general', 'bi_analytics', true),
  ('director_op', 'bi_analytics', true),
  ('gerencia', 'bi_analytics', true),
  ('operaciones_l_1', 'bi_analytics', true),
  ('control_contratos', 'bi_analytics', true),
  ('admin', 'bi_analytics', true)
on conflict (role_code, module_code) do update set
  can_view = excluded.can_view;
