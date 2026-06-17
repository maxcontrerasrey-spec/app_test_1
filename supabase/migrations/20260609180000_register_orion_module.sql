begin;

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values (
  'ai_assistant',
  'ORION',
  '/copiloto-ia',
  'Copiloto interno con backend seguro y memoria persistente.',
  70,
  true
)
on conflict (code) do update
set
  name = excluded.name,
  route = excluded.route,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.role_module_access (role_code, module_code, can_view)
values ('admin', 'ai_assistant', true)
on conflict (role_code, module_code) do update
set can_view = true;

delete from public.role_module_access
where module_code = 'ai_assistant'
  and role_code <> 'admin';

commit;
