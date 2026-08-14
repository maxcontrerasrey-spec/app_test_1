begin;

create extension if not exists pgcrypto;
create schema if not exists private;
create schema if not exists extensions;
revoke all on schema private from public, anon, authenticated;

alter table private.psychometric_assessments
  add column if not exists ai_status text not null default 'NOT_REQUESTED'
    check (ai_status in ('NOT_REQUESTED','QUEUED','PROCESSING','AI_DRAFT','FAILED','PENDING_REVIEW','REVIEWED','VALIDATED','OBSERVED')),
  add column if not exists ai_updated_at timestamptz;

create table if not exists private.psych_job_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_code text not null,
  version text not null,
  label text not null,
  description text not null,
  match_rules jsonb not null default '[]'::jsonb,
  profile_payload jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (profile_code, version)
);

create unique index if not exists psych_job_profile_one_active
  on private.psych_job_profile_versions(profile_code)
  where is_active;

create table if not exists private.psych_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_code text not null,
  prompt_version text not null,
  schema_version text not null,
  provider text not null,
  model text not null,
  system_prompt text not null,
  response_schema jsonb not null,
  content_sha256 text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (prompt_code, prompt_version, schema_version)
);

create unique index if not exists psych_prompt_one_active
  on private.psych_prompt_versions(prompt_code)
  where is_active;

create table if not exists private.psych_ai_interpretations (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references private.psychometric_assessments(id) on delete cascade,
  profile_version_id uuid references private.psych_job_profile_versions(id),
  prompt_version_id uuid references private.psych_prompt_versions(id),
  provider text not null,
  model text not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED','PROCESSING','AI_DRAFT','FAILED','PENDING_REVIEW','REVIEWED','VALIDATED','OBSERVED')),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  input_payload jsonb not null,
  original_output jsonb,
  reviewed_output jsonb,
  validation_flags jsonb not null default '[]'::jsonb,
  guardrail_flags jsonb not null default '[]'::jsonb,
  output_hash text check (output_hash is null or output_hash ~ '^[a-f0-9]{64}$'),
  reviewed_output_hash text check (reviewed_output_hash is null or reviewed_output_hash ~ '^[a-f0-9]{64}$'),
  claim_token uuid,
  claimed_at timestamptz,
  reviewer_comment text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  generated_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, input_hash, provider, model)
);

create index if not exists idx_psych_ai_interpretations_assessment
  on private.psych_ai_interpretations(assessment_id, created_at desc);

