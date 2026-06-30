begin;

create table if not exists public.app_features (
  code text primary key,
  module_code text not null references public.app_modules (code) on delete cascade,
  name text not null,
  description text null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint app_features_code_format check (code = lower(code))
);

create table if not exists public.role_feature_access (
  role_code text not null references public.app_roles (code) on delete cascade,
  feature_code text not null references public.app_features (code) on delete cascade,
  can_access boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (role_code, feature_code)
);

drop trigger if exists trg_app_features_set_updated_at on public.app_features;
create trigger trg_app_features_set_updated_at
before update on public.app_features
for each row
execute function public.set_updated_at();

drop trigger if exists trg_role_feature_access_set_updated_at on public.role_feature_access;
create trigger trg_role_feature_access_set_updated_at
before update on public.role_feature_access
for each row
execute function public.set_updated_at();

insert into public.app_features (code, module_code, name, description, sort_order)
values
  ('recruitment_processes_summary', 'control_contrataciones', 'Resumen de procesos de contratación', 'Vista ejecutiva de procesos de contratación.', 10),
  ('recruitment_candidate_control', 'control_contrataciones', 'Control de candidatos', 'Control documental y de avance de candidatos.', 20),
  ('recruitment_personnel_to_hire', 'control_contrataciones', 'Personal a contratar', 'Subflujo para preparar candidatos listos para contratación.', 30),
  ('recruitment_internal_mobility', 'control_contrataciones', 'Movilidad interna', 'Subvista de movilidad interna dentro de control de contrataciones.', 40),
  ('roster_calendar', 'jornadas_turnos', 'Calendario', 'Consulta del calendario individual de jornadas.', 10),
  ('roster_assign_pattern', 'jornadas_turnos', 'Asignar pauta', 'Asignación manual de pautas y excepciones.', 20),
  ('roster_manage_patterns', 'jornadas_turnos', 'Gestor de pautas', 'Administración de patrones base de jornadas.', 30),
  ('hr_incentives_register', 'recursos_humanos', 'Registrar incentivo', 'Registro operativo de incentivos extraordinarios.', 10),
  ('hr_incentives_approvals', 'recursos_humanos', 'Aprobaciones', 'Bandeja de aprobaciones de incentivos extraordinarios.', 20),
  ('hr_incentives_history', 'recursos_humanos', 'Historial', 'Consulta histórica de incentivos extraordinarios.', 30),
  ('hr_incentives_configuration', 'recursos_humanos', 'Configuración base', 'Parámetros y reglas base de incentivos.', 40),
  ('bi_dotacion', 'bi_analytics', 'Analítica de Dotación (BUK)', 'KPIs de dotación y ausentismo.', 10),
  ('bi_incentivos', 'bi_analytics', 'Análisis de Incentivos', 'Analítica ejecutiva del gasto de incentivos.', 20),
  ('bi_reclutamiento', 'bi_analytics', 'Reclutamiento', 'Analítica ejecutiva de reclutamiento.', 30)
on conflict (code)
do update set
  module_code = excluded.module_code,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = timezone('utc', now());

delete from public.role_feature_access
where feature_code in (
  'recruitment_processes_summary',
  'recruitment_candidate_control',
  'recruitment_personnel_to_hire',
  'recruitment_internal_mobility',
  'roster_calendar',
  'roster_assign_pattern',
  'roster_manage_patterns',
  'hr_incentives_register',
  'hr_incentives_approvals',
  'hr_incentives_history',
  'hr_incentives_configuration',
  'bi_dotacion',
  'bi_incentivos',
  'bi_reclutamiento'
);

