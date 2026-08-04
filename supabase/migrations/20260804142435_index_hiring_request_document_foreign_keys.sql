begin;

create index if not exists idx_recruitment_hiring_documents_buk_sync_job
  on public.recruitment_hiring_documents (buk_sync_job_id);

create index if not exists idx_recruitment_hiring_documents_candidate_profile
  on public.recruitment_hiring_documents (candidate_profile_id);

create index if not exists idx_recruitment_hiring_documents_generated_by
  on public.recruitment_hiring_documents (generated_by);

create index if not exists idx_recruitment_hiring_documents_recruitment_case
  on public.recruitment_hiring_documents (recruitment_case_id);

create index if not exists idx_recruitment_hiring_documents_replaced_by
  on public.recruitment_hiring_documents (replaced_by_document_id)
  where replaced_by_document_id is not null;

create index if not exists idx_recruitment_hiring_documents_revoked_by
  on public.recruitment_hiring_documents (revoked_by)
  where revoked_by is not null;

create index if not exists idx_recruitment_hiring_documents_validated_by
  on public.recruitment_hiring_documents (validated_by);

create index if not exists idx_recruitment_hiring_document_audit_actor
  on public.recruitment_hiring_document_audit_log (actor_id);

create index if not exists idx_recruitment_hiring_document_audit_job
  on public.recruitment_hiring_document_audit_log (buk_sync_job_id);

commit;