create table if not exists private.psych_ai_runs (
  id uuid primary key default gen_random_uuid(),
  interpretation_id uuid not null references private.psych_ai_interpretations(id) on delete cascade,
  provider text not null,
  model text not null,
  status text not null check (status in ('QUEUED','PROCESSING','SUCCESS','FAILED','CACHE_HIT')),
  attempt integer not null default 1,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(12, 6),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

alter table private.psych_job_profile_versions enable row level security;
alter table private.psych_prompt_versions enable row level security;
alter table private.psych_ai_interpretations enable row level security;
alter table private.psych_ai_runs enable row level security;

revoke all on private.psych_job_profile_versions from public, anon, authenticated;
revoke all on private.psych_prompt_versions from public, anon, authenticated;
revoke all on private.psych_ai_interpretations from public, anon, authenticated;
revoke all on private.psych_ai_runs from public, anon, authenticated;
grant all on private.psych_job_profile_versions to service_role;
grant all on private.psych_prompt_versions to service_role;
grant all on private.psych_ai_interpretations to service_role;
grant all on private.psych_ai_runs to service_role;

with profiles(profile_code, label, description, match_rules, profile_payload) as (
  values
  ('CONDUCCION','Conducción operacional','Roles de conducción de buses, minibuses, camionetas y transporte operacional.',
   '[{"field":"job_position_name","contains":["CONDUCTOR","CHOFER","OPERADOR DE BUS","MINIBUS","FURGON"]}]'::jsonb,
   '{"critical_context":["atención sostenida","cumplimiento de normas","autocontrol operacional","trato respetuoso","tolerancia a rutina"],"risk_watch":["impulsividad alta","baja adherencia a reglas","irritabilidad sostenida","baja conciencia preventiva"],"interview_focus":["historial de incidentes","manejo de presión","respuesta ante instrucciones contradictorias"]}'::jsonb),
  ('SUPERVISION','Supervisión y coordinación','Roles con coordinación de equipos, control operativo o jefatura directa.',
   '[{"field":"job_position_name","contains":["SUPERVISOR","JEFE","COORDINADOR","ENCARGADO"]}]'::jsonb,
   '{"critical_context":["criterio de priorización","comunicación clara","manejo de conflicto","seguimiento de normas"],"risk_watch":["dominancia rígida","baja escucha","tensión sostenida"],"interview_focus":["retroalimentación difícil","decisiones bajo presión","escalamiento de riesgos"]}'::jsonb),
  ('MANTENIMIENTO','Mantenimiento','Roles técnicos de mantenimiento, mecánica, electricidad y soporte operacional.',
   '[{"field":"job_position_name","contains":["MECANICO","MECÁNICO","ELECTRICO","ELÉCTRICO","MANTENIMIENTO","TECNICO","TÉCNICO"]}]'::jsonb,
   '{"critical_context":["orden técnico","atención al detalle","seguimiento de procedimiento","reporte de anomalías"],"risk_watch":["improvisación riesgosa","baja planificación","tolerancia excesiva a fallas"],"interview_focus":["bloqueo de equipo inseguro","trabajo con checklist","errores detectados tarde"]}'::jsonb),
  ('HSEC','Prevención y HSEC','Roles de prevención, seguridad, salud ocupacional y control documental HSEC.',
   '[{"field":"job_position_name","contains":["PREVENCION","PREVENCIÓN","HSEC","SEGURIDAD","RIESGOS"]}]'::jsonb,
   '{"critical_context":["influencia normativa","criterio preventivo","firmeza comunicacional","registro documental"],"risk_watch":["baja asertividad","flexibilidad excesiva con normas","dificultad para intervenir"],"interview_focus":["detención de trabajos","manejo de resistencia","comunicación de hallazgos"]}'::jsonb),
  ('ADMINISTRACION','Administración','Roles administrativos, soporte, control documental y gestión interna.',
   '[{"field":"job_position_name","contains":["ADMINISTRATIVO","ASISTENTE","ANALISTA","CONTROL DOCUMENTAL"]}]'::jsonb,
   '{"critical_context":["orden","confiabilidad","comunicación interna","seguimiento de pendientes"],"risk_watch":["baja estructura","desorganización","evitación de coordinación"],"interview_focus":["manejo de volumen","errores administrativos","priorización"]}'::jsonb),
  ('LIDERAZGO','Liderazgo','Roles de conducción estratégica, liderazgo transversal o responsabilidad gerencial.',
   '[{"field":"job_position_name","contains":["GERENTE","DIRECTOR","SUBGERENTE","LIDER","LÍDER"]}]'::jsonb,
   '{"critical_context":["criterio estratégico","influencia","regulación emocional","lectura organizacional"],"risk_watch":["dominancia sin escucha","decisiones impulsivas","baja adaptación"],"interview_focus":["dilemas éticos","conflictos entre áreas","decisiones con información incompleta"]}'::jsonb),
  ('GENERAL','Perfil general','Perfil por defecto cuando el cargo no calza con una familia específica.',
   '[]'::jsonb,
   '{"critical_context":["calidad de respuesta","estabilidad general","interacción laboral","adherencia a normas"],"risk_watch":["patrones extremos","inconsistencia","baja variabilidad"],"interview_focus":["motivación por el cargo","experiencia previa","situaciones de presión"]}'::jsonb)
)
insert into private.psych_job_profile_versions(profile_code, version, label, description, match_rules, profile_payload, is_active)
select profile_code, 'profile-v1', label, description, match_rules, profile_payload, true
from profiles
on conflict (profile_code, version) do update
set label = excluded.label,
    description = excluded.description,
    match_rules = excluded.match_rules,
    profile_payload = excluded.profile_payload,
    is_active = true;

insert into private.psych_prompt_versions(prompt_code, prompt_version, schema_version, provider, model, system_prompt, response_schema, content_sha256, is_active)
values (
  'psych-ai-interpretation',
  'psych-ai-prompt-v1',
  'psych-ai-schema-v1',
  'groq',
  'openai/gpt-oss-120b',
  'Eres un asistente técnico de apoyo psicolaboral para el ERP Buses JM. Interpreta únicamente resultados estructurados ya calculados por el ERP. No calcules ni modifiques scores, dimensiones, índices, calidad de respuesta ni ajuste al cargo. No emitas diagnósticos clínicos, aptitud, contratación, rechazo, percentiles ni baremos no entregados. Redacta en español chileno formal, descriptivo y prudente. Toda conclusión es preliminar y requiere revisión profesional.',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":["version","executive_summary","response_quality","strengths","development_areas","interview_questions","ipip16","ipc","bis11","prp","integrated_analysis","preliminary_conclusion","limitations","evidence"],
    "properties":{
      "version":{"type":"string"},
      "executive_summary":{"type":"string"},
      "response_quality":{"type":"string"},
      "strengths":{"type":"array","items":{"type":"string"},"minItems":3,"maxItems":6},
      "development_areas":{"type":"array","items":{"type":"string"},"minItems":3,"maxItems":6},
      "interview_questions":{"type":"array","items":{"type":"string"},"minItems":4,"maxItems":8},
      "ipip16":{"type":"object","additionalProperties":false,"required":["summary","clusters"],"properties":{"summary":{"type":"string"},"clusters":{"type":"object","additionalProperties":{"type":"string"}}}},
      "ipc":{"type":"object","additionalProperties":false,"required":["summary","predominant_profile","disc_disclaimer"],"properties":{"summary":{"type":"string"},"predominant_profile":{"type":"string"},"disc_disclaimer":{"type":"string"}}},
      "bis11":{"type":"object","additionalProperties":false,"required":["summary","impulsivity_interpretation"],"properties":{"summary":{"type":"string"},"impulsivity_interpretation":{"type":"string"}}},
      "prp":{"type":"object","additionalProperties":false,"required":["summary","documentation_status"],"properties":{"summary":{"type":"string"},"documentation_status":{"type":"string"}}},
      "integrated_analysis":{"type":"string"},
      "preliminary_conclusion":{"type":"string"},
      "limitations":{"type":"array","items":{"type":"string"},"minItems":3,"maxItems":8},
      "evidence":{"type":"array","items":{"type":"string"},"minItems":4,"maxItems":10}
    }
  }'::jsonb,
  encode(extensions.digest(
    'psych-ai-prompt-v1|psych-ai-schema-v1|openai/gpt-oss-120b|ERP calcula IA interpreta',
    'sha256'
  ), 'hex'),
  true
)
on conflict (prompt_code, prompt_version, schema_version) do update
set provider = excluded.provider,
    model = excluded.model,
    system_prompt = excluded.system_prompt,
    response_schema = excluded.response_schema,
    content_sha256 = excluded.content_sha256,
    is_active = true;

