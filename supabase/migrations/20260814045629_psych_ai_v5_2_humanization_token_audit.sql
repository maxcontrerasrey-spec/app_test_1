set check_function_bodies = on;

alter table private.psych_ai_runs
  add column if not exists analyst_input_tokens integer,
  add column if not exists analyst_cached_input_tokens integer,
  add column if not exists analyst_output_tokens integer,
  add column if not exists analyst_reasoning_tokens integer,
  add column if not exists analyst_total_tokens integer,
  add column if not exists reviewer_executed boolean,
  add column if not exists reviewer_reason text,
  add column if not exists reviewer_input_tokens integer,
  add column if not exists reviewer_cached_input_tokens integer,
  add column if not exists reviewer_output_tokens integer,
  add column if not exists reviewer_reasoning_tokens integer,
  add column if not exists reviewer_total_tokens integer,
  add column if not exists retry_count integer,
  add column if not exists api_call_count integer,
  add column if not exists assessment_total_tokens integer;

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
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
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
  analyst jsonb := coalesce(p_metadata #> '{analyst}', '{}'::jsonb);
  reviewer jsonb := coalesce(p_metadata #> '{reviewer}', '{}'::jsonb);
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
      error_message = left(coalesce(p_error_message, ''), 600),
      metadata = coalesce(p_metadata, '{}'::jsonb),
      analyst_input_tokens = nullif(analyst->>'input_tokens','')::integer,
      analyst_cached_input_tokens = nullif(analyst->>'cached_input_tokens','')::integer,
      analyst_output_tokens = nullif(analyst->>'output_tokens','')::integer,
      analyst_reasoning_tokens = nullif(analyst->>'reasoning_tokens','')::integer,
      analyst_total_tokens = nullif(analyst->>'total_tokens','')::integer,
      reviewer_executed = coalesce((reviewer->>'executed')::boolean, false),
      reviewer_reason = nullif(reviewer->>'reason',''),
      reviewer_input_tokens = nullif(reviewer->>'input_tokens','')::integer,
      reviewer_cached_input_tokens = nullif(reviewer->>'cached_input_tokens','')::integer,
      reviewer_output_tokens = nullif(reviewer->>'output_tokens','')::integer,
      reviewer_reasoning_tokens = nullif(reviewer->>'reasoning_tokens','')::integer,
      reviewer_total_tokens = nullif(reviewer->>'total_tokens','')::integer,
      retry_count = nullif(p_metadata->>'retry_count','')::integer,
      api_call_count = nullif(p_metadata->>'api_call_count','')::integer,
      assessment_total_tokens = nullif(p_metadata->>'assessment_total_tokens','')::integer
  where id = p_run_id;

  update private.psychometric_assessments
  set ai_status = statusv,
      ai_updated_at = nowv,
      updated_at = nowv
  where id = rec.assessment_id;

  insert into private.psychometric_audit_log(assessment_id, event_type, metadata)
  values(rec.assessment_id, case when p_success then 'psych_ai_pending_review' else 'psych_ai_failed' end,
         jsonb_build_object('interpretation_id', p_interpretation_id, 'run_id', p_run_id, 'flags', coalesce(p_guardrail_flags, '[]'::jsonb), 'telemetry', coalesce(p_metadata, '{}'::jsonb)));

  return jsonb_build_object('interpretation_id', p_interpretation_id, 'status', statusv);
end;
$$;

revoke all on function public.complete_psych_ai_interpretation(uuid,uuid,uuid,boolean,jsonb,text,jsonb,jsonb,integer,integer,integer,integer,numeric,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.complete_psych_ai_interpretation(uuid,uuid,uuid,boolean,jsonb,text,jsonb,jsonb,integer,integer,integer,integer,numeric,text,text,jsonb) to service_role;

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
          'cached_prompt_tokens', coalesce(r.analyst_cached_input_tokens, 0) + coalesce(r.reviewer_cached_input_tokens, 0),
          'completion_tokens', r.completion_tokens,
          'reasoning_tokens', coalesce(r.analyst_reasoning_tokens, 0) + coalesce(r.reviewer_reasoning_tokens, 0),
          'total_tokens', r.total_tokens,
          'estimated_cost_usd', r.estimated_cost_usd,
          'api_call_count', r.api_call_count,
          'retry_count', r.retry_count,
          'reviewer_executed', r.reviewer_executed,
          'reviewer_reason', r.reviewer_reason,
          'analyst', jsonb_build_object(
            'input_tokens', r.analyst_input_tokens,
            'cached_input_tokens', r.analyst_cached_input_tokens,
            'output_tokens', r.analyst_output_tokens,
            'reasoning_tokens', r.analyst_reasoning_tokens,
            'total_tokens', r.analyst_total_tokens
          ),
          'reviewer', jsonb_build_object(
            'executed', r.reviewer_executed,
            'reason', r.reviewer_reason,
            'input_tokens', r.reviewer_input_tokens,
            'cached_input_tokens', r.reviewer_cached_input_tokens,
            'output_tokens', r.reviewer_output_tokens,
            'reasoning_tokens', r.reviewer_reasoning_tokens,
            'total_tokens', r.reviewer_total_tokens
          ),
          'metadata', r.metadata,
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

revoke all on function public.get_psych_ai_review_detail(uuid) from public, anon;
grant execute on function public.get_psych_ai_review_detail(uuid) to authenticated;

update private.psych_prompt_versions
set is_active = false
where prompt_code = 'psych-ai-interpretation'
  and is_active = true;

insert into private.psych_prompt_versions(
  prompt_code,
  prompt_version,
  schema_version,
  provider,
  model,
  system_prompt,
  response_schema,
  content_sha256,
  is_active
)
values (
  'psych-ai-interpretation',
  'psych-ai-prompt-v5.2',
  'psych-ai-schema-v5.2',
  'openai',
  'gpt-5-mini',
  'Informe psicolaboral V5.2: interpretar a la persona en contexto laboral, no enumerar pruebas. Usar solo resultados calculados por el ERP y facts compactos. Redactar en español profesional natural, humano, prudente y aplicado al cargo. No recalcular scores. No inventar baremos, percentiles, eneatipos, nombres de factores PRP, diagnósticos ni decisiones APTO/NO APTO. No mostrar raw_total, F1-F6, ev_, norm_status, schema, payload, guardrail, metadata, códigos internos ni reglas del prompt. La PRP puede interpretarse solo en forma descriptiva preventiva desde score directo, punto medio matemático de escala y factores anónimos, sin clasificación poblacional. BIS-11 sobre el promedio no equivale a alto, crítico ni severo. Fortalezas y aspectos a profundizar deben ser conductuales, concretos y relevantes al cargo. Preguntas de entrevista neutrales, abiertas y no acusatorias. Notas metodológicas compactas al final.',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":[
      "executive_profile",
      "personality_profile",
      "interpersonal_profile",
      "safety_and_impulse_profile",
      "job_fit_analysis",
      "strengths",
      "points_to_explore",
      "interview_questions",
      "integrated_conclusion",
      "material_limitations"
    ],
    "properties":{
      "executive_profile":{"type":"string"},
      "personality_profile":{
        "type":"object",
        "additionalProperties":false,
        "required":["summary","self_regulation","discipline_structure","interpersonal_style","adaptability_thinking"],
        "properties":{
          "summary":{"type":"string"},
          "self_regulation":{"type":"string"},
          "discipline_structure":{"type":"string"},
          "interpersonal_style":{"type":"string"},
          "adaptability_thinking":{"type":"string"}
        }
      },
      "interpersonal_profile":{
        "type":"object",
        "additionalProperties":false,
        "required":["summary","communication","cooperation","initiative","response_under_pressure"],
        "properties":{
          "summary":{"type":"string"},
          "communication":{"type":"string"},
          "cooperation":{"type":"string"},
          "initiative":{"type":"string"},
          "response_under_pressure":{"type":"string"}
        }
      },
      "safety_and_impulse_profile":{
        "type":"object",
        "additionalProperties":false,
        "required":["summary","bis11","prp","combined_interpretation"],
        "properties":{
          "summary":{"type":"string"},
          "bis11":{"type":"string"},
          "prp":{"type":"string"},
          "combined_interpretation":{"type":"string"}
        }
      },
      "job_fit_analysis":{"type":"string"},
      "strengths":{
        "type":"array",
        "items":{
          "type":"object",
          "additionalProperties":false,
          "required":["title","text"],
          "properties":{"title":{"type":"string"},"text":{"type":"string"}}
        }
      },
      "points_to_explore":{
        "type":"array",
        "items":{
          "type":"object",
          "additionalProperties":false,
          "required":["title","text"],
          "properties":{"title":{"type":"string"},"text":{"type":"string"}}
        }
      },
      "interview_questions":{
        "type":"array",
        "items":{
          "type":"object",
          "additionalProperties":false,
          "required":["question","target"],
          "properties":{"question":{"type":"string"},"target":{"type":"string"}}
        }
      },
      "integrated_conclusion":{"type":"string"},
      "material_limitations":{"type":"array","items":{"type":"string"}}
    }
  }'::jsonb,
  encode(extensions.digest(
    'psych-ai-prompt-v5.2|psych-ai-schema-v5.2|openai|gpt-5-mini|humanized compact facts conditional reviewer',
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

notify pgrst, 'reload schema';
