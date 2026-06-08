begin;

insert into public.app_modules (code, name, route, description, sort_order, is_active)
values
  ('solicitud_contrataciones', 'Solicitud de Contrataciones', '/solicitud-contrataciones', 'Creación de nuevas solicitudes de contratación.', 10, true),
  ('control_contrataciones', 'Control de Contrataciones', '/control-contrataciones', 'Seguimiento y edición controlada del avance de contrataciones.', 20, true),
  ('certificados', 'Generador de Certificados - Competencias', '/certificados', 'Generación de solicitudes de certificados por competencias.', 30, true),
  ('seguimiento_certificados', 'Seguimiento de Certificados', '/seguimiento-certificados', 'Seguimiento del estado de certificados emitidos.', 40, true),
  ('operaciones', 'Operaciones', '/operaciones', 'Panel operativo reservado para procesos y herramientas del area de operaciones.', 50, true),
  ('recursos_humanos', 'Recursos Humanos', '/recursos-humanos', 'Panel reservado para procesos y herramientas del area de recursos humanos.', 60, true)
on conflict (code) do update
set
  name = excluded.name,
  route = excluded.route,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = timezone('utc', now());

with desired_roles (code, name, description) as (
  values
    ('admin', 'Administrador', 'Administrador total del sistema.'),
    ('aprobador_folios', 'Aprobador de Folios', 'Aprueba solicitudes de contratación cuando es designado como responsable de área.'),
    ('reclutamiento', 'Reclutamiento', 'Gestiona el flujo de reclutamiento y control de candidatos.'),
    ('control_contratos', 'Control de Contratos', 'Participa en la etapa de control de contratos y aprobaciones contractuales.'),
    ('gerencia', 'Gerencia', 'Gerencias con acceso de solicitud y aprobación de folios por designación operativa.'),
    ('director_eje', 'Director Ejecutivo', 'Dirección ejecutiva con acceso operativo definido en la matriz vigente.'),
    ('director_op', 'Director de Operaciones', 'Dirección de operaciones con capacidad de aprobación Who.'),
    ('gerente_general', 'Gerente General', 'Gerencia general con acceso ampliado al flujo de contratación.'),
    ('operaciones_l_1', 'Operaciones Nivel 1', 'Rol operativo nivel 1 según matriz de usuarios vigente.'),
    ('operaciones_l_2', 'Operaciones Nivel 2', 'Rol operativo nivel 2 según matriz de usuarios vigente.'),
    ('administrativo', 'Administrativo', 'Rol administrativo con acceso limitado a la solicitud de contrataciones.'),
    ('certificaciones', 'Certificaciones', 'Rol histórico del módulo de certificaciones.'),
    ('instructor', 'Instructor', 'Rol histórico del módulo de certificaciones.')
)
insert into public.app_roles (code, name, description, is_active)
select code, name, description, true
from desired_roles
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.app_capabilities (code, name, description)
values
  ('can_approve_who_stage', 'Aprobar etapa Who', 'Permite aprobar o rechazar solicitudes pendientes de validación Who.'),
  ('candidate_control_access', 'Control de candidatos', 'Permite acceder al subflujo documental y controlado de candidatos.')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description;

with managed_roles(role_code) as (
  values
    ('admin'),
    ('reclutamiento'),
    ('control_contratos'),
    ('gerencia'),
    ('director_eje'),
    ('director_op'),
    ('gerente_general'),
    ('operaciones_l_1'),
    ('operaciones_l_2'),
    ('administrativo')
),
desired_modules (role_code, module_code) as (
  values
    ('admin', 'solicitud_contrataciones'),
    ('admin', 'control_contrataciones'),
    ('admin', 'certificados'),
    ('admin', 'seguimiento_certificados'),
    ('admin', 'recursos_humanos'),
    ('admin', 'operaciones'),
    ('reclutamiento', 'solicitud_contrataciones'),
    ('reclutamiento', 'control_contrataciones'),
    ('control_contratos', 'solicitud_contrataciones'),
    ('gerencia', 'solicitud_contrataciones'),
    ('director_eje', 'solicitud_contrataciones'),
    ('director_op', 'solicitud_contrataciones'),
    ('gerente_general', 'solicitud_contrataciones'),
    ('gerente_general', 'control_contrataciones'),
    ('operaciones_l_1', 'solicitud_contrataciones'),
    ('operaciones_l_2', 'solicitud_contrataciones'),
    ('administrativo', 'solicitud_contrataciones')
)
insert into public.role_module_access (role_code, module_code, can_view)
select dm.role_code, dm.module_code, true
from desired_modules dm
join public.app_modules am
  on am.code = dm.module_code
