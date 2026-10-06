-- EEES-DB-005: approved
-- owner: Recruitment / BUK integration
-- rollback: forward-only migration unscheduling buk-candidate-document-queue.
-- The dedicated credential is provisioned separately in Vault and the Edge Function.
-- Production migration version: 20261006132145.
begin;

do $schedule$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_cron and pg_net are required for the BUK document queue';
  end if;

  if not exists (
    select 1 from vault.secrets where name = 'buk_document_queue_cron_secret'
  ) then
    raise exception 'Vault secret buk_document_queue_cron_secret must be provisioned first';
  end if;

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'buk-candidate-document-queue';

  perform cron.schedule(
    'buk-candidate-document-queue',
    '* * * * *',
    $command$
      select net.http_post(
        url := 'https://pzblmbahnoyntrhistea.supabase.co/functions/v1/sync-buk-candidates',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-buk-document-queue-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'buk_document_queue_cron_secret'
          )
        ),
        body := '{"mode":"documents","limit":3}'::jsonb,
        timeout_milliseconds := 55000
      );
    $command$
  );
end
$schedule$;

commit;
