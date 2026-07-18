begin;

create or replace function public.upsert_accreditation_requirement(
  p_requirement_id uuid default null,
  p_code text default null,
  p_name text default null,
  p_category text default 'general',
  p_description text default null,
  p_is_mandatory boolean default true,
  p_requires_expiry_date boolean default false,
  p_alert_days_before_expiry integer default 30,
  p_blocks_accreditation boolean default true,
  p_validity_days integer default null,
  p_is_active boolean default true,
  p_process_scope text default 'accreditation'
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
  normalized_scope text := lower(trim(coalesce(p_process_scope, 'accreditation')));
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para configurar requisitos de acreditacion';
  end if;

  if normalized_code = '' then
    raise exception 'Debe indicar el codigo del requisito';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Debe indicar el nombre del requisito';
  end if;

  if normalized_scope not in ('accreditation', 'internal_license', 'both') then
    raise exception 'Alcance invalido. Use: accreditation, internal_license o both';
  end if;

  if coalesce(p_alert_days_before_expiry, 30) < 0 then
    raise exception 'Los dias de alerta no pueden ser negativos';
  end if;

  if p_validity_days is not null and p_validity_days <= 0 then
    raise exception 'La vigencia debe ser positiva cuando se informa';
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
    process_scope,
    is_active,
    created_by
  )
  values (
    coalesce(p_requirement_id, gen_random_uuid()),
    normalized_code,
    trim(coalesce(p_name, '')),
    trim(coalesce(p_category, 'general')),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_is_mandatory, true),
    coalesce(p_requires_expiry_date, false),
    coalesce(p_alert_days_before_expiry, 30),
    coalesce(p_blocks_accreditation, true),
    p_validity_days,
    normalized_scope,
    coalesce(p_is_active, true),
    current_user_id
  )
  on conflict (code) do update
  set
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    is_mandatory = excluded.is_mandatory,
    requires_expiry_date = excluded.requires_expiry_date,
    alert_days_before_expiry = excluded.alert_days_before_expiry,
    blocks_accreditation = excluded.blocks_accreditation,
    validity_days = excluded.validity_days,
    process_scope = excluded.process_scope,
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
    jsonb_build_object('requirement_id', saved_id, 'code', normalized_code, 'process_scope', normalized_scope)
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
      select coalesce(jsonb_agg(requirement_row order by requirement_row->>'process_scope', requirement_row->>'category', requirement_row->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', r.id,
          'code', r.code,
          'name', r.name,
          'category', r.category,
          'process_scope', r.process_scope,
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
    'standards',
    (
      select coalesce(jsonb_agg(standard_row order by standard_row->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'owner_name', s.owner_name,
          'description', s.description,
          'is_active', s.is_active
        ) as standard_row
        from public.accreditation_standards s
      ) ranked_standards
    ),
    'standard_requirement_rules',
    (
      select coalesce(jsonb_agg(rule_row order by rule_row->>'standard_name', (rule_row->>'sort_order')::integer, rule_row->>'requirement_name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', asr.id,
          'standard_id', asr.standard_id,
          'standard_name', ast.name,
          'requirement_id', asr.requirement_id,
          'requirement_name', ar.name,
          'process_scope', ar.process_scope,
          'sort_order', asr.sort_order,
          'notes', asr.notes,
          'is_active', asr.is_active
        ) as rule_row
        from public.accreditation_standard_requirements asr
        join public.accreditation_standards ast
          on ast.id = asr.standard_id
        join public.accreditation_requirements ar
          on ar.id = asr.requirement_id
      ) ranked_standard_rules
    ),
    'site_standard_rules',
    (
      select coalesce(jsonb_agg(rule_row order by rule_row->>'site_name', rule_row->>'standard_name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', ass.id,
          'site_id', ass.site_id,
          'site_name', site.name,
          'standard_id', ass.standard_id,
          'standard_name', ast.name,
          'notes', ass.notes,
          'is_active', ass.is_active
        ) as rule_row
        from public.accreditation_site_standards ass
        join public.accreditation_sites site
          on site.id = ass.site_id
        join public.accreditation_standards ast
          on ast.id = ass.standard_id
      ) ranked_site_standard_rules
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
          'process_scope', r.process_scope,
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
        jsonb_agg(jsonb_build_object('value', job_title, 'label', job_title) order by job_title),
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
        jsonb_agg(jsonb_build_object('value', contract_code, 'label', contract_label, 'area_code', area_code) order by contract_label),
        '[]'::jsonb
      )
      from (
        select distinct
          trim(c.code) as contract_code,
          trim(coalesce(nullif(c.contract_name, ''), nullif(c.cost_unit_name, ''), c.code)) || ' · ' || trim(c.code) as contract_label,
          nullif(trim(c.cost_center_code), '') as area_code
        from public.contracts c
        where c.is_active = true
          and nullif(trim(c.code), '') is not null
      ) active_contracts
    ),
    'area_options',
    (
      select coalesce(
        jsonb_agg(jsonb_build_object('value', area_code, 'label', area_label) order by area_label),
        '[]'::jsonb
      )
      from (
        select distinct
          trim(c.cost_center_code) as area_code,
          trim(c.cost_center_code) || ' · ' || trim(coalesce(nullif(c.cost_center_name, ''), nullif(c.cost_unit_name, ''), nullif(c.contract_name, ''), c.cost_center_code)) as area_label
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
      'process_scopes',
      jsonb_build_array(
        jsonb_build_object('value', 'accreditation', 'label', 'Acreditacion ingreso', 'description', 'Requisito para entrar a dependencias de la faena.'),
        jsonb_build_object('value', 'internal_license', 'label', 'Licencia interna', 'description', 'Requisito para manejar u operar dentro de dependencias.'),
        jsonb_build_object('value', 'both', 'label', 'Ingreso y licencia interna', 'description', 'Requisito comun a ambos alcances.')
      ),
      'field_guides',
      jsonb_build_object(
        'site', '[]'::jsonb,
        'requirement', jsonb_build_array(
          jsonb_build_object('key', 'process_scope', 'label', 'Alcance', 'required', true, 'source', 'Catalogo controlado', 'target', 'accreditation_requirements.process_scope', 'description', 'Distingue si el requisito habilita ingreso, licencia interna o ambos.')
        ),
        'matrix', '[]'::jsonb
      )
    )
  );
end;
$function$;

revoke all on function public.upsert_accreditation_requirement(uuid, text, text, text, text, boolean, boolean, integer, boolean, integer, boolean, text) from public, anon;
grant execute on function public.upsert_accreditation_requirement(uuid, text, text, text, text, boolean, boolean, integer, boolean, integer, boolean, text) to authenticated;

revoke all on function public.get_accreditation_setup_catalogs() from public, anon;
grant execute on function public.get_accreditation_setup_catalogs() to authenticated;

notify pgrst, 'reload schema';

commit;
