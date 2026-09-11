-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; the provider error remains preserved in result_snapshot.

begin;

update public.buk_sync_jobs
set result_snapshot = coalesce(result_snapshot, '{}'::jsonb) || jsonb_build_object(
      'bankAccountValidation',
      jsonb_build_object(
        'normalizedAt', timezone('utc', now()),
        'source', '20260911114500_normalize_legacy_buk_blank_account_errors',
        'providerError', error_message
      )
    ),
    error_message = 'La ficha BUK está incompleta: para Transferencia Bancaria debes completar banco, tipo de cuenta y número de cuenta antes de reintentar.',
    updated_at = timezone('utc', now())
where status = 'error'
  and lower(coalesce(error_message, '')) like '%account_number%'
  and (
    lower(coalesce(error_message, '')) like '%no puede estar en blanco%'
    or lower(coalesce(error_message, '')) like '%can''t be blank%'
  );

commit;