create or replace function private.resolve_psych_job_profile(p_job_position_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized text := upper(coalesce(p_job_position_name, ''));
  candidate record;
  token text;
  general_id uuid;
begin
  select id into general_id
  from private.psych_job_profile_versions
  where is_active and profile_code = 'GENERAL'
  order by created_at desc
  limit 1;

  for candidate in
    select id, profile_code, match_rules
    from private.psych_job_profile_versions
    where is_active and profile_code <> 'GENERAL'
    order by case profile_code
      when 'CONDUCCION' then 1
      when 'HSEC' then 2
      when 'SUPERVISION' then 3
      when 'MANTENIMIENTO' then 4
      when 'ADMINISTRACION' then 5
      when 'LIDERAZGO' then 6
      else 20
    end
  loop
    for token in
      select upper(value::text #>> '{}')
      from jsonb_array_elements(candidate.match_rules) rule,
           jsonb_array_elements(rule -> 'contains') value
    loop
      if normalized like '%' || token || '%' then
        return candidate.id;
      end if;
    end loop;
  end loop;

  return general_id;
end;
$$;

create or replace function public.get_psych_ai_input_payload(p_assessment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'assessment_public_ref', left(a.public_id::text, 8),
    'completed_at', a.completed_at,
    'job_context', jsonb_build_object(
      'job_position_name', rc.job_position_name,
      'contract_name', rc.contract_name,
      'profile', jsonb_build_object(
        'code', profile.profile_code,
        'version', profile.version,
        'label', profile.label,
        'description', profile.description,
        'payload', profile.profile_payload
      )
    ),
    'prompt', jsonb_build_object(
      'prompt_code', prompt.prompt_code,
      'prompt_version', prompt.prompt_version,
      'schema_version', prompt.schema_version,
      'provider', prompt.provider,
      'model', prompt.model,
      'system_prompt', prompt.system_prompt,
      'response_schema', prompt.response_schema,
      'content_sha256', prompt.content_sha256
    ),
    'instruments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', v.instrument_code,
        'name', v.name,
        'content_version', v.content_version,
        'scoring_version', v.scoring_version,
        'result', case
          when v.instrument_code = 'IPIP_IPC_32'
            then ai.result || jsonb_build_object('labor_profile', private.psycholaboral_ipc_profile(ai.result))
          else ai.result
        end,
        'quality', private.psychometric_response_quality(ai.responses, v.response_options),
        'response_count', private.jsonb_object_size(ai.responses),
        'result_sha256', ai.result_sha256
      ) order by ai.sort_order)
      from private.psychometric_assessment_instruments ai
      join private.psychometric_instrument_versions v on v.id = ai.instrument_version_id
      where ai.assessment_id = a.id
    ), '[]'::jsonb),
    'constraints', jsonb_build_object(
      'no_decision', true,
      'no_diagnosis', true,
      'no_score_changes', true,
      'no_raw_answers', true,
      'language', 'es-CL',
      'review_required', true
    )
  )
  into payload
  from private.psychometric_assessments a
  join public.recruitment_case_candidates rcc on rcc.id = a.recruitment_case_candidate_id
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  join private.psych_job_profile_versions profile
    on profile.id = private.resolve_psych_job_profile(rc.job_position_name)
  join private.psych_prompt_versions prompt
    on prompt.prompt_code = 'psych-ai-interpretation' and prompt.is_active
  where a.id = p_assessment_id
    and a.execution_status = 'completed';

  if payload is null then
    raise exception 'Evaluación no disponible para interpretación IA';
  end if;

  return payload;
