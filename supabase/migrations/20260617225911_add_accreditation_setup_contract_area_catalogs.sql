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
    'contract_options',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'value', contract_code,
            'label', contract_label,
            'area_code', area_code
          )
          order by contract_label
        ),
        '[]'::jsonb
      )
      from (
        select distinct
          trim(c.code) as contract_code,
          trim(
            coalesce(nullif(c.contract_name, ''), nullif(c.cost_unit_name, ''), c.code)
          ) || ' · ' || trim(c.code) as contract_label,
          nullif(trim(c.cost_center_code), '') as area_code
        from public.contracts c
        where c.is_active = true
          and nullif(trim(c.code), '') is not null
      ) active_contracts
    ),
    'area_options',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'value', area_code,
            'label', area_label
          )
          order by area_label
        ),
        '[]'::jsonb
      )
      from (
        select distinct
          trim(c.cost_center_code) as area_code,
          trim(c.cost_center_code) || ' · ' || trim(
            coalesce(
              nullif(c.cost_center_name, ''),
              nullif(c.cost_unit_name, ''),
              nullif(c.contract_name, ''),
              c.cost_center_code
            )
          ) as area_label
        from public.contracts c
        where c.is_active = true
          and nullif(trim(c.cost_center_code), '') is not null
      ) active_areas
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
          jsonb_build_object('key', 'contract_code', 'label', 'Codigo contrato', 'required', false, 'source', 'Catalogo public.contracts', 'target', 'accreditation_sites.contract_code', 'description', 'Selecciona el contrato corporativo activo para evitar errores de digitacion y alinear acreditacion con dotacion.'),
          jsonb_build_object('key', 'area_code', 'label', 'Codigo area', 'required', false, 'source', 'Catalogo public.contracts.cost_center_code', 'target', 'accreditation_sites.area_code', 'description', 'Selecciona el CECO o codigo de area desde la estructura activa del repositorio para evitar variaciones manuales.'),
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

revoke all on function public.get_accreditation_setup_catalogs() from public, anon;
grant execute on function public.get_accreditation_setup_catalogs() to authenticated;

notify pgrst, 'reload schema';
