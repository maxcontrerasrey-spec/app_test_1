begin;

grant usage on schema private to service_role;
grant all on private.password_reset_rate_limits to service_role;
grant execute on function private.claim_password_reset_request(text, text) to service_role;
grant execute on function public.claim_password_reset_request(text, text) to service_role;

notify pgrst, 'reload schema';

commit;
