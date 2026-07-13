begin;

create or replace function public.reconcile_effective_buk_sync_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  candidate_record record;
  transition_at timestamptz;
begin
  if not public.is_effective_buk_generation_success(
    new.status,
    new.buk_employee_id,
    coalesce(new.result_snapshot, '{}'::jsonb)
  ) then
    return new;
  end if;

  select
    rcc.id,
    rcc.recruitment_case_id,
    rcc.stage_code
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = new.recruitment_case_candidate_id
   for update;

  if candidate_record.id is null then
    return new;
  end if;

  transition_at := coalesce(new.finished_at, new.started_at, new.created_at, now());

  if candidate_record.stage_code is distinct from 'hired' then
    update public.recruitment_case_candidates
       set stage_code = 'hired',
           hired_at = coalesce(hired_at, transition_at),
           stage_entered_at = transition_at,
           updated_at = now()
     where id = candidate_record.id;

    insert into public.recruitment_case_candidate_stage_history (
      recruitment_case_candidate_id,
      from_stage,
      to_stage,
      changed_by,
      comment
    )
    values (
      candidate_record.id,
      candidate_record.stage_code,
      'hired',
      new.requested_by,
      format(
        'Reconciliacion automatica por generacion efectiva en BUK. source=reconcile_effective_buk_sync_job buk_sync_job_id=%s buk_employee_id=%s',
        new.id,
        new.buk_employee_id
      )
    );

    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      recruitment_case_candidate_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      candidate_record.recruitment_case_id,
      candidate_record.id,
      new.requested_by,
      'candidate_hired',
      jsonb_build_object('stage_code', candidate_record.stage_code),
      jsonb_build_object('stage_code', 'hired', 'hired_at', transition_at),
      jsonb_build_object(
        'source', 'reconcile_effective_buk_sync_job',
        'buk_sync_job_id', new.id,
        'buk_employee_id', new.buk_employee_id,
        'comment', 'Candidato marcado contratado por generacion efectiva en BUK.'
      )
    );
  end if;

  perform public.sync_recruitment_case_status(candidate_record.recruitment_case_id, new.requested_by);

  return new;
end;
$function$;

revoke all on function public.reconcile_effective_buk_sync_job() from public, anon, authenticated;

drop trigger if exists trg_reconcile_effective_buk_sync_job on public.buk_sync_jobs;
create trigger trg_reconcile_effective_buk_sync_job
after insert or update of status, buk_employee_id, result_snapshot, finished_at
on public.buk_sync_jobs
for each row
execute function public.reconcile_effective_buk_sync_job();

commit;
