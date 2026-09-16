-- EEES-DB-005: approved
-- owner: Human Resources / Integrations
-- rollback: forward-only; reduce the function-local timeout in a subsequent audited migration after measuring a representative production run.
begin;

alter function public.finalize_buk_employee_sync(uuid, integer, jsonb)
  set statement_timeout = '300s';

commit;