end;
$$;

create or replace function public.claim_psych_ai_interpretation(
  p_assessment_id uuid,
  p_input_hash text,
  p_provider text,
  p_model text,
  p_claim_token uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  profile_id uuid;
  prompt_id uuid;
  interpretation_id uuid;
  interpretation_status text;
  interpretation_claim uuid;
  run_id uuid;
  existing record;
  nowv timestamptz := timezone('utc', now());
begin
  if p_input_hash is null or p_input_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Hash de entrada inválido';
  end if;

  payload := public.get_psych_ai_input_payload(p_assessment_id);

  select id into profile_id
  from private.psych_job_profile_versions
  where is_active and profile_code = payload #>> '{job_context,profile,code}'
  limit 1;

  select id into prompt_id
  from private.psych_prompt_versions
  where is_active and prompt_code = 'psych-ai-interpretation'
  limit 1;

  select *
  into existing
  from private.psych_ai_interpretations
  where assessment_id = p_assessment_id
    and input_hash = p_input_hash
    and provider = p_provider
    and model = p_model
    and status in ('PENDING_REVIEW','REVIEWED','VALIDATED','OBSERVED')
  order by created_at desc
  limit 1;

  if existing.id is not null then
    insert into private.psych_ai_runs(interpretation_id, provider, model, status, attempt, finished_at, metadata)
    values(existing.id, p_provider, p_model, 'CACHE_HIT', 0, nowv, jsonb_build_object('reason','same_input_hash'))
    returning id into run_id;

    return jsonb_build_object(
      'cached', true,
      'interpretation_id', existing.id,
      'run_id', run_id,
      'payload', null,
      'interpretation', coalesce(existing.reviewed_output, existing.original_output),
      'status', existing.status
    );
  end if;

  insert into private.psych_ai_interpretations(
    assessment_id, profile_version_id, prompt_version_id, provider, model, status,
    input_hash, input_payload, claim_token, claimed_at, created_by
  )
  values(
    p_assessment_id, profile_id, prompt_id, p_provider, p_model, 'PROCESSING',
    p_input_hash, payload, p_claim_token, nowv, p_actor_user_id
  )
  on conflict (assessment_id, input_hash, provider, model)
  do update
  set status = case
      when private.psych_ai_interpretations.status in ('FAILED','QUEUED')
        or private.psych_ai_interpretations.claimed_at < nowv - interval '10 minutes'
      then 'PROCESSING'
      else private.psych_ai_interpretations.status
    end,
    claim_token = case
      when private.psych_ai_interpretations.status in ('FAILED','QUEUED')
        or private.psych_ai_interpretations.claimed_at < nowv - interval '10 minutes'
      then p_claim_token
      else private.psych_ai_interpretations.claim_token
    end,
    claimed_at = case
      when private.psych_ai_interpretations.status in ('FAILED','QUEUED')
        or private.psych_ai_interpretations.claimed_at < nowv - interval '10 minutes'
      then nowv
      else private.psych_ai_interpretations.claimed_at
    end,
    input_payload = excluded.input_payload,
    profile_version_id = excluded.profile_version_id,
    prompt_version_id = excluded.prompt_version_id,
    updated_at = nowv
  returning id, status, claim_token into interpretation_id, interpretation_status, interpretation_claim;

  if interpretation_claim is distinct from p_claim_token or interpretation_status <> 'PROCESSING' then
    raise exception 'Interpretación IA ya está en ejecución o revisión';
  end if;

  insert into private.psych_ai_runs(interpretation_id, provider, model, status, attempt)
  select interpretation_id, p_provider, p_model, 'PROCESSING',
         coalesce((select max(r.attempt) + 1 from private.psych_ai_runs r where r.interpretation_id = interpretation_id), 1)
  returning id into run_id;

  update private.psychometric_assessments
  set ai_status = 'PROCESSING',
      ai_updated_at = nowv,
      updated_at = nowv
  where id = p_assessment_id;

  insert into private.psychometric_audit_log(assessment_id, event_type, actor_user_id, metadata)
  values(p_assessment_id, 'psych_ai_claimed', p_actor_user_id, jsonb_build_object('provider', p_provider, 'model', p_model, 'input_hash', p_input_hash));

  return jsonb_build_object(
    'cached', false,
    'interpretation_id', interpretation_id,
    'run_id', run_id,
    'payload', payload,
    'system_prompt', payload #>> '{prompt,system_prompt}',
    'response_schema', payload #> '{prompt,response_schema}'
  );
end;
$$;

create or replace function public.complete_psych_ai_interpretation(
  p_interpretation_id uuid,
  p_run_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_output jsonb default null,
  p_output_hash text default null,
  p_validation_flags jsonb default '[]'::jsonb,
  p_guardrail_flags jsonb default '[]'::jsonb,
  p_latency_ms integer default null,
  p_prompt_tokens integer default null,
  p_completion_tokens integer default null,
  p_total_tokens integer default null,
  p_estimated_cost_usd numeric default null,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  statusv text;
  nowv timestamptz := timezone('utc', now());
begin
  select id, assessment_id
  into rec
  from private.psych_ai_interpretations
  where id = p_interpretation_id
    and claim_token = p_claim_token
  for update;

  if rec.id is null then
    raise exception 'Claim IA inválido';
  end if;

  if p_success and (p_output is null or jsonb_typeof(p_output) <> 'object') then
    raise exception 'Salida IA inválida';
  end if;

  statusv := case when p_success then 'PENDING_REVIEW' else 'FAILED' end;

  update private.psych_ai_interpretations
  set status = statusv,
      original_output = case when p_success then p_output else original_output end,
      output_hash = case when p_success then p_output_hash else output_hash end,
      validation_flags = coalesce(p_validation_flags, '[]'::jsonb),
      guardrail_flags = coalesce(p_guardrail_flags, '[]'::jsonb),
      generated_at = case when p_success then nowv else generated_at end,
      failed_at = case when p_success then failed_at else nowv end,
      last_error = case when p_success then null else left(coalesce(p_error_message, 'Error IA'), 600) end,
      claim_token = null,
      claimed_at = null,
      updated_at = nowv
  where id = p_interpretation_id;

  update private.psych_ai_runs
  set status = case when p_success then 'SUCCESS' else 'FAILED' end,
      finished_at = nowv,
      latency_ms = p_latency_ms,
      prompt_tokens = p_prompt_tokens,
      completion_tokens = p_completion_tokens,
      total_tokens = p_total_tokens,
      estimated_cost_usd = p_estimated_cost_usd,
      error_code = p_error_code,
      error_message = left(coalesce(p_error_message, ''), 600)
  where id = p_run_id;

  update private.psychometric_assessments
  set ai_status = statusv,
      ai_updated_at = nowv,
      updated_at = nowv
  where id = rec.assessment_id;

  insert into private.psychometric_audit_log(assessment_id, event_type, metadata)
  values(rec.assessment_id, case when p_success then 'psych_ai_pending_review' else 'psych_ai_failed' end,
         jsonb_build_object('interpretation_id', p_interpretation_id, 'run_id', p_run_id, 'flags', coalesce(p_guardrail_flags, '[]'::jsonb)));

  return jsonb_build_object('interpretation_id', p_interpretation_id, 'status', statusv);
end;
$$;

create or replace function public.get_psych_ai_review_detail(p_assessment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  payload jsonb;
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then
    raise exception 'Sin permisos para Gestión Psicolaboral';
  end if;

  select jsonb_build_object(
    'assessment_id', a.id,
    'ai_status', a.ai_status,
    'candidate', jsonb_build_object(
      'full_name', cp.full_name,
      'national_id', cp.national_id,
      'job_position_name', rc.job_position_name,
      'contract_name', rc.contract_name
    ),
    'interpretation', case when i.id is null then null else jsonb_build_object(
      'id', i.id,
      'status', i.status,
      'provider', i.provider,
      'model', i.model,
      'input_hash', i.input_hash,
      'original_output', i.original_output,
      'reviewed_output', i.reviewed_output,
      'display_output', coalesce(i.reviewed_output, i.original_output),
      'validation_flags', i.validation_flags,
      'guardrail_flags', i.guardrail_flags,
      'reviewer_comment', i.reviewer_comment,
      'reviewed_at', i.reviewed_at,
      'generated_at', i.generated_at,
      'profile', jsonb_build_object('code', p.profile_code, 'label', p.label, 'version', p.version),
      'prompt', jsonb_build_object('version', pv.prompt_version, 'schema_version', pv.schema_version, 'content_sha256', pv.content_sha256),
      'runs', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'status', r.status,
          'attempt', r.attempt,
          'latency_ms', r.latency_ms,
          'prompt_tokens', r.prompt_tokens,
          'completion_tokens', r.completion_tokens,
          'total_tokens', r.total_tokens,
          'estimated_cost_usd', r.estimated_cost_usd,
          'error_code', r.error_code,
          'created_at', r.started_at
        ) order by r.started_at desc)
        from private.psych_ai_runs r
        where r.interpretation_id = i.id
      ), '[]'::jsonb)
    ) end
  )
  into payload
  from private.psychometric_assessments a
  join public.recruitment_case_candidates rcc on rcc.id = a.recruitment_case_candidate_id
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  left join lateral (
    select *
    from private.psych_ai_interpretations i
    where i.assessment_id = a.id
    order by i.created_at desc
    limit 1
  ) i on true
  left join private.psych_job_profile_versions p on p.id = i.profile_version_id
  left join private.psych_prompt_versions pv on pv.id = i.prompt_version_id
  where a.id = p_assessment_id;

  if payload is null then
    raise exception 'Evaluación no encontrada';
  end if;

  return payload;
