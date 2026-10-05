begin;

do $migration$
begin
  if not exists (
    select 1
    from public.app_modules
    where code = 'portal_comunicaciones'
      and is_active
  ) then
    raise exception 'No existe el módulo activo portal_comunicaciones';
  end if;

  if exists (
    select 1
    from public.app_modules
    where route = '/recursos-humanos/comunicaciones'
      and code <> 'portal_comunicaciones'
  ) then
    raise exception 'La ruta /recursos-humanos/comunicaciones ya pertenece a otro módulo';
  end if;
end;
$migration$;

update public.app_modules
set route = '/recursos-humanos/comunicaciones',
    updated_at = timezone('utc', now())
where code = 'portal_comunicaciones';

commit;
