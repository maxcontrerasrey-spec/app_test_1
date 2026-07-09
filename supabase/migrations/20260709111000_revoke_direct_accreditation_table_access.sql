begin;

revoke select on public.accreditation_sites from authenticated;
revoke select on public.accreditation_requirements from authenticated;
revoke select on public.accreditation_matrix from authenticated;
revoke select on public.worker_accreditations from authenticated;
revoke select on public.worker_document_tracking from authenticated;
revoke select on public.accreditation_audit_log from authenticated;

notify pgrst, 'reload schema';

commit;