end;
$$;

create or replace function public.review_psych_ai_interpretation(
  p_interpretation_id uuid,
  p_action text,
  p_reviewed_output jsonb default null,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rec record;
  next_status text;
  output_hash text;
  nowv timestamptz := timezone('utc', now());
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then
    raise exception 'Sin permisos para Gestión Psicolaboral';
  end if;

  if p_action not in ('save_review','validate','observe') then
    raise exception 'Acción de revisión inválida';
  end if;

  select i.id, i.assessment_id, i.original_output, i.reviewed_output
  into rec
  from private.psych_ai_interpretations i
  where i.id = p_interpretation_id
    and i.status in ('PENDING_REVIEW','REVIEWED','VALIDATED','OBSERVED')
  for update;

  if rec.id is null then
    raise exception 'Interpretación no disponible para revisión';
  end if;

  next_status := case
    when p_action = 'validate' then 'VALIDATED'
    when p_action = 'observe' then 'OBSERVED'
    else 'REVIEWED'
  end;

  if p_action = 'observe' and nullif(trim(coalesce(p_comment, '')), '') is null then
    raise exception 'Debes indicar la observación profesional';
  end if;

  if p_reviewed_output is not null and jsonb_typeof(p_reviewed_output) <> 'object' then
    raise exception 'La revisión debe ser un objeto JSON';
  end if;

  output_hash := case
    when p_reviewed_output is null then null
    else encode(extensions.digest(p_reviewed_output::text, 'sha256'), 'hex')
  end;

  update private.psych_ai_interpretations
  set status = next_status,
      reviewed_output = coalesce(p_reviewed_output, reviewed_output, original_output),
      reviewed_output_hash = coalesce(output_hash, reviewed_output_hash),
      reviewer_comment = nullif(trim(coalesce(p_comment, '')), ''),
      reviewed_by = uid,
      reviewed_at = nowv,
      updated_at = nowv
  where id = rec.id;

  update private.psychometric_assessments
  set ai_status = next_status,
      ai_updated_at = nowv,
      updated_at = nowv
  where id = rec.assessment_id;

  insert into private.psychometric_audit_log(assessment_id, event_type, actor_user_id, metadata)
  values(rec.assessment_id, 'psych_ai_' || lower(next_status), uid, jsonb_build_object('interpretation_id', rec.id, 'comment_present', nullif(trim(coalesce(p_comment, '')), '') is not null));

  return public.get_psych_ai_review_detail(rec.assessment_id);
end;
$$;

create or replace function public.get_psycholaboral_candidates_page(
  p_search text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  lim int := least(greatest(coalesce(p_limit,50),1),100);
  offv int := greatest(coalesce(p_offset,0),0);
  q text := lower(trim(coalesce(p_search,'')));
  items jsonb;
  total bigint;
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then
    raise exception 'Sin permisos para Gestión Psicolaboral';
  end if;

  with base as (
    select
      rcc.id,
      cp.full_name,
      cp.national_id,
      coalesce(nullif(lower(trim(cp.personal_email)),''), nullif(lower(trim(cp.email)),'')) email,
      rc.case_code,
      hr.folio,
      rc.contract_name,
      rc.job_position_name,
      rc.status case_status,
      rcc.stage_code,
      rcc.stage_entered_at,
      a.id assessment_id,
      a.delivery_status,
      a.execution_status,
      a.decision,
      a.created_at assessment_created_at,
      a.issued_at,
      a.started_at,
      a.deadline_at,
      a.completed_at,
      a.certificate_status,
      a.certificate_path,
      a.report_status,
      a.ai_status,
      a.ai_updated_at,
      latest_ai.id ai_interpretation_id,
      latest_ai.status ai_interpretation_status,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', v.instrument_code,
          'name', v.short_name,
          'status', ai.status,
          'answered', private.jsonb_object_size(ai.responses),
          'total', jsonb_array_length(v.questions)
        ) order by ai.sort_order)
        from private.psychometric_assessment_instruments ai
        join private.psychometric_instrument_versions v on v.id = ai.instrument_version_id
        where ai.assessment_id = a.id
      ), '[]'::jsonb) instruments
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
    join public.hiring_requests hr on hr.id = rc.hiring_request_id
    join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
    left join lateral (
      select pa.*
      from private.psychometric_assessments pa
      where pa.recruitment_case_candidate_id = rcc.id
        and not (pa.delivery_status = 'failed' and pa.execution_status = 'cancelled')
      order by pa.created_at desc
      limit 1
    ) a on true
    left join lateral (
      select i.id, i.status
      from private.psych_ai_interpretations i
      where i.assessment_id = a.id
      order by i.created_at desc
      limit 1
    ) latest_ai on true
    where rc.status not in ('filled','closed_unfilled','cancelled')
      and rcc.stage_code not in ('hired','rejected','withdrawn')
  ),
  filtered as (
    select *,
      case when assessment_id is null then 'not_sent'
           when execution_status = 'completed' then 'completed'
           else 'sent'
      end display_status
    from base
    where q = ''
       or lower(concat_ws(' ', full_name, national_id, email, case_code, folio::text, contract_name, job_position_name)) like '%' || q || '%'
  ),
  selected as (
    select *
    from filtered
    where nullif(trim(coalesce(p_status,'')), '') is null
       or display_status = p_status
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.assessment_created_at desc nulls last, p.full_name), '[]'::jsonb),
         (select count(*) from selected)
  into items, total
  from (
    select *
    from selected
    order by assessment_created_at desc nulls last, full_name
    limit lim offset offv
  ) p;

  return jsonb_build_object('items', coalesce(items, '[]'::jsonb), 'total_count', coalesce(total, 0));
