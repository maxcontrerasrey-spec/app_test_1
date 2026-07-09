begin;

with legacy_html_errors as (
  select
    id,
    coalesce(
      nullif(
        trim(
          substring(
            error_message from '(?i)Buk API\s+([0-9]{3}\s+[A-Za-z][A-Za-z ]{2,40}):'
          )
        ),
        ''
      ),
      '500 Internal Server Error'
    ) as status_label
  from public.buk_sync_jobs
  where error_message ~* '<!doctype html|<html|</html>'
), sanitized as (
  select
    id,
    format(
      'BUK no pudo procesar la solicitud (%s). El proveedor devolvió una respuesta interna no legible; revisa el job de sincronización y reintenta.',
      status_label
    ) as safe_message
  from legacy_html_errors
)
update public.buk_sync_jobs as job
set
  error_message = sanitized.safe_message,
  result_snapshot = jsonb_set(
    coalesce(job.result_snapshot, '{}'::jsonb)
      || jsonb_build_object(
        'errorAudit',
        coalesce(job.result_snapshot -> 'errorAudit', '{}'::jsonb)
          || jsonb_build_object(
            'provider',
            'buk',
            'responseKind',
            'legacy_html_sanitized',
            'sanitizedAt',
            now()
          )
      ),
    '{error}',
    to_jsonb(sanitized.safe_message),
    true
  )
from sanitized
where job.id = sanitized.id;

notify pgrst, 'reload schema';

commit;
