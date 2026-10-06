-- EEES-DB-005: approved
-- owner: Product owner explicitly requested retirement of the public precandidate program.
-- rollback: row deletion and dropped objects are irreversible through this migration. If an unintended dependency is found, stop rollout and use a verified pre-deployment PITR backup under the recovery runbook; do not recreate public access or restore candidate rows selectively.

begin;

-- Never discard the only candidate created from an approved application.
-- All approved records must already point to the matching, retained candidate.
do $$
declare
  orphaned_approved_count bigint;
begin
  select count(*)
    into orphaned_approved_count
    from public.recruitment_precandidates rp
    left join public.recruitment_case_candidates rcc
      on rcc.id = rp.approved_case_candidate_id
     and rcc.recruitment_case_id = rp.approved_recruitment_case_id
    where rp.status = 'approved'
      and (
        rp.approved_case_candidate_id is null
        or rp.approved_recruitment_case_id is null
        or rcc.id is null
        or rcc.candidate_profile_id is null
      );

  if orphaned_approved_count > 0 then
    raise exception
      'Retirement stopped: % approved precandidate records are not linked to a retained recruitment candidate',
      orphaned_approved_count;
  end if;
end
$$;

-- Remove callable entry points before removing their backing tables. This
-- immediately closes both anonymous forms and the authenticated review tab.
drop function if exists public.approve_recruitment_precandidate(uuid, uuid, text);
drop function if exists public.reject_recruitment_precandidate(uuid, text);
drop function if exists public.get_recruitment_precandidates_page(text, text, integer, integer);
drop function if exists public.submit_dsal_precandidate_application(
  text, text, text, text, text, text, text, text[], text, text, text, text
);
drop function if exists public.get_dsal_roster_identity(text);
drop function if exists public.start_public_dsal_buk_worker_file(text, text);
drop function if exists public.submit_public_dsal_buk_worker_file(text, jsonb);

-- These tables contain only the retired intake, public form sessions, and
-- imported DSAL roster/judicial lookup dataset. Candidate profiles, worker
-- files, documents, recruitment cases, and candidate audit history remain.
-- Deliberately omit CASCADE so any undiscovered dependency aborts the release.
drop table if exists public.recruitment_public_buk_form_sessions;
drop table if exists public.recruitment_precandidates;
drop table if exists public.recruitment_dsal_judicial_causes;
drop table if exists public.recruitment_dsal_judicial_summary;
drop table if exists public.recruitment_dsal_roster;

drop function if exists public.assert_dsal_precandidate_case_capacity(uuid);
drop function if exists public.assert_dsal_precandidate_review_access(uuid);
drop function if exists public.assert_dsal_precandidate_view_access(uuid);
drop function if exists public.user_can_review_dsal_precandidates(uuid);
drop function if exists public.user_can_view_dsal_precandidates(uuid);
drop function if exists public.is_valid_dsal_precandidate_email(text);
drop function if exists public.is_valid_dsal_precandidate_role(text);
drop function if exists public.is_valid_dsal_precandidate_rut(text);
drop function if exists public.normalize_dsal_precandidate_name(text);
drop function if exists public.normalize_dsal_precandidate_phone(text);
drop function if exists public.normalize_dsal_precandidate_rut(text);
drop function if exists public.normalize_dsal_precandidate_text(text);

notify pgrst, 'reload schema';

commit;