end;
$$;

create or replace function public.get_psycholaboral_result_detail(p_assessment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  payload jsonb;
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then
    raise exception 'Sin permisos para Gestión Psicolaboral';
  end if;

  select jsonb_build_object(
    'assessment_id', a.id,
    'candidate', jsonb_build_object(
      'full_name', cp.full_name,
      'national_id', cp.national_id,
      'job_position_name', rc.job_position_name,
      'contract_name', rc.contract_name
    ),
    'execution_status', a.execution_status,
    'decision', a.decision,
    'completed_at', a.completed_at,
    'certificate_status', a.certificate_status,
    'certificate_available', a.certificate_status = 'generated',
    'ai_status', a.ai_status,
    'ai_interpretation', case when latest_ai.id is null then null else jsonb_build_object(
      'id', latest_ai.id,
      'status', latest_ai.status,
      'provider', latest_ai.provider,
      'model', latest_ai.model,
      'display_output', coalesce(latest_ai.reviewed_output, latest_ai.original_output),
      'validation_flags', latest_ai.validation_flags,
      'guardrail_flags', latest_ai.guardrail_flags,
      'reviewer_comment', latest_ai.reviewer_comment,
      'reviewed_at', latest_ai.reviewed_at,
      'generated_at', latest_ai.generated_at
    ) end,
    'instruments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', v.instrument_code,
        'name', v.name,
        'result', case when v.instrument_code = 'IPIP_IPC_32'
          then ai.result || jsonb_build_object('labor_profile', private.psycholaboral_ipc_profile(ai.result))
          else ai.result
        end,
        'response_count', private.jsonb_object_size(ai.responses),
        'quality', private.psychometric_response_quality(ai.responses, v.response_options),
        'response_distribution', (
          select jsonb_object_agg(distribution.value, distribution.response_count)
          from (
            select response.value, count(*) as response_count
            from jsonb_each_text(ai.responses) response
            group by response.value
          ) distribution
        )
      ) order by ai.sort_order)
      from private.psychometric_assessment_instruments ai
      join private.psychometric_instrument_versions v on v.id = ai.instrument_version_id
      where ai.assessment_id = a.id
    ), '[]'::jsonb)
  )
  into payload
  from private.psychometric_assessments a
  join public.recruitment_case_candidates rcc on rcc.id = a.recruitment_case_candidate_id
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  left join lateral (
    select *
    from private.psych_ai_interpretations i
    where i.assessment_id = a.id
    order by i.created_at desc
    limit 1
  ) latest_ai on true
  where a.id = p_assessment_id;

  if payload is null then
    raise exception 'Evaluación no encontrada';
  end if;

  return payload;