on conflict (role_code, module_code) do update
set can_view = true;

with managed_roles(role_code) as (
  values
    ('reclutamiento'),
    ('control_contratos'),
    ('gerencia'),
    ('director_eje'),
    ('director_op'),
    ('gerente_general'),
    ('operaciones_l_1'),
    ('operaciones_l_2'),
    ('administrativo')
),
desired_modules (role_code, module_code) as (
  values
    ('reclutamiento', 'solicitud_contrataciones'),
    ('reclutamiento', 'control_contrataciones'),
    ('control_contratos', 'solicitud_contrataciones'),
    ('gerencia', 'solicitud_contrataciones'),
    ('director_eje', 'solicitud_contrataciones'),
    ('director_op', 'solicitud_contrataciones'),
    ('gerente_general', 'solicitud_contrataciones'),
    ('gerente_general', 'control_contrataciones'),
    ('operaciones_l_1', 'solicitud_contrataciones'),
    ('operaciones_l_2', 'solicitud_contrataciones'),
    ('administrativo', 'solicitud_contrataciones')
)
delete from public.role_module_access rma
using managed_roles mr
where rma.role_code = mr.role_code
  and rma.module_code in ('solicitud_contrataciones', 'control_contrataciones')
  and not exists (
    select 1
    from desired_modules dm
    where dm.role_code = rma.role_code
      and dm.module_code = rma.module_code
  );

with desired_capabilities (role_code, capability_code) as (
  values
    ('admin', 'can_approve_who_stage'),
    ('reclutamiento', 'candidate_control_access'),
    ('gerente_general', 'can_approve_who_stage'),
    ('director_op', 'can_approve_who_stage')
)
insert into public.role_capabilities (role_code, capability_code)
select role_code, capability_code
from desired_capabilities
on conflict (role_code, capability_code) do nothing;

with managed_roles(role_code) as (
  values
    ('admin'),
    ('reclutamiento'),
    ('gerente_general'),
    ('director_op')
),
desired_capabilities (role_code, capability_code) as (
  values
    ('admin', 'can_approve_who_stage'),
    ('reclutamiento', 'candidate_control_access'),
    ('gerente_general', 'can_approve_who_stage'),
    ('director_op', 'can_approve_who_stage')
)
delete from public.role_capabilities rc
using managed_roles mr
where rc.role_code = mr.role_code
  and rc.capability_code in ('can_approve_who_stage', 'candidate_control_access')
  and not exists (
    select 1
    from desired_capabilities dc
    where dc.role_code = rc.role_code
      and dc.capability_code = rc.capability_code
  );

