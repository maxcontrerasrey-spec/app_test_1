begin;

create or replace function public.sync_recruitment_case_status(
  p_case_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  case_record public.recruitment_cases%rowtype;
  request_record public.hiring_requests%rowtype;
  case_metrics record;
  next_status text;
  next_filled_vacancies integer;
  has_rejected_internal_mobility boolean := false;
  should_reopen_request boolean := false;
  now_utc timestamptz := timezone('utc', now());
begin
  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = p_case_id
   for update;

  if case_record.id is null then
    raise exception 'No existe el caso de reclutamiento';
  end if;

  if case_record.hiring_request_id is not null then
    select *
      into request_record
      from public.hiring_requests hr
     where hr.id = case_record.hiring_request_id
     for update;
  end if;

  select *
    into case_metrics
    from public.get_recruitment_case_effective_metrics(p_case_id)
    limit 1;

  select exists (
    select 1
      from public.internal_mobility_requests imr
     where imr.recruitment_case_id = p_case_id
       and imr.status = 'rejected'
  )
  into has_rejected_internal_mobility;

  next_filled_vacancies := coalesce(case_metrics.effective_filled_vacancies, 0);
  should_reopen_request :=
    request_record.id is not null
    and request_record.status = 'closed'
    and has_rejected_internal_mobility
    and coalesce(case_metrics.available_vacancies, 0) > 0
    and (
      case_record.status = 'cancelled'
      or case_record.close_reason is not null
      or case_record.closed_at is not null
    );

  next_status :=
    case
      when not should_reopen_request
        and case_record.close_reason is not null
        and case_record.closed_at is not null
        then case_record.status
      when next_filled_vacancies >= case_record.requested_vacancies then 'filled'
      when next_filled_vacancies > 0 then 'partially_filled'
      when coalesce(case_metrics.ready_candidate_count, 0) > 0 then 'ready_to_hire'
      when coalesce(case_metrics.effective_active_candidates, 0) > 0 then 'screening'
      else 'open'
    end;

  if should_reopen_request then
    update public.hiring_requests hr
       set status = 'approved',
           current_step_code = null,
           rejected_at = null,
           final_decided_by = null,
           updated_at = now_utc
     where hr.id = request_record.id;

    insert into public.hiring_request_audit_log (
      hiring_request_id,
      actor_user_id,
      action_type,
      metadata
    )
    values (
      request_record.id,
      coalesce(p_actor_user_id, case_record.opened_by),
      'approved',
      jsonb_build_object(
        'action', 'auto_reopened_due_to_rejected_internal_mobility',
        'previous_status', request_record.status,
        'status_changed_to', 'approved',
        'recruitment_case_id', case_record.id,
        'available_vacancies', coalesce(case_metrics.available_vacancies, 0),
        'effective_filled_vacancies', next_filled_vacancies
      )
    );
  end if;

  update public.recruitment_cases rc
     set filled_vacancies = next_filled_vacancies,
         status = next_status,
         close_reason = case when should_reopen_request then null else rc.close_reason end,
         closed_at = case when should_reopen_request then null else rc.closed_at end,
         closed_by = case when should_reopen_request then null else rc.closed_by end,
         target_close_date = case when should_reopen_request then null else rc.target_close_date end,
         updated_at = now_utc
   where rc.id = p_case_id;

  if case_record.status is distinct from next_status
     or case_record.filled_vacancies is distinct from next_filled_vacancies
     or should_reopen_request then
    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      p_case_id,
      coalesce(p_actor_user_id, case_record.opened_by),
      'case_status_synced',
      jsonb_build_object(
        'status', case_record.status,
        'filled_vacancies', case_record.filled_vacancies,
        'close_reason', case_record.close_reason,
        'closed_at', case_record.closed_at,
        'closed_by', case_record.closed_by,
        'hiring_request_status', request_record.status
      ),
      jsonb_build_object(
        'status', next_status,
        'filled_vacancies', next_filled_vacancies,
        'close_reason', case when should_reopen_request then null else case_record.close_reason end,
        'closed_at', case when should_reopen_request then null else case_record.closed_at end,
        'closed_by', case when should_reopen_request then null else case_record.closed_by end,
        'hiring_request_status', case when should_reopen_request then 'approved' else request_record.status end
      ),
      jsonb_build_object(
        'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
        'active_candidates', coalesce(case_metrics.active_candidate_count, 0),
        'pending_mobility_count', coalesce(case_metrics.pending_mobility_count, 0),
        'approved_mobility_count', coalesce(case_metrics.approved_mobility_count, 0),
        'effective_active_candidates', coalesce(case_metrics.effective_active_candidates, 0),
        'available_vacancies', coalesce(case_metrics.available_vacancies, 0),
        'has_rejected_internal_mobility', has_rejected_internal_mobility,
        'request_reopened', should_reopen_request
      )
    );
  end if;

  return next_status;
end;
$function$;

notify pgrst, 'reload schema';

commit;
