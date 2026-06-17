begin;

alter table if exists public.buk_sync_jobs
  add column if not exists result_snapshot jsonb not null default '{}'::jsonb;

update public.buk_sync_jobs
   set result_snapshot = payload_snapshot
 where coalesce(result_snapshot, '{}'::jsonb) = '{}'::jsonb
   and coalesce(payload_snapshot, '{}'::jsonb) <> '{}'::jsonb;

comment on column public.buk_sync_jobs.payload_snapshot is
  'Snapshot original del payload operativo enviado a la sincronizacion BUK.';

comment on column public.buk_sync_jobs.result_snapshot is
  'Resultado auditable de la ejecucion BUK: empleado creado, documentos subidos y errores del intento.';

notify pgrst, 'reload schema';

commit;
