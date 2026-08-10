begin;

create or replace function public.is_valid_dsal_precandidate_role(p_value text)
returns boolean
language sql
immutable
set search_path = public
as $function$
  select coalesce(trim(p_value) = any(array[
    'Interno Mina',
    'Furgón Eléctrico',
    'Bus Eléctrico',
    'Ciudades Base',
    'Administrador de Contrato',
    'Aseadores',
    'Bodeguero',
    'Electricista Especialista',
    'Expeditora - Acreditación',
    'Experto Prevención de riesgos',
    'Ingeniero especialista Planificación y control',
    'Jefe de Operaciones',
    'Jefe de taller',
    'Mecánico Especialista',
    'Mecánico especialista carrocería',
    'Personal Administrativo',
    'Supervisor de Terreno'
  ]), false)
$function$;

alter table public.recruitment_precandidates
  drop constraint if exists recruitment_precandidates_dsal_role_check;

alter table public.recruitment_precandidates
  add constraint recruitment_precandidates_dsal_role_check
  check (public.is_valid_dsal_precandidate_role(dsal_role));

insert into public.recruitment_dsal_roster (
  national_id,
  first_name,
  last_name,
  second_last_name,
  source_name,
  is_active
)
values
  ('184036991', 'Camilo Nicolas', 'Hidalgo', 'Rojas', 'nomina DSAL ECO04', true),
  ('252317848', 'Eneida', 'Rosales', 'Vargas', 'nomina DSAL ECO04', true),
  ('112543015', 'Maria Elizabeth', 'Vasquez', 'Aranda', 'nomina DSAL ECO04', true),
  ('87035204', 'Sylvia Myriam', 'Carvajal', 'Salinas', 'nomina DSAL ECO04', true),
  ('16135631K', 'Carolina Andrea', 'Balcazar', 'Araya', 'nomina DSAL ECO04', true),
  ('168786859', 'Nicole Francisca', 'Campillay', 'Rojas', 'nomina DSAL ECO04', true),
  ('26891496K', 'Lenise', 'Seide', '', 'nomina DSAL ECO04', true),
  ('143520471', 'Evelyn Patricia', 'Munoz', 'Rivera', 'nomina DSAL ECO04', true),
  ('107318836', 'Nilda Del Transito', 'Gomez', 'Cortes', 'nomina DSAL ECO04', true),
  ('125679153', 'Teresa Elena', 'Pena', 'Alvarez', 'nomina DSAL ECO04', true),
  ('170382080', 'Cristian Javier', 'Olmedo', 'Sapiain', 'nomina DSAL ECO04', true),
  ('182605689', 'Manuel Ignacio', 'Moyano', 'Quiroz', 'nomina DSAL ECO04', true),
  ('161747130', 'Emilio Eduardo', 'Quezada', 'Munizaga', 'nomina DSAL ECO04', true),
  ('159759148', 'Maykol Gerardo', 'Alvarez', 'Serrano', 'nomina DSAL ECO04', true),
  ('144484592', 'Sergio Andres', 'Guajardo', 'Gonzalez', 'nomina DSAL ECO04', true),
  ('179882728', 'Alejandro Moises', 'Gomez', 'Altamirano', 'nomina DSAL ECO04', true),
  ('263346114', 'Yohan Antonio', 'Arguelles', 'Garcia', 'nomina DSAL ECO04', true),
  ('187108543', 'Cindy Nicole', 'Hidalgo', 'Astorga', 'nomina DSAL ECO04', true),
  ('150288924', 'Francisco Javier', 'Figueroa', 'Rojas', 'nomina DSAL ECO04', true),
  ('195593167', 'Carolaine Danitza', 'Catalan', 'Ruiz', 'nomina DSAL ECO04', true),
  ('192714184', 'Maria Jose', 'Araya', 'Herrera', 'nomina DSAL ECO04', true),
  ('141518615', 'Paula Andrea', 'Martinez', 'Machuca', 'nomina DSAL ECO04', true),
  ('172040780', 'Jaime Andres', 'Pasten', 'Perez', 'nomina DSAL ECO04', true),
  ('18705981K', 'Felipe Alexander', 'Porta', 'Veliz', 'nomina DSAL ECO04', true),
  ('182701890', 'Luis Alexis', 'Correa', 'Silva', 'nomina DSAL ECO04', true),
  ('142014858', 'Juan Pablo', 'Gonzalez', 'Benavides', 'nomina DSAL ECO04', true),
  ('133578064', 'Armando Alfonso', 'Aguilera', 'Carvajal', 'nomina DSAL ECO04', true),
  ('87229165', 'Baltazar Del Rosario', 'Pasten', 'Lopez', 'nomina DSAL ECO04', true),
  ('13299904K', 'Sergio Luis', 'Araya', 'Mondaca', 'nomina DSAL ECO04', true),
  ('274765615', 'Juan Fernando', 'Reyes', 'Fernandez', 'nomina DSAL ECO04', true),
  ('82565329', 'Nilo Alberto', 'Castro', 'Flores', 'nomina DSAL ECO04', true),
  ('258382501', 'Samuel', 'Peredo', 'Revollo', 'nomina DSAL ECO04', true),
  ('66711757', 'Carlos Enrique', 'Vallejos', 'Pinto', 'nomina DSAL ECO04', true),
  ('103898684', 'Wilton De Los Santos', 'Ramirez', 'Leon', 'nomina DSAL ECO04', true),
  ('185091082', 'Franco Rodrigo', 'Trabucco', 'Bonilla', 'nomina DSAL ECO04', true),
  ('79916277', 'Alamiro Zacarias', 'Contreras', 'Rodriguez', 'nomina DSAL ECO04', true),
  ('187092051', 'Jorge Alexis', 'Cortes', 'Barraza', 'nomina DSAL ECO04', true),
  ('146191614', 'Cristian Luis', 'Araya', 'Araya', 'nomina DSAL ECO04', true),
  ('139775619', 'Elias Osvaldo', 'Zamorano', 'Bugueno', 'nomina DSAL ECO04', true),
  ('63909858', 'Ricardo Eduardo', 'Cristi', 'Gallardo', 'nomina DSAL ECO04', true),
  ('198732605', 'Alejandro Juan', 'Rubina', 'Araya', 'nomina DSAL ECO04', true),
  ('186768205', 'Andres Jean Pierre', 'Rojas', 'Pasmino', 'nomina DSAL ECO04', true),
  ('120062042', 'Mauricio Alfredo', 'Merino', 'Salazar', 'nomina DSAL ECO04', true)
