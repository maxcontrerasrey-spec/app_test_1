-- Fix the submit RPC's PL/pgSQL name collision between the local `result`
-- variable and the instrument table column. Existing saved responses remain
-- untouched; this only makes the completion write explicit and idempotent.
create or replace function public.submit_psycholaboral_instrument(
  p_session_hash text,
  p_instrument_code text,
  p_responses jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  assessment private.psychometric_assessments%rowtype;
  instrument_id uuid;
  version_id uuid;
  scored_result jsonb;
  remaining integer;
begin
  select * into assessment
  from private.psychometric_assessments
  where session_hash=p_session_hash
  for update;

  if assessment.id is null
     or assessment.execution_status not in ('in_progress','completed')
     or (assessment.execution_status='in_progress' and assessment.deadline_at<=timezone('utc',now())) then
    raise exception 'La sesión no es válida';
  end if;

  if exists(
    select 1
    from private.psychometric_assessment_consents assigned
    where assigned.assessment_id=assessment.id
      and not exists(
        select 1
        from private.psychometric_consent_acceptances accepted
        where accepted.assessment_id=assessment.id
          and accepted.consent_version_id=assigned.consent_version_id
      )
  ) then
    raise exception 'Debes aceptar los consentimientos antes de responder';
  end if;

  select ai.id, ai.instrument_version_id
    into instrument_id, version_id
  from private.psychometric_assessment_instruments ai
  join private.psychometric_instrument_versions v on v.id=ai.instrument_version_id
  where ai.assessment_id=assessment.id and v.instrument_code=p_instrument_code
  for update;

  if instrument_id is null then raise exception 'Instrumento inválido'; end if;
  if exists(
    select 1 from private.psychometric_assessment_instruments completed
    where completed.id=instrument_id and completed.status='completed'
  ) then
    return public.get_psycholaboral_candidate_session(p_session_hash);
  end if;

  scored_result:=private.score_psychometric_instrument(version_id,p_responses);
  update private.psychometric_assessment_instruments ai
  set responses=p_responses,
      response_sha256=encode(extensions.digest(convert_to(p_responses::text,'utf8'),'sha256'),'hex'),
      result=scored_result,
      result_sha256=encode(extensions.digest(convert_to(scored_result::text,'utf8'),'sha256'),'hex'),
      status='completed',
      completed_at=timezone('utc',now()),
      updated_at=timezone('utc',now())
  where ai.id=instrument_id;

  select count(*) into remaining
  from private.psychometric_assessment_instruments ai
  where ai.assessment_id=assessment.id and ai.status<>'completed';

  if remaining=0 then
    update private.psychometric_assessments a
    set execution_status='completed',
        completed_at=coalesce(a.completed_at,timezone('utc',now())),
        certificate_status=case when a.certificate_status='generated' then a.certificate_status else 'queued' end,
        updated_at=timezone('utc',now())
    where a.id=assessment.id;
    insert into private.psychometric_audit_log(assessment_id,event_type,metadata)
    values(assessment.id,'assessment_completed',jsonb_build_object('instrument_count',(select count(*) from private.psychometric_assessment_instruments ai where ai.assessment_id=assessment.id)))
    on conflict do nothing;
  end if;

  return public.get_psycholaboral_candidate_session(p_session_hash);
end
$$;

revoke all on function public.submit_psycholaboral_instrument(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_psycholaboral_instrument(text,text,jsonb) to service_role;
notify pgrst, 'reload schema';
