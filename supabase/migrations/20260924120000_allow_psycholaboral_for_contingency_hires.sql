-- EEES-DB-005: approved
-- owner: Recruitment and Psychological Assessment
-- rollback: forward-only; preserve candidate stage, case state and BUK evidence.
-- Rule: a hired candidate may use Psycholaboral only when the ERP can prove an
-- effective BUK generation or a linked external/contingency BUK hire.
begin;

create or replace function public.psycholaboral_candidate_has_eligible_process(
  p_case_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
    where rcc.id = p_case_candidate_id
      and (
        (
          rc.status not in ('filled', 'closed_unfilled', 'cancelled')
          and rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
        )
        or (
          rcc.stage_code = 'hired'
          and (
            exists (
              select 1
              from public.recruitment_case_external_hires external_hire
              where external_hire.recruitment_case_candidate_id = rcc.id
                and nullif(trim(external_hire.employee_buk_employee_id), '') is not null
            )
            or exists (
              select 1
              from public.buk_sync_jobs bsj
              where bsj.recruitment_case_candidate_id = rcc.id
                and public.is_effective_buk_generation_success(
                  bsj.status,
                  bsj.buk_employee_id,
                  bsj.result_snapshot
                )
            )
          )
        )
      )
  );
$function$;

revoke all on function public.psycholaboral_candidate_has_eligible_process(uuid)
  from public, anon, authenticated;
grant execute on function public.psycholaboral_candidate_has_eligible_process(uuid)
  to service_role;

