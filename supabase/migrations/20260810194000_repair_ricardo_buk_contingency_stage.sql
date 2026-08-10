begin;

do $function$
declare
  target_candidate public.recruitment_case_candidates%rowtype;
  target_job public.buk_sync_jobs%rowtype;
  original_stage_at timestamptz;
begin
  select rcc.* into target_candidate
    from public.recruitment_case_candidates rcc
    join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
   where cp.national_id = '172958265'
     and rcc.stage_code = 'hired'
     and exists (
       select 1 from public.buk_sync_jobs bsj
        where bsj.recruitment_case_candidate_id = rcc.id
          and bsj.status = 'success'
          and bsj.payload_snapshot ? 'contingency'
     )
   order by rcc.updated_at desc
   limit 1
   for update;

  if target_candidate.id is null then
    return;
  end if;

  select bsj.* into target_job
    from public.buk_sync_jobs bsj
   where bsj.recruitment_case_candidate_id = target_candidate.id
     and bsj.status = 'success'
     and bsj.payload_snapshot ? 'contingency'
   order by bsj.finished_at desc nulls last, bsj.created_at desc
   limit 1;

  select h.created_at into original_stage_at
    from public.recruitment_case_candidate_stage_history h
   where h.recruitment_case_candidate_id = target_candidate.id
     and h.to_stage = 'lead'
   order by h.created_at asc
   limit 1;

  update public.recruitment_case_candidates
     set stage_code = 'lead',
         stage_entered_at = coalesce(original_stage_at, target_candidate.created_at),
         hired_at = null,
         updated_at = timezone('utc', now())
   where id = target_candidate.id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id, from_stage, to_stage, changed_by, reason_code, comment
  ) values (
    target_candidate.id, 'hired', 'lead', target_job.requested_by, 'buk_contingency_stage_repair',
    'Se revierte la promoción automática: la carga BUK contingente no equivale a contratación ERP.'
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id, recruitment_case_candidate_id, actor_user_id, action_type, old_values, new_values, metadata
  ) values (
    target_candidate.recruitment_case_id, target_candidate.id, target_job.requested_by, 'candidate_stage_changed',
    jsonb_build_object('stage_code', 'hired', 'hired_at', target_candidate.hired_at),
    jsonb_build_object('stage_code', 'lead', 'hired_at', null),
    jsonb_build_object('source', 'repair_ricardo_buk_contingency_stage', 'buk_sync_job_id', target_job.id, 'buk_employee_id', target_job.buk_employee_id)
  );

  perform public.sync_recruitment_case_status(target_candidate.recruitment_case_id, target_job.requested_by);
end;
$function$;

notify pgrst, 'reload schema';
commit;
