-- EEES-DB-005: approved
-- owner: Recruitment and HR Integrations
-- rollback: no revertir el reintento; corregir cualquier resultado mediante una migracion forward-only.
begin;

do $$
declare
  target_job_id constant uuid := 'afc09041-7b29-41bb-89d9-313036d4912b';
  target_candidate_id constant uuid := '760c44fd-11de-4b24-8154-60456ee493a6';
  expected_error constant text := 'El trabajador ya existe en BUK (ID 14748, estado inactive) y no fue posible resolver la ficha automáticamente.';
begin
  if not exists (
    select 1
      from private.buk_employee_code_reservations reservation
     where reservation.recruitment_case_candidate_id = target_candidate_id
       and reservation.identity_key = '11692837K'
       and reservation.employee_code = 'F3'
       and reservation.status = 'reserved'
       and reservation.buk_employee_id is null
       and reservation.predecessor_buk_employee_id = '14748'
       and reservation.predecessor_employee_code = 'F2'
  ) then
    raise exception 'La reserva BUK de Jaime Harris no coincide con F3/F2; se cancela el reintento';
  end if;

  if exists (
    select 1
      from public.buk_sync_jobs successful_job
     where successful_job.recruitment_case_candidate_id = target_candidate_id
       and public.is_effective_buk_generation_success(
         successful_job.status,
         successful_job.buk_employee_id,
         successful_job.result_snapshot
       )
  ) then
    raise exception 'Jaime Harris ya tiene una generacion BUK efectiva; se cancela el reintento';
  end if;

  update public.buk_sync_jobs job
     set status = 'pending',
         error_message = null,
         started_at = null,
         finished_at = null,
         result_snapshot = coalesce(job.result_snapshot, '{}'::jsonb)
           || jsonb_build_object(
             'manualRetry', jsonb_build_object(
               'reason', 'Reingreso BUK robusto con correlativo historico F3',
               'requeuedAt', timezone('utc', now()),
               'source', '20260825142500_requeue_jaime_harris_buk_reentry'
             )
           ),
         updated_at = timezone('utc', now())
   where job.id = target_job_id
     and job.recruitment_case_candidate_id = target_candidate_id
     and job.status = 'error'
     and job.buk_employee_id is null
     and job.error_message = expected_error
     and job.payload_snapshot -> 'profile' ->> 'document_number' = '11692837K'
     and job.payload_snapshot -> 'profile' -> 'worker_file' ->> 'employee_code' = 'F3';

  if not found then
    raise exception 'El job de Jaime Harris no cumple las guardas para un reintento seguro';
  end if;
end;
$$;

commit;
