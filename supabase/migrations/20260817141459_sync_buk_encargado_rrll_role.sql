begin;

do $$
declare
  role_id bigint;
begin
  select id into role_id
    from public.job_positions
   where code = 'BUK-ROLE-67';

  if role_id is null then
    raise exception 'No existe el cargo local BUK-ROLE-67 para sincronizar';
  end if;

  update public.job_positions
     set name = 'ENCARGADO DE RRLL',
         is_active = true,
         updated_at = timezone('utc', now())
   where id = role_id;

  if not exists (
    select 1 from public.job_positions
     where id = role_id
       and code = 'BUK-ROLE-67'
       and name = 'ENCARGADO DE RRLL'
       and is_active = true
  ) then
    raise exception 'El cargo BUK-ROLE-67 no quedo sincronizado';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
