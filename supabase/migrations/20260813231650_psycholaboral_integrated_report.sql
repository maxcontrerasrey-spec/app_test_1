alter table private.psychometric_assessments
  add column if not exists report_status text not null default 'not_ready' check (report_status in ('not_ready','queued','processing','generated','failed')),
  add column if not exists report_bucket text,
  add column if not exists report_path text,
  add column if not exists report_sha256 text,
  add column if not exists report_generated_at timestamptz;

create or replace function private.psychometric_response_quality(p_responses jsonb, p_options jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare total integer:=private.jsonb_object_size(p_responses); distinct_count integer; neutral_count integer; extreme_count integer; first_value text; straightline boolean:=true;
begin
 if total=0 then return jsonb_build_object('status','INSUFICIENTE','completitud',0,'motivos',jsonb_build_array('Sin respuestas'),'version','quality-v1'); end if;
 select count(distinct value) into distinct_count from jsonb_each_text(p_responses);
 select count(*) into neutral_count from jsonb_each_text(p_responses) e join jsonb_array_elements(p_options) o on (o->>'value')=e.value where (o->>'label') ilike '%neutro%' or (o->>'label') ilike '%indeciso%';
 select count(*) into extreme_count from jsonb_each_text(p_responses) e where e.value in ('1','5','0','4');
 select value into first_value from jsonb_each_text(p_responses) order by key limit 1;
 if first_value is null then straightline:=false; else select not exists(select 1 from jsonb_each_text(p_responses) e where e.value<>first_value) into straightline; end if;
 return jsonb_build_object('status',case when straightline or distinct_count=1 then 'REVISAR' when total<10 then 'INSUFICIENTE' else 'ADECUADA' end,'completitud',100,'items_respondidos',total,'valores_distintos',distinct_count,'neutros_indecisos',neutral_count,'extremos',extreme_count,'straight_lining',straightline,'motivos',case when straightline or distinct_count=1 then jsonb_build_array('Baja variabilidad o respuestas constantes') else '[]'::jsonb end,'version','quality-v1');
end $$;

create or replace function private.psycholaboral_ipc_profile(p_result jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare octants jsonb:=coalesce(p_result->'octants','{}'::jsonb); directivo numeric; influyente numeric; estable numeric; analitico numeric;
begin
 directivo:=round(((coalesce((octants->'PA'->>'mean')::numeric,0)+coalesce((octants->'BC'->>'mean')::numeric,0))/2)::numeric,2);
 influyente:=round(((coalesce((octants->'NO'->>'mean')::numeric,0)+coalesce((octants->'LM'->>'mean')::numeric,0))/2)::numeric,2);
 estable:=round(((coalesce((octants->'JK'->>'mean')::numeric,0)+coalesce((octants->'HI'->>'mean')::numeric,0))/2)::numeric,2);
 analitico:=round(((coalesce((octants->'FG'->>'mean')::numeric,0)+coalesce((octants->'DE'->>'mean')::numeric,0))/2)::numeric,2);
 return jsonb_build_object('model','laboral-ipc-v1','label','Perfil Conductual Laboral','styles',jsonb_build_object('Directivo',directivo,'Influyente',influyente,'Estable',estable,'Analítico',analitico),'note','Interpretación interna del ERP; no es DISC ni una equivalencia psicométrica validada.');
end $$;

-- Add deterministic quality indicators to the certificate payload without altering scores.
create or replace function public.get_psycholaboral_certificate_payload(p_assessment_id uuid,p_claim_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb; claimed uuid;
begin
 update private.psychometric_assessments set certificate_status='processing',report_status='processing',certificate_claim_token=p_claim_token,certificate_claimed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=p_assessment_id and execution_status='completed' and (certificate_status in ('queued','failed') or (certificate_status='processing' and certificate_claimed_at<timezone('utc',now())-interval '10 minutes')) returning id into claimed;
 if claimed is null then raise exception 'El certificado ya fue procesado o está en ejecución'; end if;
 select jsonb_build_object('assessment_id',a.id,'public_id',a.public_id,'completed_at',a.completed_at,'candidate',jsonb_build_object('full_name',cp.full_name,'national_id',cp.national_id,'job_position_name',rc.job_position_name,'contract_name',rc.contract_name,'case_code',rc.case_code,'company_name',coalesce((select bcm.company_name from public.buk_contract_mappings bcm where bcm.contract_id=rc.contract_id and bcm.is_operational order by bcm.is_one_to_one desc,bcm.updated_at desc limit 1),'Buses JM')),'instruments',(select jsonb_agg(jsonb_build_object('code',v.instrument_code,'name',v.name,'result',case when v.instrument_code='IPIP_IPC_32' then ai.result||jsonb_build_object('labor_profile',private.psycholaboral_ipc_profile(ai.result)) else ai.result end,'response_count',private.jsonb_object_size(ai.responses),'quality',private.psychometric_response_quality(ai.responses,v.response_options),'response_summary',(select jsonb_agg(jsonb_build_object('label',option_item->>'label','count',(select count(*) from jsonb_each_text(ai.responses) response where response.value::numeric=(option_item->>'value')::numeric)) order by (option_item->>'value')::numeric) from jsonb_array_elements(v.response_options) option_item),'result_sha256',ai.result_sha256) order by ai.sort_order) from private.psychometric_assessment_instruments ai join private.psychometric_instrument_versions v on v.id=ai.instrument_version_id where ai.assessment_id=a.id),'consents',(select jsonb_agg(jsonb_build_object('code',c.code,'version',c.version,'document_sha256',c.document_sha256,'accepted_at',ca.accepted_at) order by c.code) from private.psychometric_consent_acceptances ca join private.psychometric_consent_versions c on c.id=ca.consent_version_id where ca.assessment_id=a.id)) into payload from private.psychometric_assessments a join public.recruitment_case_candidates rcc on rcc.id=a.recruitment_case_candidate_id join public.candidate_profiles cp on cp.id=rcc.candidate_profile_id join public.recruitment_cases rc on rc.id=rcc.recruitment_case_id where a.id=p_assessment_id and a.execution_status='completed';
 if payload is null then raise exception 'Evaluación no disponible'; end if; return payload; end $$;

create or replace function public.complete_psycholaboral_certificate(p_assessment_id uuid,p_claim_token uuid,p_success boolean,p_bucket text default null,p_path text default null,p_sha256 text default null,p_error text default null,p_report_bucket text default null,p_report_path text default null,p_report_sha256 text default null) returns void language plpgsql security definer set search_path='' as $$
declare updated_id uuid;
begin
 update private.psychometric_assessments
 set certificate_status=case when p_success then 'generated' else 'failed' end,
     report_status=case when p_success then 'generated' else 'failed' end,
     certificate_bucket=case when p_success then p_bucket else certificate_bucket end,
     certificate_path=case when p_success then p_path else certificate_path end,
     certificate_sha256=case when p_success then p_sha256 else certificate_sha256 end,
     report_bucket=case when p_success then p_report_bucket else report_bucket end,
     report_path=case when p_success then p_report_path else report_path end,
     report_sha256=case when p_success then p_report_sha256 else report_sha256 end,
     certificate_generated_at=case when p_success then timezone('utc',now()) else certificate_generated_at end,
     report_generated_at=case when p_success then timezone('utc',now()) else report_generated_at end,
     certificate_claim_token=null, certificate_claimed_at=null,
     last_error=case when p_success then null else left(coalesce(p_error,'Error de certificado'),500) end,
     updated_at=timezone('utc',now())
 where id=p_assessment_id and certificate_status='processing' and certificate_claim_token=p_claim_token
 returning id into updated_id;
 if updated_id is null then raise exception 'Claim de certificado inválido'; end if;
 insert into private.psychometric_audit_log(assessment_id,event_type,metadata)
 values(p_assessment_id,case when p_success then 'certificate_and_report_generated' else 'certificate_failed' end,'{}');
end $$;

create or replace function public.get_psycholaboral_report_artifact(p_assessment_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare payload jsonb;
begin
 if auth.uid() is null or not public.user_can_access_psycholaboral(auth.uid()) then raise exception 'Sin permisos para Gestión Psicolaboral'; end if;
 select jsonb_build_object('bucket',a.report_bucket,'path',a.report_path,'sha256',a.report_sha256) into payload
 from private.psychometric_assessments a
 where a.id=p_assessment_id and a.report_status='generated' and a.report_bucket is not null and a.report_path is not null;
 return payload;
end $$;

revoke all on function private.psychometric_response_quality(jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.psychometric_response_quality(jsonb,jsonb) to service_role;
revoke all on function private.psycholaboral_ipc_profile(jsonb) from public,anon,authenticated;
grant execute on function private.psycholaboral_ipc_profile(jsonb) to service_role;
revoke all on function public.complete_psycholaboral_certificate(uuid,uuid,boolean,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_psycholaboral_certificate(uuid,uuid,boolean,text,text,text,text,text,text,text) to service_role;
revoke all on function public.get_psycholaboral_report_artifact(uuid) from public,anon;
grant execute on function public.get_psycholaboral_report_artifact(uuid) to authenticated;
notify pgrst, 'reload schema';