insert into public.role_feature_access (role_code, feature_code, can_access)
values
  ('director_eje', 'recruitment_processes_summary', true),
  ('gerente_general', 'recruitment_processes_summary', true),
  ('director_op', 'recruitment_processes_summary', true),
  ('gerencia', 'recruitment_processes_summary', true),
  ('reclutamiento', 'recruitment_processes_summary', true),
  ('jefe_administrativo', 'recruitment_processes_summary', true),
  ('admin', 'recruitment_processes_summary', true),

  ('reclutamiento', 'recruitment_candidate_control', true),
  ('jefe_administrativo', 'recruitment_candidate_control', true),
  ('admin', 'recruitment_candidate_control', true),

  ('reclutamiento', 'recruitment_personnel_to_hire', true),
  ('administrativo', 'recruitment_personnel_to_hire', true),
  ('jefe_administrativo', 'recruitment_personnel_to_hire', true),
  ('admin', 'recruitment_personnel_to_hire', true),

  ('reclutamiento', 'recruitment_internal_mobility', true),
  ('administrativo', 'recruitment_internal_mobility', true),
  ('jefe_administrativo', 'recruitment_internal_mobility', true),
  ('admin', 'recruitment_internal_mobility', true),

  ('director_eje', 'roster_calendar', true),
  ('gerente_general', 'roster_calendar', true),
  ('director_op', 'roster_calendar', true),
  ('gerencia', 'roster_calendar', true),
  ('reclutamiento', 'roster_calendar', true),
  ('operaciones_l_1', 'roster_calendar', true),
  ('operaciones_l_2', 'roster_calendar', true),
  ('administrativo', 'roster_calendar', true),
  ('control_contratos', 'roster_calendar', true),
  ('jefe_administrativo', 'roster_calendar', true),
  ('admin', 'roster_calendar', true),

  ('gerencia', 'roster_assign_pattern', true),
  ('admin', 'roster_assign_pattern', true),

  ('admin', 'roster_manage_patterns', true),

  ('gerencia', 'hr_incentives_register', true),
  ('operaciones_l_2', 'hr_incentives_register', true),
  ('jefe_administrativo', 'hr_incentives_register', true),
  ('admin', 'hr_incentives_register', true),

  ('gerencia', 'hr_incentives_approvals', true),
  ('operaciones_l_1', 'hr_incentives_approvals', true),
  ('jefe_administrativo', 'hr_incentives_approvals', true),
  ('admin', 'hr_incentives_approvals', true),

  ('director_eje', 'hr_incentives_history', true),
  ('gerente_general', 'hr_incentives_history', true),
  ('director_op', 'hr_incentives_history', true),
  ('gerencia', 'hr_incentives_history', true),
  ('operaciones_l_1', 'hr_incentives_history', true),
  ('administrativo', 'hr_incentives_history', true),
  ('control_contratos', 'hr_incentives_history', true),
  ('jefe_administrativo', 'hr_incentives_history', true),
  ('admin', 'hr_incentives_history', true),

  ('control_contratos', 'hr_incentives_configuration', true),
  ('admin', 'hr_incentives_configuration', true),

  ('director_eje', 'bi_dotacion', true),
  ('gerente_general', 'bi_dotacion', true),
  ('director_op', 'bi_dotacion', true),
  ('gerencia', 'bi_dotacion', true),
  ('reclutamiento', 'bi_dotacion', true),
  ('operaciones_l_1', 'bi_dotacion', true),
  ('administrativo', 'bi_dotacion', true),
  ('control_contratos', 'bi_dotacion', true),
  ('jefe_administrativo', 'bi_dotacion', true),
  ('admin', 'bi_dotacion', true),

  ('director_eje', 'bi_incentivos', true),
  ('gerente_general', 'bi_incentivos', true),
  ('director_op', 'bi_incentivos', true),
  ('gerencia', 'bi_incentivos', true),
  ('reclutamiento', 'bi_incentivos', true),
  ('operaciones_l_1', 'bi_incentivos', true),
  ('administrativo', 'bi_incentivos', true),
  ('control_contratos', 'bi_incentivos', true),
  ('jefe_administrativo', 'bi_incentivos', true),
  ('admin', 'bi_incentivos', true),

  ('admin', 'bi_reclutamiento', true)
on conflict (role_code, feature_code)
do update set
  can_access = excluded.can_access,
  updated_at = timezone('utc', now());

delete from public.role_module_access
where role_code <> 'admin'
  and module_code in (
    'solicitud_contrataciones',
    'movilidad_interna',
    'control_contrataciones',
    'jornadas_turnos',
    'recursos_humanos',
    'bi_analytics',
    'acreditacion_personas',
    'alta_operacional_personal',
    'ai_assistant',
    'operaciones',
    'certificados',
    'seguimiento_certificados'
  );

