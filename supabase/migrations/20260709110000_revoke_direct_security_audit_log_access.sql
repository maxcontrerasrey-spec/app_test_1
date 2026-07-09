begin;

revoke select on public.security_audit_logs from authenticated;

notify pgrst, 'reload schema';

commit;
