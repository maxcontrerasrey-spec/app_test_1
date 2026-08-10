begin;

alter table public.recruitment_case_audit_log
  drop constraint if exists recruitment_case_audit_log_action_type_check;

alter table public.recruitment_case_audit_log
  add constraint recruitment_case_audit_log_action_type_check
  check (action_type = any (array[
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
    'candidate_documents_purged',
    'candidate_public_buk_worker_file_updated'
  ]));

commit;
