-- EEES-DB-005: approved
-- owner: Product owner request for the external ERP security and scalability audit.
-- rollback: forward-only; correct trigger behavior in a later reviewed migration, and restore only a narrowly justified server-role grant. Do not re-grant client execution to PUBLIC, anon, or authenticated.

begin;

-- Trigger functions are invoked by PostgreSQL through their trigger bindings,
-- not by client RPCs. Remove default/client EXECUTE grants while preserving
-- the trigger itself. Pin the definer path so temporary objects cannot shadow
-- unqualified built-ins.
alter function public.atlas_ops_apply_geofences()
  set search_path = pg_catalog, public, pg_temp;
alter function public.validate_hr_worker_roster_fixed_cycle_start()
  set search_path = pg_catalog, public, pg_temp;
alter function public.hr_roster_assignment_matches_current_buk(text, text, text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.normalize_buk_contract_code(text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.hr_roster_assignment_applies_on_buk_date(
  text, text, timestamp with time zone, date, text, text, date
) set search_path = pg_catalog, public, pg_temp;
alter function public.extract_buk_employee_exit_date(jsonb)
  set search_path = pg_catalog, public, pg_temp;

revoke all on function public.atlas_ops_apply_geofences()
  from public, anon, authenticated, service_role;

-- This validation function is also trigger-only and has no supported direct
-- client call site. Restrict its default execute grant as well.
revoke all on function public.validate_hr_worker_roster_fixed_cycle_start()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