with desired_users (email, full_name, job_title, department, status, is_super_admin) as (
  values
    ('gerardo.casanova@busesjm.com', 'Gerardo Casanova Minardi', 'Director Ejecutivo', null, 'active', false),
    ('renato.martinez@busesjm.com', 'Renato Martinez Contreras', 'Analista de Excelencia Operacional', 'Desarrollo', 'active', false),
    ('jnavea@busesjm.com', 'Juan Carlos Navea', 'Subgerente Control Flota', null, 'active', false),
    ('alan.brain@busesjm.com', 'Alan Brain Biggemann', 'Gerente Comercial', null, 'active', false),
    ('raul.lopez@busesjm.com', 'Raul Lopez Guerra', 'Gerente de Finanzas', null, 'active', false),
    ('guillermo.zanartu@busesjm.com', 'Guillermo Zañartu Apara', 'Gerente General', null, 'active', false),
    ('maximiliano.contreras@busesjm.com', 'Maximiliano Contreras Rey', 'Subgerente de Excelencia Operacional', 'Plataforma', 'active', true),
    ('rodrigo.galdames@busesjm.com', 'Rodrigo Galdames', 'Gerente de Mantenimiento', null, 'active', false),
    ('cjimenez@busesjm.com', 'Cristian Jimenez Jimenez', 'Gerente de Operaciones Centro', null, 'active', false),
    ('mariajesus.lagos@busesjm.com', 'Maria Jesus Lagos Minardi', 'Subgerente de Control de Contratos', null, 'active', false),
    ('andres.madrid@busesjm.com', 'Andres Madrid Maureira', 'Gerente de Recursos Humanos', null, 'active', false),
    ('luciano.fischer@busesjm.com', 'Luciano Fischer Ballerini', 'Gerente de Operaciones Costa', null, 'active', false),
    ('manuel.parra@busesjm.com', 'Manuel Parra Soto', 'Gerente de Prevencion de Riesgos', null, 'active', false),
    ('pminardi@busesjm.com', 'Piera Minardi Urzua', 'Subgerente de Desarrollo Organizacional', null, 'active', false),
    ('thania.villagran@busesjm.com', 'Thania Villagran Latoja', 'Analista de Desarrollo Organizacional', null, 'active', false),
    ('paola.cisternas@busesjm.com', 'Paola Cisternas Jeria', 'Psicologa Organizacional', null, 'active', false),
    ('macarena.ruiz@busesjm.com', 'Macarena Ruiz Lazcano', 'Asistente Desarrollo de Personas', null, 'active', false),
    ('joseluis.sierra@busesjm.com', 'Jose Luis Sierra', 'Subgerente de Abastecimiento', null, 'active', false),
    ('rodrigo.puentes@busesjm.com', 'Rodrigo Puentes Araya', 'Jefe de Contabilidad', null, 'active', false),
    ('carolina.lira@busesjm.com', 'Carolina Lira Garrido', 'Encargado de Cobranzas', null, 'active', false),
    ('mjara@busesjm.com', 'Marcos Jara Arenas', 'Tesorero', null, 'active', false),
    ('jorge.parra@busesjm.com', 'Jorge Parra Jimenez', 'Jefe de Operaciones', null, 'active', false),
    ('iarratia@busesjm.com', 'Isac Arratia Carcamo', 'Administrador de Contratos', null, 'active', false),
    ('marcelo.villarroel@busesjm.com', 'Marcelo Villarroel Gutierrez', 'Administrador de Contratos', null, 'active', false),
    ('victor.guerrero@busesjm.com', 'Victor Guerrero Gutierrez', 'Jefe de Operaciones', null, 'active', false),
    ('oscar.poblete@busesjm.com', 'Oscar Poblete Celedon', 'Administrador de Contratos', null, 'active', false),
    ('jose.orellana@busesjm.com', 'Jose Orellana Paez', 'Administrador de Contratos', null, 'active', false),
    ('carlos.villagran@busesjm.com', 'Carlos Villagran Suarez', 'Subgerente de Contratos', null, 'active', false),
    ('ricardo.mella@busesjm.com', 'Ricardo Mella Osorio', 'Administrador de Contratos', null, 'active', false),
    ('andres.barraza@busesjm.com', 'Andres Barraza Mera', 'Administrador de Contratos', null, 'active', false),
    ('javier.plaza@busesjm.com', 'Javier Plaza Cerda', 'Administrador de Contratos', null, 'active', false),
    ('jose.irribarren@busesjm.com', 'Jose Irribarren Sepulveda', 'Administrador de Contratos', null, 'active', false),
    ('angel.guerra@busesjm.com', 'Angel Guerra Basso', 'Administrador de Contratos', null, 'active', false),
    ('dlazcano@busesjm.com', 'Diego Lazcano Lazcano', 'Director de Operaciones', null, 'active', false)
)
update public.profiles p
set
  email = du.email,
  full_name = du.full_name,
  job_title = du.job_title,
  department = du.department,
  status = du.status,
  is_super_admin = du.is_super_admin,
  updated_at = timezone('utc', now())
from desired_users du
where lower(p.email) = du.email;

