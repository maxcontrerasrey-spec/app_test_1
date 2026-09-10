-- EEES-DB-005: approved
-- owner: Recruitment and HR Integrations
-- rollback: no restablecer la ficha eliminada 43751; cualquier correccion posterior debe ser forward-only.
begin;

do $$
declare
  target_candidate_id constant uuid := 'a35ed363-d83b-46ef-b460-dd55cc550451';
  target_job_id constant uuid := '47aef5c4-4fbe-492d-8493-db73ac6b4231';
  target_reservation_id constant uuid := '92f759b0-81c9-4a71-94e8-d5a0e37781f0';
  deleted_buk_employee_id constant text := '43751';
  live_buk_employee_id constant text := '44015';
  now_utc timestamptz := timezone('utc', now());
  affected_rows integer;
  reservation_snapshot jsonb;
begin
  if not exists (
    select 1
      from public.recruitment_case_candidates candidate
      join public.candidate_profiles profile
        on profile.id = candidate.candidate_profile_id
      join public.recruitment_cases recruitment_case
        on recruitment_case.id = candidate.recruitment_case_id
     where candidate.id = target_candidate_id
       and regexp_replace(upper(profile.national_id), '[^0-9K]', '', 'g') = '145854407'
       and lower(profile.email) = 'ediazburgos@gmail.com'
       and recruitment_case.case_code = 'RC-0035'
       and recruitment_case.contract_name = 'CODELCO DRT'
       and candidate.stage_code = 'ready_for_hire'
  ) then
    raise exception 'La identidad o el proceso ERP de Eduardo Diaz no coinciden con la conciliacion esperada';
  end if;

  if not exists (
    select 1
      from public.employees employee
     where employee.buk_employee_id = live_buk_employee_id
       and private.normalize_buk_employee_identity(
             coalesce(
               nullif(trim(employee.document_number), ''),
               nullif(trim(employee.raw_payload ->> 'document_number'), ''),
               nullif(trim(employee.raw_payload ->> 'rut'), '')
             )
           ) = '145854407'
       and lower(coalesce(employee.email, employee.raw_payload ->> 'email', '')) = 'ediazburgos@gmail.com'
       and upper(trim(employee.raw_payload ->> 'code_sheet')) = 'F1'
       and employee.is_active is true
  ) then
    raise exception 'La ficha BUK viva 44015 no coincide con la identidad F1 verificada';
  end if;

  if exists (
    select 1
      from public.employees employee
     where employee.buk_employee_id = deleted_buk_employee_id
  ) then
    raise exception 'La ficha BUK 43751 aun aparece en el espejo vivo; se cancela la conciliacion';
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
    raise exception 'Eduardo Diaz ya tiene una generacion BUK efectiva; se cancela el reintento';
  end if;

  update private.buk_employee_code_reservations reservation
     set buk_employee_id = live_buk_employee_id,
         source = 'buk_live_txt_reconciliation',
         evidence = coalesce(reservation.evidence, '{}'::jsonb)
           || jsonb_build_object(
             'reconciled_at', now_utc,
             'reason', 'La ficha 43751 fue eliminada y BUK contiene la ficha F1 44015 creada por carga TXT para la misma identidad',
             'superseded_buk_employee_id', deleted_buk_employee_id,
             'buk_employee_id', live_buk_employee_id,
             'verified_employee_code', 'F1',
             'verified_document_number', '145854407',
             'verified_contract', 'CODELCO DRT'
           ),
         confirmed_at = now_utc,
         updated_at = now_utc
   where reservation.id = target_reservation_id
     and reservation.recruitment_case_candidate_id = target_candidate_id
     and reservation.identity_key = '145854407'
     and reservation.employee_code = 'F1'
     and reservation.status = 'confirmed'
     and reservation.buk_employee_id = deleted_buk_employee_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'La reserva BUK de Eduardo Diaz no cumple las guardas para reconciliar 43751 con 44015';
  end if;

  select jsonb_build_object(
           'reservation_id', reservation.id,
           'employee_code', reservation.employee_code,
           'status', reservation.status,
           'buk_employee_id', reservation.buk_employee_id,
           'predecessor_buk_employee_id', reservation.predecessor_buk_employee_id,
           'predecessor_employee_code', reservation.predecessor_employee_code,
           'created_at', reservation.created_at
         )
    into reservation_snapshot
    from private.buk_employee_code_reservations reservation
   where reservation.id = target_reservation_id;

  update public.buk_sync_jobs job
     set status = 'pending',
         buk_employee_id = null,
         error_message = null,
         started_at = null,
         finished_at = null,
         payload_snapshot = jsonb_set(
           coalesce(job.payload_snapshot, '{}'::jsonb),
           '{employee_code_reservation}',
           reservation_snapshot,
           true
         ),
         result_snapshot = coalesce(job.result_snapshot, '{}'::jsonb)
           || jsonb_build_object(
             'liveBukReconciliation', jsonb_build_object(
               'reconciledAt', now_utc,
               'source', '20260910135111_reconcile_eduardo_diaz_buk_txt_ficha',
               'supersededBukEmployeeId', deleted_buk_employee_id,
               'bukEmployeeId', live_buk_employee_id,
               'employeeCode', 'F1',
               'reason', 'Ficha original eliminada; se continua sobre la ficha viva creada por TXT'
             )
           ),
         updated_at = now_utc
   where job.id = target_job_id
     and job.recruitment_case_candidate_id = target_candidate_id
     and job.status = 'error'
     and job.error_message = 'La reserva de ficha ya confirmada no coincide con la consulta BUK viva; el job requiere conciliación.'
     and job.payload_snapshot -> 'employee_code_reservation' ->> 'buk_employee_id' = deleted_buk_employee_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'El ultimo job BUK de Eduardo Diaz no cumple las guardas para un reintento seguro';
  end if;
end;
$$;

commit;
