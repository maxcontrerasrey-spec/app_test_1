begin;

do $$
declare
  v_source_case_id constant uuid := '02df3e8f-ebc9-4452-b3bb-fd0dc2af7606';
  v_target_case_id constant uuid := 'a44c419d-5188-4e22-8f27-f1aaf87c1394';
  v_case_candidate_id constant uuid := 'd0bb9f69-2b4f-4163-b151-786fd69f5055';
  v_candidate_profile_id constant uuid := '007585af-0a64-4dae-977d-4c63c89b8232';
  v_buk_job_id constant uuid := 'c8f135db-594f-41a2-b0a4-82a316907a2b';
  actor_user_id uuid;
  source_case public.recruitment_cases%rowtype;
  target_case public.recruitment_cases%rowtype;
  candidate_record public.recruitment_case_candidates%rowtype;
  profile_record public.candidate_profiles%rowtype;
  document_conflicts integer := 0;
begin
  select *
    into source_case
    from public.recruitment_cases
   where id = v_source_case_id
   for update;

  select *
    into target_case
    from public.recruitment_cases
   where id = v_target_case_id
   for update;

  select *
    into candidate_record
    from public.recruitment_case_candidates
   where id = v_case_candidate_id
   for update;

  select *
    into profile_record
    from public.candidate_profiles
   where id = v_candidate_profile_id;

  if source_case.id is null or source_case.case_code <> 'RC-1749' then
    raise exception 'Guard failed: source case RC-1749 not found';
  end if;

  if target_case.id is null or target_case.case_code <> 'RC-0082' then
    raise exception 'Guard failed: target case RC-0082 not found';
  end if;

  if candidate_record.id is null
     or candidate_record.recruitment_case_id <> v_source_case_id
     or candidate_record.candidate_profile_id <> v_candidate_profile_id
     or candidate_record.stage_code <> 'hired' then
    raise exception 'Guard failed: Domingo case candidate is not in expected hired state on RC-1749';
  end if;

  if profile_record.id is null
     or profile_record.national_id <> '101290980'
     or lower(profile_record.full_name) <> lower('Domingo Enrique Catalán Vega') then
    raise exception 'Guard failed: Domingo profile identity mismatch';
  end if;

  if not exists (
    select 1
      from public.hiring_requests hr
     where hr.id = source_case.hiring_request_id
       and hr.folio = '1749'
  ) then
    raise exception 'Guard failed: source hiring request folio 1749 mismatch';
  end if;

  if not exists (
    select 1
      from public.hiring_requests hr
     where hr.id = target_case.hiring_request_id
       and hr.folio = '0082'
       and hr.start_date = date '2026-07-20'
       and hr.end_date = date '2026-10-20'
       and hr.shift_name = '10X5+5'
  ) then
    raise exception 'Guard failed: target hiring request folio 0082 operational data mismatch';
  end if;

  if exists (
    select 1
      from public.recruitment_case_candidates rcc
     where rcc.recruitment_case_id = v_target_case_id
       and rcc.candidate_profile_id = v_candidate_profile_id
       and rcc.id <> v_case_candidate_id
  ) then
    raise exception 'Guard failed: Domingo is already linked to RC-0082 through another row';
  end if;

  if not exists (
    select 1
      from public.buk_sync_jobs bsj
     where bsj.id = v_buk_job_id
       and bsj.recruitment_case_candidate_id = v_case_candidate_id
       and bsj.status = 'success'
       and bsj.buk_employee_id = '41937'
  ) then
    raise exception 'Guard failed: successful BUK job 41937 not found for Domingo';
  end if;

  select count(*)
    into document_conflicts
    from public.candidate_documents cd_src
   where cd_src.recruitment_case_id = v_source_case_id
     and cd_src.candidate_profile_id = v_candidate_profile_id
     and exists (
       select 1
         from public.candidate_documents cd_dst
        where cd_dst.recruitment_case_id = v_target_case_id
          and cd_dst.candidate_profile_id = v_candidate_profile_id
          and cd_dst.document_type_id = cd_src.document_type_id
     );

  if document_conflicts > 0 then
    raise exception 'Guard failed: % document conflict(s) on RC-0082', document_conflicts;
  end if;

  select bsj.requested_by
    into actor_user_id
    from public.buk_sync_jobs bsj
   where bsj.id = v_buk_job_id;

  update public.candidate_documents
     set recruitment_case_id = v_target_case_id,
         updated_at = timezone('utc', now())
   where recruitment_case_id = v_source_case_id
     and candidate_profile_id = v_candidate_profile_id;

  update public.recruitment_case_candidates
     set recruitment_case_id = v_target_case_id,
         updated_at = timezone('utc', now())
   where id = v_case_candidate_id;

  update public.candidate_worker_files
     set project_name = 'CODELCO DRT',
         company_entry_date = date '2026-07-20',
         shift_name = '10X5+5',
         updated_at = timezone('utc', now())
   where recruitment_case_candidate_id = v_case_candidate_id;

  update public.buk_sync_jobs
     set result_snapshot = jsonb_set(
           jsonb_set(
             jsonb_set(
               coalesce(result_snapshot, '{}'::jsonb),
               '{erpRepair}',
               jsonb_build_object(
                 'reason', 'correct_wrong_hiring_folio',
                 'source_case_id', v_source_case_id,
                 'source_case_code', 'RC-1749',
                 'target_case_id', v_target_case_id,
                 'target_case_code', 'RC-0082',
                 'target_folio', '0082',
                 'buk_employee_id', '41937',
                 'buk_job_id', 142263,
                 'buk_job_patched_at', timezone('utc', now()),
                 'buk_job_patch', jsonb_build_object(
                   'start_date', '2026-07-20',
                   'end_of_contract', '2026-10-20',
                   'contract_subscription_date', '2026-07-20',
                   'wage', 0
                 )
               ),
               true
             ),
             '{job,request,start_date}',
             to_jsonb('2026-07-20'::text),
             true
           ),
           '{job,request,end_of_contract}',
           to_jsonb('2026-10-20'::text),
           true
         ),
         updated_at = timezone('utc', now())
   where id = v_buk_job_id;

  update public.buk_sync_jobs
     set result_snapshot = jsonb_set(
           result_snapshot,
           '{job,request,contract_subscription_date}',
           to_jsonb('2026-07-20'::text),
           true
         ),
         updated_at = timezone('utc', now())
   where id = v_buk_job_id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  ) values (
    v_source_case_id,
    v_case_candidate_id,
    actor_user_id,
    'candidate_transferred_out',
    jsonb_build_object(
      'reason', 'correct_wrong_hiring_folio',
      'target_case_id', v_target_case_id,
      'target_case_code', 'RC-0082',
      'target_folio', '0082',
      'buk_employee_id', '41937',
      'buk_job_id', 142263,
      'comment', 'Domingo Enrique Catalán Vega fue contratado por error en folio 1749; se traslada al folio correcto 0082 y se corrige job BUK.'
    )
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  ) values (
    v_target_case_id,
    v_case_candidate_id,
    actor_user_id,
    'candidate_transferred_in',
    jsonb_build_object(
      'reason', 'correct_wrong_hiring_folio',
      'source_case_id', v_source_case_id,
      'source_case_code', 'RC-1749',
      'source_folio', '1749',
      'buk_employee_id', '41937',
      'buk_job_id', 142263,
      'worker_file_patch', jsonb_build_object(
        'company_entry_date', '2026-07-20',
        'shift_name', '10X5+5'
      ),
      'comment', 'Domingo Enrique Catalán Vega queda asociado al folio correcto 0082.'
    )
  );

  perform public.sync_recruitment_case_status(v_source_case_id, actor_user_id);
  perform public.sync_recruitment_case_status(v_target_case_id, actor_user_id);
end $$;

commit;