insert into public.role_module_access (role_code, module_code, can_view)
values
  ('director_eje', 'solicitud_contrataciones', true),
  ('director_eje', 'movilidad_interna', true),
  ('director_eje', 'control_contrataciones', true),
  ('director_eje', 'jornadas_turnos', true),
  ('director_eje', 'recursos_humanos', true),
  ('director_eje', 'bi_analytics', true),

  ('gerente_general', 'solicitud_contrataciones', true),
  ('gerente_general', 'movilidad_interna', true),
  ('gerente_general', 'control_contrataciones', true),
  ('gerente_general', 'jornadas_turnos', true),
  ('gerente_general', 'recursos_humanos', true),
  ('gerente_general', 'bi_analytics', true),

  ('director_op', 'solicitud_contrataciones', true),
  ('director_op', 'movilidad_interna', true),
  ('director_op', 'control_contrataciones', true),
  ('director_op', 'jornadas_turnos', true),
  ('director_op', 'recursos_humanos', true),
  ('director_op', 'bi_analytics', true),

  ('gerencia', 'solicitud_contrataciones', true),
  ('gerencia', 'movilidad_interna', true),
  ('gerencia', 'control_contrataciones', true),
  ('gerencia', 'jornadas_turnos', true),
  ('gerencia', 'recursos_humanos', true),
  ('gerencia', 'bi_analytics', true),

  ('reclutamiento', 'solicitud_contrataciones', true),
  ('reclutamiento', 'movilidad_interna', true),
  ('reclutamiento', 'control_contrataciones', true),
  ('reclutamiento', 'jornadas_turnos', true),
  ('reclutamiento', 'recursos_humanos', true),
  ('reclutamiento', 'bi_analytics', true),

  ('operaciones_l_1', 'solicitud_contrataciones', true),
  ('operaciones_l_1', 'movilidad_interna', true),
  ('operaciones_l_1', 'jornadas_turnos', true),
  ('operaciones_l_1', 'recursos_humanos', true),
  ('operaciones_l_1', 'bi_analytics', true),

  ('operaciones_l_2', 'solicitud_contrataciones', true),
  ('operaciones_l_2', 'jornadas_turnos', true),
  ('operaciones_l_2', 'recursos_humanos', true),

  ('administrativo', 'solicitud_contrataciones', true),
  ('administrativo', 'movilidad_interna', true),
  ('administrativo', 'control_contrataciones', true),
  ('administrativo', 'jornadas_turnos', true),
  ('administrativo', 'recursos_humanos', true),
  ('administrativo', 'bi_analytics', true),

  ('control_contratos', 'solicitud_contrataciones', true),
  ('control_contratos', 'movilidad_interna', true),
  ('control_contratos', 'jornadas_turnos', true),
  ('control_contratos', 'recursos_humanos', true),
  ('control_contratos', 'bi_analytics', true),

  ('jefe_administrativo', 'solicitud_contrataciones', true),
  ('jefe_administrativo', 'movilidad_interna', true),
  ('jefe_administrativo', 'control_contrataciones', true),
  ('jefe_administrativo', 'jornadas_turnos', true),
  ('jefe_administrativo', 'recursos_humanos', true),
  ('jefe_administrativo', 'bi_analytics', true),

  ('admin', 'solicitud_contrataciones', true),
  ('admin', 'movilidad_interna', true),
  ('admin', 'control_contrataciones', true),
  ('admin', 'jornadas_turnos', true),
  ('admin', 'recursos_humanos', true),
  ('admin', 'bi_analytics', true),
  ('admin', 'acreditacion_personas', true),
  ('admin', 'alta_operacional_personal', true),
  ('admin', 'ai_assistant', true),
  ('admin', 'operaciones', true),
  ('admin', 'certificados', true),
  ('admin', 'seguimiento_certificados', true)
on conflict (role_code, module_code)
do update set
  can_view = excluded.can_view;