on conflict (national_id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  second_last_name = excluded.second_last_name,
  source_name = excluded.source_name,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'submit_dsal_precandidate_application'
     and p.pronargs = 12
   limit 1;

  if function_definition is null then
    raise exception 'No existe la función pública de postulación DSAL';
  end if;

  function_definition := replace(
    function_definition,
    $$if p_dsal_role not in ('Interno Mina', 'Furgón Eléctrico', 'Bus Eléctrico', 'Ciudades Base') then$$,
    $$if not public.is_valid_dsal_precandidate_role(p_dsal_role) then$$
  );
  function_definition := replace(
    function_definition,
    $$normalized_second_last_name text := public.normalize_dsal_precandidate_name(p_second_last_name);$$,
    $$normalized_second_last_name text := coalesce(public.normalize_dsal_precandidate_name(p_second_last_name), '');$$
  );
  function_definition := replace(
    function_definition,
    $$or normalized_second_last_name is null
    or normalized_address_line is null$$,
    $$or normalized_address_line is null$$
  );

  if function_definition not like '%is_valid_dsal_precandidate_role%' then
    raise exception 'No se pudo ampliar la validación de roles DSAL';
  end if;
  if function_definition like '%or normalized_second_last_name is null%' then
    raise exception 'No se pudo hacer opcional el apellido materno DSAL';
  end if;

  execute function_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
