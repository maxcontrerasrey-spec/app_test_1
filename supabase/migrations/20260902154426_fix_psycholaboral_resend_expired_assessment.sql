-- EEES-DB-005: approved
-- owner: Engineering and Psycholaboral
-- rollback: forward-only; restaurar el comportamiento anterior mediante una migracion posterior, sin reabrir invitaciones ya expiradas.
begin;

create or replace function public.prepare_psycholaboral_dispatch(p_case_candidate_id uuid,p_instrument_codes text[],p_invite_hash text,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rec record; aid uuid; pid uuid; selected_count int; expired_id uuid;
begin
 if uid is null or not public.user_can_access_psycholaboral(uid) then raise exception 'Sin permisos para Gestión Psicolaboral'; end if;
 if coalesce(cardinality(p_instrument_codes),0)=0 or cardinality(p_instrument_codes)>4 then raise exception 'Selecciona al menos un test válido'; end if;
 if length(trim(coalesce(p_invite_hash,'')))<>64 or length(trim(coalesce(p_idempotency_key,'')))<16 then raise exception 'Solicitud inválida'; end if;
 select rcc.id,cp.full_name,cp.national_id,coalesce(nullif(lower(trim(cp.personal_email)),''),nullif(lower(trim(cp.email)),'')) email,rc.case_code,hr.folio,rc.contract_name,rc.job_position_name into rec
 from public.recruitment_case_candidates rcc join public.recruitment_cases rc on rc.id=rcc.recruitment_case_id join public.hiring_requests hr on hr.id=rc.hiring_request_id join public.candidate_profiles cp on cp.id=rcc.candidate_profile_id
 where rcc.id=p_case_candidate_id and rc.status not in ('filled','closed_unfilled','cancelled') and rcc.stage_code not in ('hired','rejected','withdrawn') for update of rcc;
 if rec.id is null then raise exception 'El candidato ya no tiene un proceso activo'; end if;
 if rec.email is null or rec.email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'El candidato no tiene un correo válido'; end if;
 select count(*) into selected_count from private.psychometric_instrument_versions v where v.is_active and v.instrument_code=any(p_instrument_codes);
 if selected_count<>cardinality(p_instrument_codes) or selected_count<>cardinality(array(select distinct unnest(p_instrument_codes))) then raise exception 'La batería contiene test inválidos o repetidos'; end if;

 update private.psychometric_assessments
 set execution_status='expired',last_error='Invitación caducada; se generó un nuevo envío.',updated_at=timezone('utc',now())
 where recruitment_case_candidate_id=rec.id
   and delivery_status='sent'
   and execution_status='not_started'
   and decision<>'rejected'
   and invite_consumed_at is null
   and invite_expires_at is not null
   and invite_expires_at<=timezone('utc',now())
 returning id into expired_id;

 if expired_id is not null then
  insert into private.psychometric_audit_log(assessment_id,event_type,actor_user_id,metadata)
  values(expired_id,'invite_expired_for_resend',uid,jsonb_build_object('reason','invite_expired','replacement_requested',true));
 end if;

 insert into private.psychometric_assessments(recruitment_case_candidate_id,email_snapshot,invite_hash,invite_expires_at,idempotency_key,created_by) values(rec.id,rec.email,p_invite_hash,timezone('utc',now())+interval '72 hours',p_idempotency_key,uid)
 on conflict(created_by,idempotency_key) do update set updated_at=timezone('utc',now()) returning id,public_id into aid,pid;
 if not exists(select 1 from private.psychometric_assessment_instruments where assessment_id=aid) then
  insert into private.psychometric_assessment_instruments(assessment_id,instrument_version_id,sort_order)
  select aid,v.id,row_number() over(order by array_position(p_instrument_codes,v.instrument_code)) from private.psychometric_instrument_versions v where v.is_active and v.instrument_code=any(p_instrument_codes);
 end if;
 if not exists(select 1 from private.psychometric_assessment_consents where assessment_id=aid) then
  insert into private.psychometric_assessment_consents(assessment_id,consent_version_id,sort_order)
  select aid,c.id,row_number() over(order by c.code) from private.psychometric_consent_versions c where c.is_active;
 end if;
 insert into private.psychometric_audit_log(assessment_id,event_type,actor_user_id,metadata) values(aid,'dispatch_prepared',uid,jsonb_build_object('instrument_count',selected_count));
 return jsonb_build_object('assessment_id',aid,'public_id',pid,'email',rec.email,'candidate_name',rec.full_name,'rut',rec.national_id,'case_code',rec.case_code,'folio',rec.folio,'contract_name',rec.contract_name,'job_position_name',rec.job_position_name);
end $$;

revoke all on function public.prepare_psycholaboral_dispatch(uuid,text[],text,text) from public,anon;
grant execute on function public.prepare_psycholaboral_dispatch(uuid,text[],text,text) to authenticated;

notify pgrst,'reload schema';
commit;