create or replace function public.prepare_psycholaboral_dispatch(
  p_case_candidate_id uuid,
  p_instrument_codes text[],
  p_invite_hash text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  rec record;
  aid uuid;
  pid uuid;
  selected_count int;
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then
    raise exception 'Sin permisos para Gestión Psicolaboral';
  end if;
  if coalesce(cardinality(p_instrument_codes), 0) = 0 or cardinality(p_instrument_codes) > 4 then
    raise exception 'Selecciona al menos un test válido';
  end if;
  if length(trim(coalesce(p_invite_hash, ''))) <> 64 or length(trim(coalesce(p_idempotency_key, ''))) < 16 then
    raise exception 'Solicitud inválida';
  end if;

  select
    rcc.id,
    cp.full_name,
    cp.national_id,
    coalesce(nullif(lower(trim(cp.personal_email)), ''), nullif(lower(trim(cp.email)), '')) email,
    rc.case_code,
    hr.folio,
    rc.contract_name,
    rc.job_position_name
  into rec
  from public.recruitment_case_candidates rcc
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  join public.hiring_requests hr on hr.id = rc.hiring_request_id
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  where rcc.id = p_case_candidate_id
    and public.psycholaboral_candidate_has_eligible_process(rcc.id)
  for update of rcc;

  if rec.id is null then
    raise exception 'El candidato ya no tiene un proceso elegible para evaluación';
  end if;
  if rec.email is null or rec.email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El candidato no tiene un correo válido';
  end if;

  select count(*)
  into selected_count
  from private.psychometric_instrument_versions v
  where v.is_active and v.instrument_code = any(p_instrument_codes);
  if selected_count <> cardinality(p_instrument_codes)
     or selected_count <> cardinality(array(select distinct unnest(p_instrument_codes))) then
    raise exception 'La batería contiene test inválidos o repetidos';
  end if;

  insert into private.psychometric_assessments(
    recruitment_case_candidate_id,
    email_snapshot,
    invite_hash,
    invite_expires_at,
    idempotency_key,
    created_by
  )
  values (
    rec.id,
    rec.email,
    p_invite_hash,
    timezone('utc', now()) + interval '72 hours',
    p_idempotency_key,
    uid
  )
  on conflict (created_by, idempotency_key)
  do update set updated_at = timezone('utc', now())
  returning id, public_id into aid, pid;

  if not exists (
    select 1 from private.psychometric_assessment_instruments where assessment_id = aid
  ) then
    insert into private.psychometric_assessment_instruments(assessment_id, instrument_version_id, sort_order)
    select aid, v.id, row_number() over (order by array_position(p_instrument_codes, v.instrument_code))
    from private.psychometric_instrument_versions v
    where v.is_active and v.instrument_code = any(p_instrument_codes);
  end if;
  if not exists (
    select 1 from private.psychometric_assessment_consents where assessment_id = aid
  ) then
    insert into private.psychometric_assessment_consents(assessment_id, consent_version_id, sort_order)
    select aid, c.id, row_number() over (order by c.code)
    from private.psychometric_consent_versions c
    where c.is_active;
  end if;

  insert into private.psychometric_audit_log(assessment_id, event_type, actor_user_id, metadata)
  values (aid, 'dispatch_prepared', uid, jsonb_build_object(
    'instrument_count', selected_count,
    'eligibility_path', case when rec.id is not null then 'active_or_verified_hire' end
  ));
  return jsonb_build_object(
    'assessment_id', aid,
    'public_id', pid,
    'email', rec.email,
    'candidate_name', rec.full_name,
    'rut', rec.national_id,
    'case_code', rec.case_code,
    'folio', rec.folio,
    'contract_name', rec.contract_name,
    'job_position_name', rec.job_position_name
  );
end;
$function$;

create or replace function public.redeem_psycholaboral_invite(
  p_public_id uuid,
  p_rut text,
  p_invite_hash text,
  p_session_hash text,
  p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  a private.psychometric_assessments%rowtype;
  expected_rut text := regexp_replace(upper(coalesce(p_rut, '')), '[^0-9K]', '', 'g');
  actual_rut text;
  scope text := 'ip:' || left(coalesce(p_ip_hash, 'unknown'), 64);
  attempts int;
  nowv timestamptz := timezone('utc', now());
begin
  insert into private.psychometric_access_rate_limits(scope_key, window_started_at, attempt_count, updated_at)
  values (scope, nowv, 1, nowv)
  on conflict (scope_key) do update set
    attempt_count = case when private.psychometric_access_rate_limits.window_started_at < nowv - interval '15 minutes' then 1 else private.psychometric_access_rate_limits.attempt_count + 1 end,
    window_started_at = case when private.psychometric_access_rate_limits.window_started_at < nowv - interval '15 minutes' then nowv else private.psychometric_access_rate_limits.window_started_at end,
    updated_at = nowv
  returning attempt_count into attempts;
  if attempts > 8 then return jsonb_build_object('access_denied', true); end if;

  select * into a from private.psychometric_assessments where public_id = p_public_id for update;
  if a.id is null or a.delivery_status <> 'sent' or a.invite_consumed_at is not null
     or a.invite_hash <> p_invite_hash or a.invite_expires_at <= nowv then
    return jsonb_build_object('access_denied', true);
  end if;

  select regexp_replace(upper(coalesce(cp.national_id, '')), '[^0-9K]', '', 'g') into actual_rut
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  where rcc.id = a.recruitment_case_candidate_id
    and public.psycholaboral_candidate_has_eligible_process(rcc.id);
  if actual_rut is null or actual_rut <> expected_rut or length(p_session_hash) <> 64 then
    return jsonb_build_object('access_denied', true);
  end if;

  update private.psychometric_assessments
  set invite_consumed_at = nowv,
      session_hash = p_session_hash,
      started_at = nowv,
      deadline_at = nowv + interval '90 minutes',
      execution_status = 'in_progress',
      updated_at = nowv
  where id = a.id;
  insert into private.psychometric_audit_log(assessment_id, event_type, metadata)
  values (a.id, 'session_started', jsonb_build_object('deadline_at', nowv + interval '90 minutes'));
  return public.get_psycholaboral_candidate_session(p_session_hash);
end;
$function$;

create or replace function public.get_psycholaboral_candidate_session(p_session_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  a private.psychometric_assessments%rowtype;
  candidate jsonb;
  consents jsonb;
  accepted_count int;
  instruments jsonb;
begin
  select * into a from private.psychometric_assessments where session_hash = p_session_hash for update;
  if a.id is null or a.execution_status not in ('in_progress', 'completed') then
    raise exception 'La sesión no es válida';
  end if;
  if a.execution_status <> 'completed' and a.deadline_at <= timezone('utc', now()) then
    update private.psychometric_assessments set execution_status = 'expired', updated_at = timezone('utc', now()) where id = a.id;
    return jsonb_build_object('assessment_id', a.id, 'public_id', a.public_id, 'execution_status', 'expired', 'deadline_at', a.deadline_at, 'consents', '[]'::jsonb, 'consents_accepted', false, 'instruments', '[]'::jsonb);
  end if;
  if not public.psycholaboral_candidate_has_eligible_process(a.recruitment_case_candidate_id) then
    update private.psychometric_assessments set execution_status = 'cancelled', updated_at = timezone('utc', now()) where id = a.id;
    return jsonb_build_object('assessment_id', a.id, 'public_id', a.public_id, 'execution_status', 'cancelled', 'consents', '[]'::jsonb, 'consents_accepted', false, 'instruments', '[]'::jsonb);
  end if;
  select jsonb_build_object('full_name', cp.full_name, 'national_id', cp.national_id, 'job_position_name', rc.job_position_name, 'contract_name', rc.contract_name)
  into candidate
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  where rcc.id = a.recruitment_case_candidate_id;
  select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'version', c.version, 'title', c.title, 'body', c.body, 'document_sha256', c.document_sha256, 'accepted', ca.id is not null) order by ac.sort_order), '[]'::jsonb), count(ca.id)
  into consents, accepted_count
  from private.psychometric_assessment_consents ac
  join private.psychometric_consent_versions c on c.id = ac.consent_version_id
  left join private.psychometric_consent_acceptances ca on ca.consent_version_id = c.id and ca.assessment_id = a.id
  where ac.assessment_id = a.id;
  if accepted_count = (select count(*) from private.psychometric_assessment_consents where assessment_id = a.id) then
    select coalesce(jsonb_agg(jsonb_build_object('code', v.instrument_code, 'name', v.name, 'short_name', v.short_name, 'instructions', v.instructions, 'options', v.response_options, 'questions', (select jsonb_agg(jsonb_build_object('order', q.value->'order', 'text', q.value->'text') order by (q.value->>'order')::int) from jsonb_array_elements(v.questions) q), 'status', ai.status, 'responses', ai.responses, 'revision', ai.response_revision) order by ai.sort_order), '[]'::jsonb)
    into instruments
    from private.psychometric_assessment_instruments ai
    join private.psychometric_instrument_versions v on v.id = ai.instrument_version_id
    where ai.assessment_id = a.id;
  else
    instruments := '[]'::jsonb;
  end if;
  return jsonb_build_object('assessment_id', a.id, 'public_id', a.public_id, 'candidate', candidate, 'deadline_at', a.deadline_at, 'execution_status', a.execution_status, 'consents', consents, 'consents_accepted', accepted_count = (select count(*) from private.psychometric_assessment_consents where assessment_id = a.id), 'instruments', instruments);
end;
$function$;

revoke all on function public.prepare_psycholaboral_dispatch(uuid, text[], text, text)
  from public, anon;
grant execute on function public.prepare_psycholaboral_dispatch(uuid, text[], text, text)
  to authenticated;
revoke all on function public.redeem_psycholaboral_invite(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_psycholaboral_invite(uuid, text, text, text, text)
  to service_role;
revoke all on function public.get_psycholaboral_candidate_session(text)
  from public, anon, authenticated;
grant execute on function public.get_psycholaboral_candidate_session(text)
  to service_role;

notify pgrst, 'reload schema';
commit;
