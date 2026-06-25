begin;

insert into public.role_module_access (role_code, module_code, can_view)
values ('control_contratos', 'recursos_humanos', true)
on conflict (role_code, module_code) do update
set can_view = excluded.can_view;

notify pgrst, 'reload schema';

commit;
