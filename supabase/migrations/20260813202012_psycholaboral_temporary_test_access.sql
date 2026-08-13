-- Temporary QA-only access for the explicitly authorized RUT.
-- Remove this migration/function after the controlled test window (2026-08-20 UTC).
create or replace function public.redeem_psycholaboral_temporary_test_access(
  p_public_id uuid,
  p_rut text,
  p_session_hash text,
  p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  a private.psychometric_assessments%rowtype;
  expected_rut text := regexp_replace(upper(coalesce(p_rut,'')),'[^0-9K]','','g');
  actual_rut text;
  nowv timestamptz := timezone('utc',now());
begin
  if nowv >= timestamptz '2026-08-20 00:00:00+00'
     or expected_rut <> '167064116'
     or length(coalesce(p_session_hash,'')) <> 64 then
    return jsonb_build_object('access_denied',true);
  end if;
  select * into a
  from private.psychometric_assessments
  where public_id=p_public_id
  for update;
  if a.id is null or a.delivery_status<>'sent' or a.invite_consumed_at is not null
     or a.invite_expires_at<=nowv then
    return jsonb_build_object('access_denied',true);
  end if;
  select regexp_replace(upper(coalesce(cp.national_id,'')),'[^0-9K]','','g') into actual_rut
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp on cp.id=rcc.candidate_profile_id
  join public.recruitment_cases rc on rc.id=rcc.recruitment_case_id
  where rcc.id=a.recruitment_case_candidate_id
    and rc.status not in ('filled','closed_unfilled','cancelled')
    and rcc.stage_code not in ('hired','rejected','withdrawn');
  if actual_rut is null or actual_rut<>expected_rut then
    return jsonb_build_object('access_denied',true);
  end if;
  update private.psychometric_assessments
  set invite_consumed_at=nowv,session_hash=p_session_hash,started_at=nowv,
      deadline_at=nowv+interval '90 minutes',execution_status='in_progress',updated_at=nowv
  where id=a.id;
  insert into private.psychometric_audit_log(assessment_id,event_type,metadata)
  values(a.id,'temporary_test_access_used',jsonb_build_object('expires_at','2026-08-20T00:00:00Z'));
  return public.get_psycholaboral_candidate_session(p_session_hash);
end
$$;
revoke all on function public.redeem_psycholaboral_temporary_test_access(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.redeem_psycholaboral_temporary_test_access(uuid,text,text,text) to service_role;
