-- EEES-DB-005: approved
-- owner: Human Resources / Integrations
-- rollback: forward-only; restore the prior function runtime settings and failure retention behavior in a subsequent audited migration.
begin;

alter function public.finalize_buk_employee_sync(uuid, integer, jsonb)
  set statement_timeout = '120s';

create or replace function public.fail_buk_employee_sync(
  p_sync_run_id uuid,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  update public.buk_employee_sync_runs
     set status = 'failed',
         completed_at = timezone('utc', now()),
         error_message = left(coalesce(nullif(trim(p_error_message), ''), 'Error no especificado'), 1000),
         updated_at = timezone('utc', now())
   where id = p_sync_run_id
     and status = 'running';
end;
$function$;

revoke all on function public.fail_buk_employee_sync(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_buk_employee_sync(uuid, text) to service_role;

notify pgrst, 'reload schema';

commit;