with desired_user_roles (email, role_code) as (
  values
    ('gerardo.casanova@busesjm.com', 'director_eje'),
    ('gerardo.casanova@busesjm.com', 'aprobador_folios'),
    ('jnavea@busesjm.com', 'gerencia'),
    ('jnavea@busesjm.com', 'aprobador_folios'),
    ('alan.brain@busesjm.com', 'gerencia'),
    ('alan.brain@busesjm.com', 'aprobador_folios'),
    ('raul.lopez@busesjm.com', 'gerencia'),
    ('raul.lopez@busesjm.com', 'aprobador_folios'),
    ('guillermo.zanartu@busesjm.com', 'gerente_general'),
    ('guillermo.zanartu@busesjm.com', 'aprobador_folios'),
    ('maximiliano.contreras@busesjm.com', 'admin'),
    ('rodrigo.galdames@busesjm.com', 'gerencia'),
    ('rodrigo.galdames@busesjm.com', 'aprobador_folios'),
    ('cjimenez@busesjm.com', 'gerencia'),
    ('cjimenez@busesjm.com', 'aprobador_folios'),
    ('mariajesus.lagos@busesjm.com', 'control_contratos'),
    ('andres.madrid@busesjm.com', 'gerencia'),
    ('andres.madrid@busesjm.com', 'aprobador_folios'),
    ('andres.madrid@busesjm.com', 'reclutamiento'),
    ('luciano.fischer@busesjm.com', 'gerencia'),
    ('luciano.fischer@busesjm.com', 'aprobador_folios'),
    ('manuel.parra@busesjm.com', 'gerencia'),
    ('manuel.parra@busesjm.com', 'aprobador_folios'),
    ('pminardi@busesjm.com', 'reclutamiento'),
    ('thania.villagran@busesjm.com', 'reclutamiento'),
    ('paola.cisternas@busesjm.com', 'reclutamiento'),
    ('macarena.ruiz@busesjm.com', 'reclutamiento'),
    ('joseluis.sierra@busesjm.com', 'gerencia'),
    ('joseluis.sierra@busesjm.com', 'aprobador_folios'),
    ('rodrigo.puentes@busesjm.com', 'operaciones_l_1'),
    ('carolina.lira@busesjm.com', 'operaciones_l_1'),
    ('mjara@busesjm.com', 'operaciones_l_1'),
    ('jorge.parra@busesjm.com', 'operaciones_l_2'),
    ('iarratia@busesjm.com', 'operaciones_l_2'),
    ('marcelo.villarroel@busesjm.com', 'operaciones_l_2'),
    ('victor.guerrero@busesjm.com', 'operaciones_l_2'),
    ('oscar.poblete@busesjm.com', 'operaciones_l_1'),
    ('jose.orellana@busesjm.com', 'operaciones_l_1'),
    ('carlos.villagran@busesjm.com', 'operaciones_l_1'),
    ('ricardo.mella@busesjm.com', 'operaciones_l_1'),
    ('andres.barraza@busesjm.com', 'operaciones_l_1'),
    ('javier.plaza@busesjm.com', 'operaciones_l_1'),
    ('jose.irribarren@busesjm.com', 'operaciones_l_1'),
    ('angel.guerra@busesjm.com', 'operaciones_l_1'),
    ('dlazcano@busesjm.com', 'director_op')
),
managed_users(email) as (
  values
    ('gerardo.casanova@busesjm.com'),
    ('renato.martinez@busesjm.com'),
    ('jnavea@busesjm.com'),
    ('alan.brain@busesjm.com'),
    ('raul.lopez@busesjm.com'),
    ('guillermo.zanartu@busesjm.com'),
    ('maximiliano.contreras@busesjm.com'),
    ('rodrigo.galdames@busesjm.com'),
    ('cjimenez@busesjm.com'),
    ('mariajesus.lagos@busesjm.com'),
    ('andres.madrid@busesjm.com'),
    ('luciano.fischer@busesjm.com'),
    ('manuel.parra@busesjm.com'),
    ('pminardi@busesjm.com'),
    ('thania.villagran@busesjm.com'),
    ('paola.cisternas@busesjm.com'),
    ('macarena.ruiz@busesjm.com'),
    ('joseluis.sierra@busesjm.com'),
    ('rodrigo.puentes@busesjm.com'),
    ('carolina.lira@busesjm.com'),
    ('mjara@busesjm.com'),
    ('jorge.parra@busesjm.com'),
    ('iarratia@busesjm.com'),
    ('marcelo.villarroel@busesjm.com'),
    ('victor.guerrero@busesjm.com'),
    ('oscar.poblete@busesjm.com'),
    ('jose.orellana@busesjm.com'),
    ('carlos.villagran@busesjm.com'),
    ('ricardo.mella@busesjm.com'),
    ('andres.barraza@busesjm.com'),
    ('javier.plaza@busesjm.com'),
    ('jose.irribarren@busesjm.com'),
    ('angel.guerra@busesjm.com'),
    ('dlazcano@busesjm.com')
),
assigning_user as (
  select p.id
  from public.profiles p
  where lower(p.email) = 'maximiliano.contreras@busesjm.com'
  limit 1
)
delete from public.user_roles ur
using public.profiles p, managed_users mu
where ur.user_id = p.id
  and lower(p.email) = mu.email
  and not exists (
    select 1
    from desired_user_roles dur
    where dur.email = mu.email
      and dur.role_code is not null
      and dur.role_code = ur.role_code
  );

