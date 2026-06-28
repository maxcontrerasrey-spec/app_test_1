begin;

do $$ begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'recruitment_case_audit_log_action_type_check'
      and conrelid = 'public.recruitment_case_audit_log'::regclass
  ) then
    alter table public.recruitment_case_audit_log
      drop constraint recruitment_case_audit_log_action_type_check;
  end if;

  alter table public.recruitment_case_audit_log
    add constraint recruitment_case_audit_log_action_type_check
    check (
      action_type in (
        'case_opened',
        'owner_assigned',
        'candidate_added',
        'candidate_stage_changed',
        'candidate_hired',
        'case_status_synced',
        'candidate_interview_notes_updated',
        'candidate_stage_approval_requested',
        'candidate_stage_approval_pending',
        'candidate_stage_approval_approved',
        'candidate_stage_approval_rejected',
        'candidate_person_profile_updated',
        'candidate_worker_file_created',
        'candidate_worker_file_updated',
        'candidate_worker_file_cleared',
        'document_uploaded',
        'document_reviewed',
        'candidate_transferred_out',
        'candidate_transferred_in',
        'candidate_document_validation_reset',
        'candidate_documentation_approved',
        'candidate_documents_purged'
      )
    );
end $$;

notify pgrst, 'reload schema';

commit;
