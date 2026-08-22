-- Sincronización puntual del cargo creado recientemente en BUK.
-- La sincronización automática ya había corrido antes de que BUK publicara este rol.
insert into public.job_positions (code, name, is_active)
select 'BUK-ROLE-1757', 'Ingeniero especialista Planificación y control', true
where not exists (
  select 1
  from public.job_positions
  where code = 'BUK-ROLE-1757'
     or name = 'Ingeniero especialista Planificación y control'
);
