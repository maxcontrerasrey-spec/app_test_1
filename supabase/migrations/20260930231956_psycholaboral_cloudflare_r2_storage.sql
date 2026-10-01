-- EEES-DB-005: approved
-- owner: Psycholaboral and HR Integrations
-- rollback: forward-only; provider defaults preserve all existing Supabase references.
begin;

alter table private.psychometric_assessments
  add column if not exists certificate_storage_provider text not null default 'supabase_storage'
    check (certificate_storage_provider in ('supabase_storage', 'cloudflare_r2')),
  add column if not exists report_storage_provider text not null default 'supabase_storage'
    check (report_storage_provider in ('supabase_storage', 'cloudflare_r2'));

create or replace function public.complete_psycholaboral_certificate(
  p_assessment_id uuid, p_claim_token uuid, p_success boolean,
  p_bucket text default null, p_path text default null, p_sha256 text default null,
  p_error text default null, p_report_bucket text default null,
  p_report_path text default null, p_report_sha256 text default null
) returns void language plpgsql security definer set search_path='' as $$
declare updated_id uuid;
begin
 update private.psychometric_assessments
 set certificate_status=case when p_success then 'generated' else 'failed' end,
     report_status=case when p_success then 'generated' else 'failed' end,
     certificate_bucket=case when p_success then p_bucket else certificate_bucket end,
     certificate_path=case when p_success then p_path else certificate_path end,
     certificate_sha256=case when p_success then p_sha256 else certificate_sha256 end,
     certificate_storage_provider=case when p_success and p_bucket='cloudflare_r2' then 'cloudflare_r2' when p_success then 'supabase_storage' else certificate_storage_provider end,
     report_bucket=case when p_success then p_report_bucket else report_bucket end,
     report_path=case when p_success then p_report_path else report_path end,
     report_sha256=case when p_success then p_report_sha256 else report_sha256 end,
     report_storage_provider=case when p_success and p_report_bucket='cloudflare_r2' then 'cloudflare_r2' when p_success then 'supabase_storage' else report_storage_provider end,
     certificate_generated_at=case when p_success then timezone('utc',now()) else certificate_generated_at end,
     report_generated_at=case when p_success then timezone('utc',now()) else report_generated_at end,
     certificate_claim_token=null, certificate_claimed_at=null,
     last_error=case when p_success then null else left(coalesce(p_error,'Error de certificado'),500) end,
     updated_at=timezone('utc',now())
 where id=p_assessment_id and certificate_status='processing' and certificate_claim_token=p_claim_token
 returning id into updated_id;
 if updated_id is null then raise exception 'Claim de certificado inválido'; end if;
 insert into private.psychometric_audit_log(assessment_id,event_type,metadata)
 values(p_assessment_id,case when p_success then 'certificate_and_report_generated' else 'certificate_failed' end,
   case when p_success then jsonb_build_object('certificate_storage_provider',case when p_bucket='cloudflare_r2' then 'cloudflare_r2' else 'supabase_storage' end,'report_storage_provider',case when p_report_bucket='cloudflare_r2' then 'cloudflare_r2' else 'supabase_storage' end) else '{}'::jsonb end);
end $$;

create or replace function public.get_psycholaboral_certificate_artifact(p_assessment_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); payload jsonb;
begin
 if uid is null or not public.user_can_access_psycholaboral(uid) then raise exception 'Sin permisos para Gestión Psicolaboral'; end if;
 select jsonb_build_object('bucket',a.certificate_bucket,'path',a.certificate_path,'sha256',a.certificate_sha256,'storage_provider',a.certificate_storage_provider)
 into payload from private.psychometric_assessments a
 where a.id=p_assessment_id and a.certificate_status='generated' and a.certificate_bucket is not null and a.certificate_path is not null;
 if payload is null then raise exception 'El certificado todavía no está disponible'; end if;
 return payload;
end $$;

create or replace function public.get_psycholaboral_report_artifact(p_assessment_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare payload jsonb;
begin
 if auth.uid() is null or not public.user_can_access_psycholaboral(auth.uid()) then raise exception 'Sin permisos para Gestión Psicolaboral'; end if;
 select jsonb_build_object('bucket',a.report_bucket,'path',a.report_path,'sha256',a.report_sha256,'storage_provider',a.report_storage_provider) into payload
 from private.psychometric_assessments a
 where a.id=p_assessment_id and a.report_status='generated' and a.report_bucket is not null and a.report_path is not null;
 return payload;
end $$;

revoke all on function public.complete_psycholaboral_certificate(uuid,uuid,boolean,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_psycholaboral_certificate(uuid,uuid,boolean,text,text,text,text,text,text,text) to service_role;
revoke all on function public.get_psycholaboral_certificate_artifact(uuid) from public,anon;
grant execute on function public.get_psycholaboral_certificate_artifact(uuid) to authenticated;
revoke all on function public.get_psycholaboral_report_artifact(uuid) from public,anon;
grant execute on function public.get_psycholaboral_report_artifact(uuid) to authenticated;

-- Preserve queue history but make psychological reports terminally excluded from BUK.
alter table public.buk_candidate_document_jobs drop constraint if exists buk_candidate_document_jobs_status_check;
alter table public.buk_candidate_document_jobs add constraint buk_candidate_document_jobs_status_check
  check (status in ('pending','processing','success','failed','reconciliation_required','excluded'));
update public.buk_candidate_document_jobs
   set status='excluded', last_error='Documento psicolaboral excluido de BUK por política de almacenamiento R2.',
       next_attempt_at=null, finished_at=timezone('utc',now())
 where lower(source_document_name) like '%psicolaboral%'
   and status in ('pending','failed','reconciliation_required');

create or replace function public.guard_buk_psycholaboral_document_job()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if lower(coalesce(new.source_document_name,'')) like '%psicolaboral%' then
    new.status := 'excluded';
    new.last_error := 'Documento psicolaboral excluido de BUK por política de almacenamiento R2.';
    new.next_attempt_at := null;
    new.finished_at := timezone('utc',now());
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_buk_psycholaboral_document_job on public.buk_candidate_document_jobs;
create trigger trg_guard_buk_psycholaboral_document_job
before insert or update of source_document_name on public.buk_candidate_document_jobs
for each row execute function public.guard_buk_psycholaboral_document_job();
revoke all on function public.guard_buk_psycholaboral_document_job() from public,anon,authenticated;

revoke all on table public.buk_candidate_document_jobs from public,anon,authenticated;
grant select,insert,update on table public.buk_candidate_document_jobs to service_role;
notify pgrst,'reload schema';
commit;
