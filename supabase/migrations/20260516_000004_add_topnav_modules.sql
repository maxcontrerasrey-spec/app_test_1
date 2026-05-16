begin;

insert into public.app_modules (code, name, route, description, sort_order)
values
  (
    'operaciones',
    'Operaciones',
    '/operaciones',
    'Panel operativo reservado para procesos y herramientas del area de operaciones.',
    50
  ),
  (
    'recursos_humanos',
    'Recursos Humanos',
    '/recursos-humanos',
    'Panel reservado para procesos y herramientas del area de recursos humanos.',
    60
  )
on conflict (code) do update
set
  name = excluded.name,
  route = excluded.route,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.role_module_access (role_code, module_code, can_view)
values
  ('admin', 'operaciones', true),
  ('admin', 'recursos_humanos', true)
on conflict (role_code, module_code) do update
set can_view = excluded.can_view;

commit;
