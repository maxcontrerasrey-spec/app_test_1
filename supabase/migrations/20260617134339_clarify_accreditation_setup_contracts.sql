begin;

create or replace function public.upsert_accreditation_site(
  p_site_id uuid,
  p_code text,
  p_name text,
  p_site_type text default 'contract',
  p_contract_code text default null,
  p_area_code text default null,
  p_description text default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  saved_id uuid;
  normalized_code text := lower(trim(coalesce(p_code, '')));
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_site_type text := lower(trim(coalesce(p_site_type, 'contract')));
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para configurar faenas de acreditacion';
  end if;

  if normalized_code = '' then
    raise exception 'Debe informar el codigo unico de la faena o centro';
  end if;

  if normalized_name = '' then
    raise exception 'Debe informar el nombre visible de la faena o centro';
  end if;

  if normalized_site_type not in ('contract', 'cost_center', 'project', 'site', 'other') then
    raise exception 'Tipo de faena invalido. Use: contract, cost_center, project, site u other';
  end if;

  insert into public.accreditation_sites (
    id,
    code,
    name,
    site_type,
    contract_code,
    area_code,
    description,
    is_active,
    created_by
  )
  values (
    coalesce(p_site_id, gen_random_uuid()),
    normalized_code,
    normalized_name,
    normalized_site_type,
    nullif(trim(coalesce(p_contract_code, '')), ''),
    nullif(trim(coalesce(p_area_code, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (id) do update
  set
    code = excluded.code,
    name = excluded.name,
    site_type = excluded.site_type,
    contract_code = excluded.contract_code,
    area_code = excluded.area_code,
    description = excluded.description,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    null,
    null,
    saved_id,
    null,
    'site_upserted',
    'Faena de acreditacion guardada',
    jsonb_build_object(
      'site_id', saved_id,
      'code', normalized_code,
      'site_type', normalized_site_type,
      'contract_code', nullif(trim(coalesce(p_contract_code, '')), ''),
      'area_code', nullif(trim(coalesce(p_area_code, '')), '')
    )
  );

  return saved_id;
end;
$function$;

create or replace function public.upsert_accreditation_requirement(
  p_requirement_id uuid,
  p_code text,
  p_name text,
  p_category text default 'general',
  p_description text default null,
  p_is_mandatory boolean default true,
  p_requires_expiry_date boolean default false,
  p_alert_days_before_expiry integer default 30,
  p_blocks_accreditation boolean default true,
  p_validity_days integer default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  saved_id uuid;
  normalized_code text := lower(trim(coalesce(p_code, '')));
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_category text := lower(trim(coalesce(p_category, 'general')));
  normalized_validity_days integer := p_validity_days;
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para configurar requisitos de acreditacion';
  end if;

  if normalized_code = '' then
    raise exception 'Debe informar el codigo unico del requisito';
  end if;

  if normalized_name = '' then
    raise exception 'Debe informar el nombre visible del requisito';
  end if;

  if normalized_category = '' then
    raise exception 'Debe informar la categoria del requisito';
  end if;

  if coalesce(p_alert_days_before_expiry, 0) < 0 then
    raise exception 'La alerta previa no puede ser negativa';
  end if;

  if normalized_validity_days is not null and normalized_validity_days <= 0 then
    raise exception 'La vigencia debe ser mayor a cero cuando se informa';
  end if;

  insert into public.accreditation_requirements (
    id,
    code,
    name,
    category,
    description,
    is_mandatory,
    requires_expiry_date,
    alert_days_before_expiry,
    blocks_accreditation,
    validity_days,
    is_active,
    created_by
  )
  values (
    coalesce(p_requirement_id, gen_random_uuid()),
    normalized_code,
    normalized_name,
    normalized_category,
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_is_mandatory, true),
    coalesce(p_requires_expiry_date, false),
    greatest(coalesce(p_alert_days_before_expiry, 30), 0),
    coalesce(p_blocks_accreditation, true),
    normalized_validity_days,
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (id) do update
  set
    code = excluded.code,
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    is_mandatory = excluded.is_mandatory,
    requires_expiry_date = excluded.requires_expiry_date,
    alert_days_before_expiry = excluded.alert_days_before_expiry,
    blocks_accreditation = excluded.blocks_accreditation,
    validity_days = excluded.validity_days,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    null,
    null,
    null,
    null,
    'requirement_upserted',
    'Requisito de acreditacion guardado',
    jsonb_build_object(
      'requirement_id', saved_id,
      'code', normalized_code,
      'category', normalized_category,
      'requires_expiry_date', coalesce(p_requires_expiry_date, false),
      'validity_days', normalized_validity_days
    )
  );

  return saved_id;
end;
$function$;

create or replace function public.upsert_accreditation_matrix_rule(
  p_rule_id uuid,
  p_site_id uuid,
  p_requirement_id uuid,
  p_job_title text default null,
  p_sort_order integer default 0,
  p_notes text default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  saved_id uuid;
  normalized_job_title text := nullif(trim(coalesce(p_job_title, '')), '');
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para configurar la matriz de acreditacion';
  end if;

  if p_site_id is null then
    raise exception 'Debe seleccionar la faena o centro al que aplica la regla';
  end if;

  if p_requirement_id is null then
    raise exception 'Debe seleccionar el requisito que se exigira en la regla';
  end if;

  if not exists (
    select 1
    from public.accreditation_sites s
    where s.id = p_site_id
      and s.is_active = true
  ) then
    raise exception 'La faena seleccionada no existe o esta inactiva';
  end if;

  if not exists (
    select 1
    from public.accreditation_requirements r
    where r.id = p_requirement_id
      and r.is_active = true
  ) then
    raise exception 'El requisito seleccionado no existe o esta inactivo';
  end if;

  insert into public.accreditation_matrix (
    id,
    site_id,
    requirement_id,
    job_title,
    sort_order,
    notes,
    is_active,
    created_by
  )
  values (
    coalesce(p_rule_id, gen_random_uuid()),
    p_site_id,
    p_requirement_id,
    normalized_job_title,
    coalesce(p_sort_order, 0),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (id) do update
  set
    site_id = excluded.site_id,
    requirement_id = excluded.requirement_id,
    job_title = excluded.job_title,
    sort_order = excluded.sort_order,
    notes = excluded.notes,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now())
  returning id into saved_id;

  perform public.log_accreditation_event(
    null,
    null,
    p_site_id,
    null,
    'matrix_rule_upserted',
    'Regla de matriz de acreditacion guardada',
    jsonb_build_object(
      'rule_id', saved_id,
      'site_id', p_site_id,
      'requirement_id', p_requirement_id,
      'job_title', normalized_job_title,
      'sort_order', coalesce(p_sort_order, 0)
    )
  );

  return saved_id;
end;
$function$;

create or replace function public.get_accreditation_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para consultar configuracion de acreditacion';
  end if;

  return jsonb_build_object(
    'sites',
    (
      select coalesce(jsonb_agg(site_row order by site_row->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'site_type', s.site_type,
          'contract_code', s.contract_code,
          'area_code', s.area_code,
          'description', s.description,
          'is_active', s.is_active
        ) as site_row
        from public.accreditation_sites s
      ) ranked_sites
    ),
    'requirements',
    (
      select coalesce(jsonb_agg(requirement_row order by requirement_row->>'category', requirement_row->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', r.id,
          'code', r.code,
          'name', r.name,
          'category', r.category,
          'description', r.description,
          'is_mandatory', r.is_mandatory,
          'requires_expiry_date', r.requires_expiry_date,
          'alert_days_before_expiry', r.alert_days_before_expiry,
          'blocks_accreditation', r.blocks_accreditation,
          'validity_days', r.validity_days,
          'is_active', r.is_active
        ) as requirement_row
        from public.accreditation_requirements r
      ) ranked_requirements
    ),
    'matrix_rules',
    (
      select coalesce(jsonb_agg(rule_row order by (rule_row->>'site_name'), (rule_row->>'sort_order')::integer, rule_row->>'requirement_name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', m.id,
          'site_id', m.site_id,
          'site_name', s.name,
          'requirement_id', m.requirement_id,
          'requirement_name', r.name,
          'job_title', m.job_title,
          'sort_order', m.sort_order,
          'notes', m.notes,
          'is_active', m.is_active
        ) as rule_row
        from public.accreditation_matrix m
        join public.accreditation_sites s
          on s.id = m.site_id
        join public.accreditation_requirements r
          on r.id = m.requirement_id
      ) ranked_rules
    ),
    'buk_job_titles',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('value', job_title, 'label', job_title)
          order by job_title
        ),
        '[]'::jsonb
      )
      from (
        select distinct
          coalesce(
            nullif(trim(e.job_title), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
            nullif(trim(e.raw_payload ->> 'job_title'), '')
          ) as job_title
        from public.employees_active_current e
      ) active_job_titles
      where job_title is not null
        and job_title <> ''
    ),
    'metadata',
    jsonb_build_object(
      'site_types',
      jsonb_build_array(
        jsonb_build_object('value', 'contract', 'label', 'Contrato', 'description', 'Faena o centro asociado a un contrato operativo.'),
        jsonb_build_object('value', 'cost_center', 'label', 'Centro de costo', 'description', 'Agrupador administrativo gobernado por centro de costo.'),
        jsonb_build_object('value', 'project', 'label', 'Proyecto', 'description', 'Faena temporal o frente operativo asociado a un proyecto.'),
        jsonb_build_object('value', 'site', 'label', 'Instalacion', 'description', 'Lugar fisico o recinto puntual de operacion.'),
        jsonb_build_object('value', 'other', 'label', 'Otro', 'description', 'Uso excepcional cuando no encaja en los tipos estandar.')
      ),
      'requirement_categories',
      jsonb_build_array(
        jsonb_build_object('value', 'general', 'label', 'General', 'description', 'Documento base aplicable transversalmente.'),
        jsonb_build_object('value', 'documental', 'label', 'Documental', 'description', 'Papeles legales o administrativos del trabajador.'),
        jsonb_build_object('value', 'seguridad', 'label', 'Seguridad', 'description', 'Exigencias de seguridad y prevencion de riesgos.'),
        jsonb_build_object('value', 'salud', 'label', 'Salud', 'description', 'Examenes o certificados medicos y ocupacionales.'),
        jsonb_build_object('value', 'operacional', 'label', 'Operacional', 'description', 'Habilitaciones exigidas por la faena o el cargo.'),
        jsonb_build_object('value', 'habilitante', 'label', 'Habilitante', 'description', 'Credenciales que sin ellas impiden prestar servicio.')
      ),
      'field_guides',
      jsonb_build_object(
        'site',
        jsonb_build_array(
          jsonb_build_object('key', 'code', 'label', 'Codigo', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_sites.code', 'description', 'Identificador unico interno de la faena o centro. Se reutiliza en filtros, trazabilidad y cruces operativos.'),
          jsonb_build_object('key', 'name', 'label', 'Nombre', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_sites.name', 'description', 'Nombre visible que vera el equipo en dashboard, buscadores y matrices.'),
          jsonb_build_object('key', 'site_type', 'label', 'Tipo', 'required', true, 'source', 'Catalogo controlado', 'target', 'accreditation_sites.site_type', 'description', 'Clasifica la faena para gobierno operativo. El valor viene de un catalogo fijo versionado en backend.'),
          jsonb_build_object('key', 'contract_code', 'label', 'Codigo contrato', 'required', false, 'source', 'Carga manual / contrato corporativo', 'target', 'accreditation_sites.contract_code', 'description', 'Codigo del contrato al que pertenece la faena. Permite alinear acreditacion con contratos y dotacion.'),
          jsonb_build_object('key', 'area_code', 'label', 'Codigo area', 'required', false, 'source', 'Carga manual / estructura interna', 'target', 'accreditation_sites.area_code', 'description', 'Codigo de area o centro de costo que gobierna la faena. Sirve para cruces administrativos.'),
          jsonb_build_object('key', 'description', 'label', 'Descripcion', 'required', false, 'source', 'Carga manual', 'target', 'accreditation_sites.description', 'description', 'Contexto libre para aclarar alcance, mandante o notas operativas de la faena.')
        ),
        'requirement',
        jsonb_build_array(
          jsonb_build_object('key', 'code', 'label', 'Codigo', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.code', 'description', 'Identificador unico del requisito. Conviene estable y corto para auditoria y futuras integraciones.'),
          jsonb_build_object('key', 'name', 'label', 'Nombre', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.name', 'description', 'Nombre visible del documento o validacion exigida al trabajador.'),
          jsonb_build_object('key', 'category', 'label', 'Categoria', 'required', true, 'source', 'Catalogo sugerido', 'target', 'accreditation_requirements.category', 'description', 'Agrupa requisitos por dominio operativo. El catalogo sugerido viene del backend, pero queda persistido como texto estable.'),
          jsonb_build_object('key', 'alert_days_before_expiry', 'label', 'Alerta dias', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.alert_days_before_expiry', 'description', 'Cuantos dias antes del vencimiento el requisito debe entrar en alerta. Solo impacta cuando el requisito usa fecha de vencimiento.'),
          jsonb_build_object('key', 'validity_days', 'label', 'Vigencia dias', 'required', false, 'source', 'Carga manual', 'target', 'accreditation_requirements.validity_days', 'description', 'Horizonte estandar de vigencia del documento si el negocio quiere gobernarlo por dias.'),
          jsonb_build_object('key', 'description', 'label', 'Descripcion', 'required', false, 'source', 'Carga manual', 'target', 'accreditation_requirements.description', 'description', 'Instruccion breve para el operador sobre que documento exacto debe pedir o revisar.'),
          jsonb_build_object('key', 'is_mandatory', 'label', 'Obligatorio', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.is_mandatory', 'description', 'Define si el requisito entra en el universo exigible de la acreditacion.'),
          jsonb_build_object('key', 'requires_expiry_date', 'label', 'Requiere vencimiento', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.requires_expiry_date', 'description', 'Activa control de fecha de expiracion y alertas por vencimiento.'),
          jsonb_build_object('key', 'blocks_accreditation', 'label', 'Bloquea acreditacion', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_requirements.blocks_accreditation', 'description', 'Si queda pendiente, rechazado o vencido, impide que la acreditacion del trabajador quede aprobada.')
        ),
        'matrix',
        jsonb_build_array(
          jsonb_build_object('key', 'site_id', 'label', 'Faena', 'required', true, 'source', 'Catalogo accreditation_sites', 'target', 'accreditation_matrix.site_id', 'description', 'Selecciona a que faena o centro se aplica la regla.'),
          jsonb_build_object('key', 'requirement_id', 'label', 'Requisito', 'required', true, 'source', 'Catalogo accreditation_requirements', 'target', 'accreditation_matrix.requirement_id', 'description', 'Selecciona que requisito sera exigido en esa faena o cargo.'),
          jsonb_build_object('key', 'job_title', 'label', 'Cargo exacto', 'required', false, 'source', 'BUK employees_active_current', 'target', 'accreditation_matrix.job_title', 'description', 'Cargo exacto obtenido desde trabajadores activos BUK. Si queda vacio, la regla aplica a toda la faena.'),
          jsonb_build_object('key', 'sort_order', 'label', 'Orden', 'required', true, 'source', 'Carga manual', 'target', 'accreditation_matrix.sort_order', 'description', 'Orden interno para presentar o priorizar requisitos dentro de la misma faena.'),
          jsonb_build_object('key', 'notes', 'label', 'Notas', 'required', false, 'source', 'Carga manual', 'target', 'accreditation_matrix.notes', 'description', 'Contexto adicional de por que aplica la regla o como debe revisarse.')
        )
      )
    )
  );
end;
$function$;

notify pgrst, 'reload schema';

commit;