with desired_user_roles (email, role_code) as (
  values
    ('gerardo.casanova@busesjm.com', 'director_eje'),
    ('gerardo.casanova@busesjm.com', 'aprobador_folios'),
    ('jnavea@busesjm.com', 'gerencia'),
    ('jnavea@busesjm.com', 'aprobador_folios'),
    ('alan.brain@busesjm.com', 'gerencia'),
    ('alan.brain@busesjm.com', 'aprobador_folios'),
    ('raul.lopez@busesjm.com', 'gerencia'),
    ('raul.lopez@busesjm.com', 'aprobador_folios'),
    ('guillermo.zanartu@busesjm.com', 'gerente_general'),
    ('guillermo.zanartu@busesjm.com', 'aprobador_folios'),
    ('maximiliano.contreras@busesjm.com', 'admin'),
    ('rodrigo.galdames@busesjm.com', 'gerencia'),
    ('rodrigo.galdames@busesjm.com', 'aprobador_folios'),
    ('cjimenez@busesjm.com', 'gerencia'),
    ('cjimenez@busesjm.com', 'aprobador_folios'),
    ('mariajesus.lagos@busesjm.com', 'control_contratos'),
    ('andres.madrid@busesjm.com', 'gerencia'),
    ('andres.madrid@busesjm.com', 'aprobador_folios'),
    ('andres.madrid@busesjm.com', 'reclutamiento'),
    ('luciano.fischer@busesjm.com', 'gerencia'),
    ('luciano.fischer@busesjm.com', 'aprobador_folios'),
    ('manuel.parra@busesjm.com', 'gerencia'),
    ('manuel.parra@busesjm.com', 'aprobador_folios'),
    ('pminardi@busesjm.com', 'reclutamiento'),
    ('thania.villagran@busesjm.com', 'reclutamiento'),
    ('paola.cisternas@busesjm.com', 'reclutamiento'),
    ('macarena.ruiz@busesjm.com', 'reclutamiento'),
    ('joseluis.sierra@busesjm.com', 'gerencia'),
    ('joseluis.sierra@busesjm.com', 'aprobador_folios'),
    ('rodrigo.puentes@busesjm.com', 'operaciones_l_1'),
    ('carolina.lira@busesjm.com', 'operaciones_l_1'),
    ('mjara@busesjm.com', 'operaciones_l_1'),
    ('jorge.parra@busesjm.com', 'operaciones_l_2'),
    ('iarratia@busesjm.com', 'operaciones_l_2'),
    ('marcelo.villarroel@busesjm.com', 'operaciones_l_2'),
    ('victor.guerrero@busesjm.com', 'operaciones_l_2'),
    ('oscar.poblete@busesjm.com', 'operaciones_l_1'),
    ('jose.orellana@busesjm.com', 'operaciones_l_1'),
    ('carlos.villagran@busesjm.com', 'operaciones_l_1'),
    ('ricardo.mella@busesjm.com', 'operaciones_l_1'),
    ('andres.barraza@busesjm.com', 'operaciones_l_1'),
    ('javier.plaza@busesjm.com', 'operaciones_l_1'),
    ('jose.irribarren@busesjm.com', 'operaciones_l_1'),
    ('angel.guerra@busesjm.com', 'operaciones_l_1'),
    ('dlazcano@busesjm.com', 'director_op')
),
assigning_user as (
  select p.id
  from public.profiles p
  where lower(p.email) = 'maximiliano.contreras@busesjm.com'
  limit 1
)
insert into public.user_roles (user_id, role_code, assigned_by)
select p.id, dur.role_code, au.id
from desired_user_roles dur
join public.profiles p
  on lower(p.email) = dur.email
cross join assigning_user au
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = p.id
    and ur.role_code = dur.role_code
);

notify pgrst, 'reload schema';

commit;
