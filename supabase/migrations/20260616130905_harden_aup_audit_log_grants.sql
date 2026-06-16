begin;

revoke insert, update, delete on public.security_audit_logs from public, anon, authenticated;
grant select on public.security_audit_logs to authenticated;

notify pgrst, 'reload schema';

commit;
