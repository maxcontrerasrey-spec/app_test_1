-- EEES-DB-005: approved
-- owner: Business Intelligence
-- rollback: forward-only; restaurar la frecuencia anterior con una migración posterior.

begin;

do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'refresh-bi-employee-population-current-cache';

    perform cron.schedule(
      'refresh-bi-employee-population-current-cache',
      '*/10 * * * *',
      'select public.refresh_bi_employee_population_current_cache();'
    );
  end if;
exception
  when undefined_table or invalid_schema_name then
    raise notice 'pg_cron no disponible; se conserva el refresco operativo existente';
end
$schedule$;

commit;