create or replace function public.user_can_access_feature(target_user_id uuid, target_feature_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  with normalized_feature as (
    select lower(trim(coalesce(target_feature_code, ''))) as code
  )
  select
    target_user_id is not null
    and exists (
      select 1
      from normalized_feature nf
      join public.app_features af
        on af.code = nf.code
       and af.is_active = true
      where public.user_is_admin(target_user_id)
         or exists (
              select 1
              from public.user_roles ur
              join public.app_roles ar
                on ar.code = ur.role_code
               and ar.is_active = true
              join public.role_feature_access rfa
                on rfa.role_code = ur.role_code
               and rfa.feature_code = af.code
               and rfa.can_access = true
              where ur.user_id = target_user_id
         )
    );
$function$;

create or replace function public.user_can_view_hr_roster(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      public.user_is_admin(target_user_id)
      or public.user_can_access_feature(target_user_id, 'roster_calendar')
      or public.user_can_access_feature(target_user_id, 'roster_assign_pattern')
      or public.user_can_access_feature(target_user_id, 'roster_manage_patterns')
    );
$function$;

create or replace function public.user_can_manage_hr_roster(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.user_can_view_hr_roster(target_user_id);
$function$;

create or replace function public.user_can_manage_hr_roster_assignments(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      public.user_is_admin(target_user_id)
      or public.user_can_access_feature(target_user_id, 'roster_assign_pattern')
    );
$function$;

create or replace function public.user_can_manage_hr_roster_patterns(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      public.user_is_admin(target_user_id)
      or public.user_can_access_feature(target_user_id, 'roster_manage_patterns')
    );
$function$;

create or replace function public.user_can_manage_hr_incentives(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    p_user_id is not null
    and (
      public.user_is_admin(p_user_id)
      or public.user_can_access_feature(p_user_id, 'hr_incentives_register')
      or public.user_can_access_feature(p_user_id, 'hr_incentives_approvals')
      or public.user_can_access_feature(p_user_id, 'hr_incentives_history')
      or public.user_can_access_feature(p_user_id, 'hr_incentives_configuration')
    );
$function$;

create or replace function public.user_can_view_hr_incentive_analytics(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    p_user_id is not null
    and (
      public.user_is_admin(p_user_id)
      or public.user_can_access_feature(p_user_id, 'bi_incentivos')
    );
$function$;

create or replace function public.user_can_access_bi_analytics(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    p_user_id is not null
    and (
      public.user_is_admin(p_user_id)
      or public.user_can_access_feature(p_user_id, 'bi_dotacion')
      or public.user_can_access_feature(p_user_id, 'bi_incentivos')
      or public.user_can_access_feature(p_user_id, 'bi_reclutamiento')
    );
$function$;

create or replace function public.get_my_effective_permissions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  profile_record public.profiles%rowtype;
  role_codes text[] := '{}'::text[];
  module_codes text[] := '{}'::text[];
  feature_codes text[] := '{}'::text[];
  capability_codes text[] := '{}'::text[];
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into profile_record
    from public.profiles p
   where p.id = current_user_id;

  if profile_record.id is null then
    return jsonb_build_object(
      'profile', null,
      'app_roles', '[]'::jsonb,
      'accessible_modules', '[]'::jsonb,
      'accessible_features', '[]'::jsonb,
      'capabilities', '[]'::jsonb,
      'is_super_admin', false
    );
  end if;

  select coalesce(array_agg(distinct ur.role_code order by ur.role_code), '{}'::text[])
    into role_codes
    from public.user_roles ur
    join public.app_roles ar
      on ar.code = ur.role_code
   where ur.user_id = current_user_id
     and ar.is_active = true;

  if profile_record.is_super_admin = true or 'admin' = any(role_codes) then
    select coalesce(array_agg(am.code order by am.sort_order, am.code), '{}'::text[])
      into module_codes
      from public.app_modules am
     where am.is_active = true;

    select coalesce(array_agg(af.code order by af.sort_order, af.code), '{}'::text[])
      into feature_codes
      from public.app_features af
     where af.is_active = true;

    select coalesce(array_agg(ac.code order by ac.code), '{}'::text[])
      into capability_codes
      from public.app_capabilities ac
     where ac.is_active = true;
  else
    select coalesce(array_agg(module_row.code order by module_row.sort_order, module_row.code), '{}'::text[])
      into module_codes
      from (
        select distinct
          am.code,
          am.sort_order
        from public.user_roles ur
        join public.app_roles ar
          on ar.code = ur.role_code
        join public.role_module_access rma
          on rma.role_code = ur.role_code
        join public.app_modules am
          on am.code = rma.module_code
       where ur.user_id = current_user_id
         and ar.is_active = true
         and rma.can_view = true
         and am.is_active = true
      ) as module_row;

    select coalesce(array_agg(feature_row.code order by feature_row.sort_order, feature_row.code), '{}'::text[])
      into feature_codes
      from (
        select distinct
          af.code,
          af.sort_order
        from public.user_roles ur
        join public.app_roles ar
          on ar.code = ur.role_code
        join public.role_feature_access rfa
          on rfa.role_code = ur.role_code
        join public.app_features af
          on af.code = rfa.feature_code
       where ur.user_id = current_user_id
         and ar.is_active = true
         and rfa.can_access = true
         and af.is_active = true
      ) as feature_row;

    if exists (
      select 1
      from public.hr_incentive_request_approvals hira
      where hira.approver_user_id = current_user_id
        and hira.status = 'pending'
    ) then
      module_codes := array(
        select distinct module_code
        from unnest(array_append(module_codes, 'recursos_humanos')) as module_code
        order by module_code
      );

      feature_codes := array(
        select distinct feature_code
        from unnest(array_append(feature_codes, 'hr_incentives_approvals')) as feature_code
        order by feature_code
      );
    end if;

    select coalesce(array_agg(capability_row.code order by capability_row.code), '{}'::text[])
      into capability_codes
      from (
        select distinct ac.code
        from public.user_roles ur
        join public.app_roles ar
          on ar.code = ur.role_code
        join public.role_capabilities rc
          on rc.role_code = ur.role_code
        join public.app_capabilities ac
          on ac.code = rc.capability_code
       where ur.user_id = current_user_id
         and ar.is_active = true
         and ac.is_active = true
      ) as capability_row;
  end if;

  return jsonb_build_object(
    'profile',
    jsonb_build_object(
      'id', profile_record.id,
      'email', profile_record.email,
      'full_name', profile_record.full_name,
      'job_title', profile_record.job_title,
      'department', profile_record.department,
      'status', profile_record.status,
      'is_super_admin', profile_record.is_super_admin,
      'must_reset_password', profile_record.must_reset_password,
      'aup_accepted_at', profile_record.aup_accepted_at
    ),
    'app_roles', to_jsonb(role_codes),
    'accessible_modules', to_jsonb(module_codes),
    'accessible_features', to_jsonb(feature_codes),
    'capabilities', to_jsonb(capability_codes),
    'is_super_admin', profile_record.is_super_admin
  );
end;
$function$;

create or replace function public.get_hr_roster_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_view_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar jornadas y turnos';
  end if;

  return jsonb_build_object(
    'patterns',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hp.id,
          'code', hp.code,
          'name', hp.name,
          'description', hp.description,
          'working_days', hp.working_days,
          'resting_days', hp.resting_days,
          'cycle_length', hp.cycle_length,
          'color_hex', hp.color_hex,
          'is_active', hp.is_active,
          'created_at', hp.created_at
        )
        order by hp.is_active desc, hp.name
      )
      from public.hr_shift_patterns hp
    ), '[]'::jsonb),
    'exception_types',
    jsonb_build_array(
      jsonb_build_object('value', 'vacation', 'label', public.get_hr_roster_exception_type_label('vacation')),
      jsonb_build_object('value', 'medical_leave', 'label', public.get_hr_roster_exception_type_label('medical_leave')),
      jsonb_build_object('value', 'absent', 'label', public.get_hr_roster_exception_type_label('absent')),
      jsonb_build_object('value', 'extra_shift', 'label', public.get_hr_roster_exception_type_label('extra_shift')),
      jsonb_build_object('value', 'training', 'label', public.get_hr_roster_exception_type_label('training')),
      jsonb_build_object('value', 'administrative_leave', 'label', public.get_hr_roster_exception_type_label('administrative_leave')),
      jsonb_build_object('value', 'union_leave', 'label', public.get_hr_roster_exception_type_label('union_leave'))
    ),
    'operational_areas',
    coalesce((
      with active_workers as (
        select distinct on (e.buk_employee_id)
          nullif(trim(coalesce(e.area_name, e.contract_code)), '') as operational_scope
        from public.employees_active_current e
        where nullif(trim(coalesce(e.area_name, e.contract_code)), '') is not null
        order by e.buk_employee_id, e.updated_at desc nulls last, e.created_at desc nulls last
      )
      select jsonb_agg(
        jsonb_build_object(
          'value', scope.operational_scope,
          'label', scope.operational_scope
        )
        order by scope.operational_scope
      )
      from (
        select distinct aw.operational_scope
        from active_workers aw
      ) scope
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.search_hr_roster_workers(
  p_search text default null,
  p_limit integer default 12
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  document_type text,
  job_title text,
  contract_code text,
  area_name text,
  display_label text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
begin
  if not public.user_can_view_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores de jornadas';
  end if;

  return query
  with matching_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      e.raw_payload,
      coalesce(
        nullif(trim(coalesce(e.document_number, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_number', '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'rut', '')), '')
      ) as document_number,
      coalesce(
        nullif(trim(coalesce(e.document_type, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_type', '')), ''),
        'rut'
      ) as document_type,
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key,
      row_number() over (
        partition by public.build_active_employee_identity_key(
          e.document_type,
          e.document_number,
          e.buk_employee_id,
          e.raw_payload
        )
        order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
      ) as identity_rank
    from public.employees e
    where e.is_active = true
      and (
        normalized_search = ''
        or public.build_active_employee_search_text(
          e.full_name,
          e.document_number,
          e.job_title,
          e.contract_code,
          e.area_name,
          e.raw_payload
        ) like '%' || normalized_search || '%'
      )
  )
  select
    mw.buk_employee_id,
    mw.full_name,
    mw.document_number,
    mw.document_type,
    mw.resolved_job_title as job_title,
    mw.contract_code,
    mw.area_name,
    concat_ws(
      ' | ',
      coalesce(mw.document_number, 'Sin RUT'),
      coalesce(mw.resolved_job_title, 'Sin cargo'),
      mw.full_name,
      coalesce(mw.area_name, mw.contract_code, 'Sin contrato')
    ) as display_label
  from matching_workers mw
  where mw.identity_rank = 1
  order by
    case
      when normalized_search <> '' and mw.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(mw.full_name) like normalized_search || '%' then 1
      else 2
    end,
    mw.full_name
  limit safe_limit;
end;
$function$;

create or replace function public.get_hr_roster_calendar_summary(
  p_month date default current_date,
  p_search text default null,
  p_contract_filter text default null,
  p_area_filter text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  target_month date := coalesce(p_month, current_date);
  month_start date := date_trunc('month', target_month)::date;
  month_end date := (date_trunc('month', target_month) + interval '1 month - 1 day')::date;
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_scope text := lower(trim(coalesce(nullif(p_area_filter, ''), nullif(p_contract_filter, ''), '')));
begin
  if not public.user_can_view_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar el resumen de jornadas';
  end if;

  return (
    with matching_workers as (
      select
        e.buk_employee_id,
        nullif(trim(coalesce(e.area_name, e.contract_code)), '') as operational_scope,
        row_number() over (
          partition by public.build_active_employee_identity_key(
            e.document_type,
            e.document_number,
            e.buk_employee_id,
            e.raw_payload
          )
          order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
        ) as identity_rank
      from public.employees e
      where e.is_active = true
        and (
          normalized_search = ''
          or public.build_active_employee_search_text(
            e.full_name,
            e.document_number,
            e.job_title,
            e.contract_code,
            coalesce(e.area_name, e.contract_code),
            e.raw_payload
          ) like '%' || normalized_search || '%'
        )
    ),
    filtered_workers as (
      select mw.buk_employee_id
      from matching_workers mw
      where mw.identity_rank = 1
        and (
          normalized_scope = ''
          or lower(coalesce(mw.operational_scope, '')) = normalized_scope
        )
    ),
    assigned_workers as (
      select distinct wr.employee_buk_employee_id as buk_employee_id
      from public.hr_worker_rosters wr
      inner join filtered_workers fw
        on fw.buk_employee_id = wr.employee_buk_employee_id
      where wr.start_date <= month_end
        and coalesce(wr.end_date, 'infinity'::date) >= month_start
    )
    select jsonb_build_object(
      'month_start', month_start,
      'month_end', month_end,
      'assigned_count', (select count(*) from assigned_workers),
      'pending_count', (
        select count(*)
        from filtered_workers fw
        where not exists (
          select 1
          from assigned_workers aw
          where aw.buk_employee_id = fw.buk_employee_id
        )
      ),
      'total_count', (select count(*) from filtered_workers)
    )
  );
end;
$function$;

create or replace function public.upsert_hr_shift_pattern(
  p_pattern_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_working_days integer default null,
  p_resting_days integer default null,
  p_description text default null,
  p_color_hex text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_code text := lower(trim(coalesce(p_code, '')));
  result_id uuid;
begin
  if not public.user_can_manage_hr_roster_patterns(current_user_id) then
    raise exception 'Sin permisos para administrar pautas';
  end if;

  if normalized_name = '' then
    raise exception 'Debe indicar un nombre para la pauta';
  end if;

  if coalesce(p_working_days, 0) <= 0 then
    raise exception 'Los días de trabajo deben ser mayores a 0';
  end if;

  if coalesce(p_resting_days, -1) < 0 then
    raise exception 'Los días de descanso no pueden ser negativos';
  end if;

  if normalized_code = '' then
    normalized_code := regexp_replace(lower(normalized_name), '[^a-z0-9]+', '_', 'g');
    normalized_code := trim(both '_' from normalized_code);
  end if;

  if normalized_code = '' then
    raise exception 'No fue posible generar un código de pauta válido';
  end if;

  if p_pattern_id is not null then
    update public.hr_shift_patterns
    set
      code = normalized_code,
      name = normalized_name,
      description = nullif(trim(coalesce(p_description, '')), ''),
      working_days = p_working_days,
      resting_days = p_resting_days,
      color_hex = nullif(trim(coalesce(p_color_hex, '')), ''),
      is_active = true,
      updated_at = timezone('utc', now())
    where id = p_pattern_id
    returning id into result_id;
  else
    insert into public.hr_shift_patterns (
      code,
      name,
      description,
      working_days,
      resting_days,
      color_hex,
      created_by
    )
    values (
      normalized_code,
      normalized_name,
      nullif(trim(coalesce(p_description, '')), ''),
      p_working_days,
      p_resting_days,
      nullif(trim(coalesce(p_color_hex, '')), ''),
      current_user_id
    )
    on conflict (code)
    do update
      set
        name = excluded.name,
        description = excluded.description,
        working_days = excluded.working_days,
        resting_days = excluded.resting_days,
        color_hex = excluded.color_hex,
        is_active = true,
        updated_at = timezone('utc', now())
    returning id into result_id;
  end if;

  if result_id is null then
    raise exception 'No fue posible guardar la pauta';
  end if;

  return result_id;
end;
$function$;

create or replace function public.set_hr_shift_pattern_status(
  p_pattern_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_roster_patterns(current_user_id) then
    raise exception 'Sin permisos para administrar pautas';
  end if;

  update public.hr_shift_patterns
  set
    is_active = coalesce(p_is_active, false),
    updated_at = timezone('utc', now())
  where id = p_pattern_id;
end;
$function$;

create or replace function public.assign_hr_worker_roster(
  p_buk_employee_id text,
  p_pattern_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_row record;
  pattern_row record;
  result_id uuid;
begin
  if not public.user_can_manage_hr_roster_assignments(current_user_id) then
    raise exception 'Sin permisos para asignar pautas';
  end if;

  if p_start_date is null then
    raise exception 'Debe indicar la fecha de inicio de la pauta';
  end if;

  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'La fecha de término no puede ser menor a la fecha de inicio';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(
      nullif(trim(e.job_title), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
      nullif(trim(e.raw_payload ->> 'job_title'), '')
    ) as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then
    raise exception 'Trabajador BUK no encontrado para asignar pauta';
  end if;

  select hp.id, hp.is_active
  into pattern_row
  from public.hr_shift_patterns hp
  where hp.id = p_pattern_id;

  if pattern_row.id is null then
    raise exception 'La pauta seleccionada no existe';
  end if;

  if pattern_row.is_active is not true then
    raise exception 'La pauta seleccionada está inactiva';
  end if;

  update public.hr_worker_rosters
  set
    end_date = p_start_date - 1,
    updated_at = timezone('utc', now())
  where employee_buk_employee_id = worker_row.buk_employee_id
    and start_date < p_start_date
    and coalesce(end_date, 'infinity'::date) >= p_start_date;

  if exists (
    select 1
    from public.hr_worker_rosters wr
    where wr.employee_buk_employee_id = worker_row.buk_employee_id
      and daterange(wr.start_date, coalesce(wr.end_date, 'infinity'::date), '[]')
          && daterange(p_start_date, coalesce(p_end_date, 'infinity'::date), '[]')
  ) then
    raise exception 'Ya existe una asignación de pauta que se superpone con el rango indicado';
  end if;

  insert into public.hr_worker_rosters (
    employee_buk_employee_id,
    employee_document_type,
    employee_document_number,
    employee_full_name,
    employee_job_title,
    contract_code,
    area_name,
    pattern_id,
    start_date,
    end_date,
    notes,
    assigned_by
  )
  values (
    worker_row.buk_employee_id,
    worker_row.document_type,
    worker_row.document_number,
    worker_row.full_name,
    worker_row.job_title,
    worker_row.contract_code,
    worker_row.area_name,
    p_pattern_id,
    p_start_date,
    p_end_date,
    nullif(trim(coalesce(p_notes, '')), ''),
    current_user_id
  )
  on conflict (employee_buk_employee_id, start_date)
  do update
    set
      employee_document_type = excluded.employee_document_type,
      employee_document_number = excluded.employee_document_number,
      employee_full_name = excluded.employee_full_name,
      employee_job_title = excluded.employee_job_title,
      contract_code = excluded.contract_code,
      area_name = excluded.area_name,
      pattern_id = excluded.pattern_id,
      end_date = excluded.end_date,
      notes = excluded.notes,
      assigned_by = excluded.assigned_by,
      updated_at = timezone('utc', now())
  returning id into result_id;

  return result_id;
end;
$function$;

create or replace function public.upsert_hr_roster_exception(
  p_exception_id uuid default null,
  p_buk_employee_id text default null,
  p_exception_date date default null,
  p_exception_type text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_row record;
  normalized_exception_type text := lower(trim(coalesce(p_exception_type, '')));
  result_id uuid;
  existing_source text;
begin
  if not public.user_can_manage_hr_roster_assignments(current_user_id) then
    raise exception 'Sin permisos para administrar excepciones';
  end if;

  if p_exception_date is null then
    raise exception 'Debe indicar la fecha de la excepción';
  end if;

  if normalized_exception_type not in (
    'vacation',
    'medical_leave',
    'absent',
    'extra_shift',
    'training',
    'administrative_leave',
    'union_leave'
  ) then
    raise exception 'El tipo de excepción no es válido';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then
    raise exception 'Trabajador BUK no encontrado para registrar excepción';
  end if;

  if p_exception_id is not null then
    select hre.exception_source
      into existing_source
    from public.hr_roster_exceptions hre
    where hre.id = p_exception_id
    limit 1;

    if existing_source is null then
      raise exception 'La excepción seleccionada no existe';
    end if;

    if existing_source = 'buk' then
      raise exception 'La excepción de esta fecha está gobernada por BUK y no puede modificarse manualmente';
    end if;

    if existing_source = 'incentive_auto' then
      raise exception 'La excepción de esta fecha fue generada automáticamente por Incentivos y no puede modificarse manualmente';
    end if;

    update public.hr_roster_exceptions
    set
      employee_buk_employee_id = worker_row.buk_employee_id,
      employee_document_type = worker_row.document_type,
      employee_document_number = worker_row.document_number,
      employee_full_name = worker_row.full_name,
      exception_date = p_exception_date,
      exception_type = normalized_exception_type,
      exception_source = 'manual',
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      is_active = true,
      updated_at = timezone('utc', now())
    where id = p_exception_id
    returning id into result_id;
  else
    insert into public.hr_roster_exceptions (
      employee_buk_employee_id,
      employee_document_type,
      employee_document_number,
      employee_full_name,
      exception_date,
      exception_type,
      exception_source,
      notes,
      created_by
    )
    values (
      worker_row.buk_employee_id,
      worker_row.document_type,
      worker_row.document_number,
      worker_row.full_name,
      p_exception_date,
      normalized_exception_type,
      'manual',
      nullif(trim(coalesce(p_notes, '')), ''),
      current_user_id
    )
    on conflict (employee_buk_employee_id, exception_date)
    do update
      set
        employee_document_type = excluded.employee_document_type,
        employee_document_number = excluded.employee_document_number,
        employee_full_name = excluded.employee_full_name,
        exception_type = excluded.exception_type,
        exception_source = 'manual',
        notes = excluded.notes,
        is_active = true,
        updated_at = timezone('utc', now())
      where public.hr_roster_exceptions.exception_source not in ('buk', 'incentive_auto')
    returning id into result_id;

    if result_id is null then
      raise exception 'La excepción de esta fecha está gobernada por BUK o fue generada por Incentivos y no puede reemplazarse manualmente';
    end if;
  end if;

  return result_id;
end;
$function$;

create or replace function public.set_hr_roster_exception_status(
  p_exception_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  existing_source text;
begin
  if not public.user_can_manage_hr_roster_assignments(current_user_id) then
    raise exception 'Sin permisos para administrar excepciones';
  end if;

  select hre.exception_source
    into existing_source
  from public.hr_roster_exceptions hre
  where hre.id = p_exception_id
  limit 1;

  if existing_source is null then
    raise exception 'La excepción seleccionada no existe';
  end if;

  if existing_source = 'buk' then
    raise exception 'La excepción de esta fecha está gobernada por BUK y no puede activarse ni desactivarse manualmente';
  end if;

  if existing_source = 'incentive_auto' then
    raise exception 'La excepción de esta fecha fue generada automáticamente por Incentivos y no puede activarse ni desactivarse manualmente';
  end if;

  update public.hr_roster_exceptions
  set
    is_active = coalesce(p_is_active, false),
    updated_at = timezone('utc', now())
  where id = p_exception_id;
end;
$function$;

create or replace function public.get_worker_schedule(
  p_buk_employee_id text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  resolved_start date := coalesce(p_start_date, current_date);
  resolved_end date := coalesce(p_end_date, coalesce(p_start_date, current_date));
  projection_horizon_end date := (
    date_trunc('month', current_date)::date
    + interval '7 months'
    - interval '1 day'
  )::date;
  worker_row record;
begin
  if not public.user_can_view_hr_roster(current_user_id) then
    raise exception 'Sin permisos para consultar jornadas';
  end if;

  if resolved_end < resolved_start then
    raise exception 'El rango solicitado no es válido';
  end if;

  if resolved_start > projection_horizon_end or resolved_end > projection_horizon_end then
    raise exception 'La proyección de jornadas solo permite consultar hasta el cierre de los próximos 6 meses';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    coalesce(
      nullif(trim(e.job_title), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
      nullif(trim(e.raw_payload ->> 'job_title'), '')
    ) as job_title,
    nullif(trim(e.contract_code), '') as contract_code,
    nullif(trim(e.area_name), '') as area_name
  into worker_row
  from public.employees_active_current e
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_row.buk_employee_id is null then
    raise exception 'Trabajador BUK no encontrado o sin ficha activa';
  end if;

  return jsonb_build_object(
    'worker', jsonb_build_object(
      'buk_employee_id', worker_row.buk_employee_id,
      'full_name', worker_row.full_name,
      'document_number', worker_row.document_number,
      'document_type', worker_row.document_type,
      'job_title', worker_row.job_title,
      'contract_code', worker_row.contract_code,
      'area_name', worker_row.area_name
    ),
    'range', jsonb_build_object(
      'start_date', resolved_start,
      'end_date', resolved_end
    ),
    'summary', (
      with resolved_days as (
        select rs.*
        from generate_series(resolved_start, resolved_end, interval '1 day') as gs(day_date)
        cross join lateral public.resolve_hr_roster_day_status(worker_row.buk_employee_id, gs.day_date::date) rs
      )
      select jsonb_build_object(
        'working_days', count(*) filter (where rd.base_status = 'working'),
        'resting_days', count(*) filter (where rd.base_status = 'resting'),
        'exception_days', count(*) filter (where rd.exception_type is not null),
        'unassigned_days', count(*) filter (where rd.base_status = 'unassigned')
      )
      from resolved_days rd
    ),
    'assignments',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', wr.id,
          'pattern_id', hp.id,
          'pattern_name', hp.name,
          'pattern_code', hp.code,
          'working_days', hp.working_days,
          'resting_days', hp.resting_days,
          'cycle_length', hp.cycle_length,
          'start_date', wr.start_date,
          'end_date', wr.end_date,
          'notes', wr.notes,
          'contract_code', wr.contract_code,
          'area_name', wr.area_name,
          'created_at', wr.created_at
        )
        order by wr.start_date desc
      )
      from public.hr_worker_rosters wr
      join public.hr_shift_patterns hp
        on hp.id = wr.pattern_id
      where wr.employee_buk_employee_id = worker_row.buk_employee_id
        and daterange(wr.start_date, coalesce(wr.end_date, 'infinity'::date), '[]')
          && daterange(resolved_start, resolved_end, '[]')
    ), '[]'::jsonb),
    'exceptions',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hre.id,
          'exception_date', hre.exception_date,
          'exception_type', hre.exception_type,
          'exception_label', public.get_hr_roster_exception_type_label(hre.exception_type),
          'exception_source', hre.exception_source,
          'notes', hre.notes,
          'is_active', hre.is_active,
          'created_at', hre.created_at
        )
        order by hre.exception_date asc
      )
      from public.hr_roster_exceptions hre
      where hre.employee_buk_employee_id = worker_row.buk_employee_id
        and hre.is_active = true
        and hre.exception_date between resolved_start and resolved_end
    ), '[]'::jsonb),
    'days',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', gs.day_date::date,
          'assignment_id', rs.assignment_id,
          'pattern_id', rs.pattern_id,
          'pattern_name', rs.pattern_name,
          'cycle_day', rs.cycle_day,
          'base_status', rs.base_status,
          'effective_status', rs.effective_status,
          'exception_type', rs.exception_type,
          'exception_label', rs.exception_label,
          'exception_source', hre.exception_source,
          'exception_notes', rs.exception_notes,
          'is_working_day', rs.is_working_day,
          'is_rest_day', rs.is_rest_day
        )
        order by gs.day_date asc
      )
      from generate_series(resolved_start, resolved_end, interval '1 day') as gs(day_date)
      cross join lateral public.resolve_hr_roster_day_status(worker_row.buk_employee_id, gs.day_date::date) rs
      left join lateral (
        select hx.exception_source
        from public.hr_roster_exceptions hx
        where hx.employee_buk_employee_id = worker_row.buk_employee_id
          and hx.exception_date = gs.day_date::date
          and hx.is_active = true
        limit 1
      ) hre on true
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_my_effective_permissions() from public, anon;
grant execute on function public.get_my_effective_permissions() to authenticated;

notify pgrst, 'reload schema';

commit;