end;
$$;

create or replace function public.get_psycholaboral_certificate_payload(p_assessment_id uuid, p_claim_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  claimed uuid;
begin
  update private.psychometric_assessments
  set certificate_status = 'processing',
      report_status = 'processing',
      certificate_claim_token = p_claim_token,
      certificate_claimed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_assessment_id
    and execution_status = 'completed'
    and (
      certificate_status in ('queued','failed')
      or (certificate_status = 'processing' and certificate_claimed_at < timezone('utc', now()) - interval '10 minutes')
    )
  returning id into claimed;

  if claimed is null then
    raise exception 'El certificado ya fue procesado o está en ejecución';
  end if;

  select jsonb_build_object(
    'assessment_id', a.id,
    'public_id', a.public_id,
    'completed_at', a.completed_at,
    'candidate', jsonb_build_object(
      'full_name', cp.full_name,
      'national_id', cp.national_id,
      'job_position_name', rc.job_position_name,
      'contract_name', rc.contract_name,
      'case_code', rc.case_code,
      'company_name', coalesce((
        select bcm.company_name
        from public.buk_contract_mappings bcm
        where bcm.contract_id = rc.contract_id and bcm.is_operational
        order by bcm.is_one_to_one desc, bcm.updated_at desc
        limit 1
      ), 'Buses JM')
    ),
    'ai_interpretation', case when latest_ai.id is null then null else jsonb_build_object(
      'id', latest_ai.id,
      'status', latest_ai.status,
      'provider', latest_ai.provider,
      'model', latest_ai.model,
      'display_output', coalesce(latest_ai.reviewed_output, latest_ai.original_output),
      'validation_flags', latest_ai.validation_flags,
      'guardrail_flags', latest_ai.guardrail_flags,
      'reviewer_comment', latest_ai.reviewer_comment,
      'reviewed_at', latest_ai.reviewed_at,
      'generated_at', latest_ai.generated_at
    ) end,
    'instruments', (
      select jsonb_agg(jsonb_build_object(
        'code', v.instrument_code,
        'name', v.name,
        'result', case when v.instrument_code = 'IPIP_IPC_32'
          then ai.result || jsonb_build_object('labor_profile', private.psycholaboral_ipc_profile(ai.result))
          else ai.result
        end,
        'response_count', private.jsonb_object_size(ai.responses),
        'quality', private.psychometric_response_quality(ai.responses, v.response_options),
        'response_summary', (
          select jsonb_agg(jsonb_build_object(
            'label', option_item ->> 'label',
            'count', (
              select count(*)
              from jsonb_each_text(ai.responses) response
              where response.value::numeric = (option_item ->> 'value')::numeric
            )
          ) order by (option_item ->> 'value')::numeric)
          from jsonb_array_elements(v.response_options) option_item
        ),
        'result_sha256', ai.result_sha256
      ) order by ai.sort_order)
      from private.psychometric_assessment_instruments ai
      join private.psychometric_instrument_versions v on v.id = ai.instrument_version_id
      where ai.assessment_id = a.id
    ),
    'consents', (
      select jsonb_agg(jsonb_build_object(
        'code', c.code,
        'version', c.version,
        'document_sha256', c.document_sha256,
        'accepted_at', ca.accepted_at
      ) order by c.code)
      from private.psychometric_consent_acceptances ca
      join private.psychometric_consent_versions c on c.id = ca.consent_version_id
      where ca.assessment_id = a.id
    )
  )
  into payload
  from private.psychometric_assessments a
  join public.recruitment_case_candidates rcc on rcc.id = a.recruitment_case_candidate_id
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  left join lateral (
    select *
    from private.psych_ai_interpretations i
    where i.assessment_id = a.id
      and i.status in ('PENDING_REVIEW','REVIEWED','VALIDATED','OBSERVED')
    order by case i.status when 'VALIDATED' then 1 when 'REVIEWED' then 2 when 'PENDING_REVIEW' then 3 else 4 end, i.created_at desc
    limit 1
  ) latest_ai on true
  where a.id = p_assessment_id and a.execution_status = 'completed';

  if payload is null then
    raise exception 'Evaluación no disponible';
  end if;

  return payload;
end;
$$;

revoke all on function private.resolve_psych_job_profile(text) from public, anon, authenticated;
grant execute on function private.resolve_psych_job_profile(text) to service_role;

revoke all on function public.get_psych_ai_input_payload(uuid) from public, anon, authenticated;
grant execute on function public.get_psych_ai_input_payload(uuid) to service_role;

revoke all on function public.claim_psych_ai_interpretation(uuid,text,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_psych_ai_interpretation(uuid,text,text,text,uuid,uuid) to service_role;

revoke all on function public.complete_psych_ai_interpretation(uuid,uuid,uuid,boolean,jsonb,text,jsonb,jsonb,integer,integer,integer,integer,numeric,text,text) from public, anon, authenticated;
grant execute on function public.complete_psych_ai_interpretation(uuid,uuid,uuid,boolean,jsonb,text,jsonb,jsonb,integer,integer,integer,integer,numeric,text,text) to service_role;

revoke all on function public.get_psych_ai_review_detail(uuid) from public, anon;
grant execute on function public.get_psych_ai_review_detail(uuid) to authenticated;

revoke all on function public.review_psych_ai_interpretation(uuid,text,jsonb,text) from public, anon;
grant execute on function public.review_psych_ai_interpretation(uuid,text,jsonb,text) to authenticated;

revoke all on function public.get_psycholaboral_candidates_page(text,text,integer,integer) from public, anon;
grant execute on function public.get_psycholaboral_candidates_page(text,text,integer,integer) to authenticated;

revoke all on function public.get_psycholaboral_result_detail(uuid) from public, anon;
grant execute on function public.get_psycholaboral_result_detail(uuid) to authenticated;

revoke all on function public.get_psycholaboral_certificate_payload(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_psycholaboral_certificate_payload(uuid,uuid) to service_role;

notify pgrst, 'reload schema';

commit;
