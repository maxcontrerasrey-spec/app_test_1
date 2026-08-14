set check_function_bodies = on;

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
  match_token text;
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
    for match_token in
      select upper(token_value #>> '{}')
      from jsonb_array_elements(candidate.match_rules) rule_item,
           jsonb_array_elements(rule_item -> 'contains') token_value
    loop
      if normalized like '%' || match_token || '%' then
        return candidate.id;
      end if;
    end loop;
  end loop;

  return general_id;
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
  claimed_interpretation_id uuid;
  interpretation_status text;
  interpretation_claim uuid;
  created_run_id uuid;
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
    returning id into created_run_id;

    return jsonb_build_object(
      'cached', true,
      'interpretation_id', existing.id,
      'run_id', created_run_id,
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
  returning id, status, claim_token into claimed_interpretation_id, interpretation_status, interpretation_claim;

  if interpretation_claim is distinct from p_claim_token or interpretation_status <> 'PROCESSING' then
    raise exception 'Interpretación IA ya está en ejecución o revisión';
  end if;

  insert into private.psych_ai_runs(interpretation_id, provider, model, status, attempt)
  select claimed_interpretation_id, p_provider, p_model, 'PROCESSING',
         coalesce((
           select max(r.attempt) + 1
           from private.psych_ai_runs r
           where r.interpretation_id = claimed_interpretation_id
         ), 1)
  returning id into created_run_id;

  update private.psychometric_assessments
  set ai_status = 'PROCESSING',
      ai_updated_at = nowv,
      updated_at = nowv
  where id = p_assessment_id;

  insert into private.psychometric_audit_log(assessment_id, event_type, actor_user_id, metadata)
  values(p_assessment_id, 'psych_ai_claimed', p_actor_user_id, jsonb_build_object('provider', p_provider, 'model', p_model, 'input_hash', p_input_hash));

  return jsonb_build_object(
    'cached', false,
    'interpretation_id', claimed_interpretation_id,
    'run_id', created_run_id,
    'payload', payload,
    'system_prompt', payload #>> '{prompt,system_prompt}',
    'response_schema', payload #> '{prompt,response_schema}'
  );
end;
$$;

revoke all on function private.resolve_psych_job_profile(text) from public, anon, authenticated;
grant execute on function private.resolve_psych_job_profile(text) to service_role;

revoke all on function public.claim_psych_ai_interpretation(uuid,text,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_psych_ai_interpretation(uuid,text,text,text,uuid,uuid) to service_role;

notify pgrst, 'reload schema';
