begin;

alter table public.transactional_email_dispatches
  drop constraint if exists transactional_email_dispatches_event_type_check;

alter table public.transactional_email_dispatches
  add constraint transactional_email_dispatches_event_type_check
  check (
    event_type in (
      'pending_approval',
      'recruitment_handoff',
      'who_approval',
      'rejection',
      'personnel_to_hire'
    )
  );

insert into public.role_feature_access (role_code, feature_code, can_access)
values
  ('reclutamiento', 'recruitment_processes_summary', true),
  ('reclutamiento', 'recruitment_candidate_control', true),
  ('reclutamiento', 'recruitment_personnel_to_hire', true),
  ('reclutamiento', 'recruitment_internal_mobility', true),
  ('administrativo', 'recruitment_processes_summary', true),
  ('administrativo', 'recruitment_personnel_to_hire', true),
  ('administrativo', 'recruitment_internal_mobility', true),
  ('jefe_administrativo', 'recruitment_processes_summary', true),
  ('jefe_administrativo', 'recruitment_personnel_to_hire', true),
  ('jefe_administrativo', 'recruitment_internal_mobility', true)
on conflict (role_code, feature_code)
do update set
  can_access = excluded.can_access,
  updated_at = timezone('utc', now());

delete from public.role_feature_access
where role_code in ('administrativo', 'jefe_administrativo')
  and feature_code = 'recruitment_candidate_control';

insert into public.role_capabilities (role_code, capability_code)
values
  ('administrativo', 'candidate_control_access'),
  ('jefe_administrativo', 'candidate_control_access')
on conflict (role_code, capability_code) do nothing;

alter table public.recruitment_case_candidates
  add column if not exists ready_for_buk_notified_at timestamptz,
  add column if not exists ready_for_buk_last_reminder_sent_at timestamptz;

create index if not exists idx_recruitment_case_candidates_ready_for_buk_reminders
  on public.recruitment_case_candidates (
    stage_code,
    ready_for_buk_notified_at,
    ready_for_buk_last_reminder_sent_at
  )
  where stage_code = 'ready_for_hire';

update public.recruitment_case_candidates rcc
set
  ready_for_buk_notified_at = coalesce(
    rcc.ready_for_buk_notified_at,
    rcc.stage_entered_at,
    rcc.updated_at,
    rcc.created_at
  ),
  ready_for_buk_last_reminder_sent_at = coalesce(
    rcc.ready_for_buk_last_reminder_sent_at,
    null
  )
where rcc.stage_code = 'ready_for_hire'
  and not exists (
    select 1
    from public.buk_sync_jobs bsj
    where bsj.recruitment_case_candidate_id = rcc.id
      and bsj.status = 'success'
      and nullif(trim(coalesce(bsj.buk_employee_id, '')), '') is not null
  );

create or replace function public.enqueue_personnel_to_hire_email(
  p_case_candidate_id uuid,
  p_is_reminder boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  candidate_record record;
  recipients jsonb := '[]'::jsonb;
  event_key text;
begin
  select
    rcc.id,
    rcc.stage_code,
    rcc.stage_entered_at,
    cp.full_name as candidate_name,
    cp.national_id as candidate_rut,
    rc.id as recruitment_case_id,
    rc.case_code,
    rc.contract_name,
    rc.job_position_name,
    rc.cost_center_code,
    rc.cost_center_name,
    hr.id as hiring_request_id,
    hr.folio,
    hr.request_context,
    hr.module_label,
    hr.requester_name,
    hr.requester_email,
    hr.requested_entry_date,
    owner_profile.full_name as owner_name
  into candidate_record
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp
    on cp.id = rcc.candidate_profile_id
  join public.recruitment_cases rc
    on rc.id = rcc.recruitment_case_id
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  left join lateral (
    select rca.user_id
    from public.recruitment_case_assignments rca
    where rca.recruitment_case_id = rc.id
      and rca.is_primary = true
    order by rca.id asc
    limit 1
  ) as owner_assignment on true
  left join public.profiles owner_profile
    on owner_profile.id = owner_assignment.user_id
  where rcc.id = p_case_candidate_id
    and rcc.stage_code = 'ready_for_hire'
    and not exists (
      select 1
      from public.buk_sync_jobs bsj
      where bsj.recruitment_case_candidate_id = rcc.id
        and bsj.status = 'success'
        and nullif(trim(coalesce(bsj.buk_employee_id, '')), '') is not null
    )
  limit 1;

  if candidate_record.id is null then
    return;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'email', notification_recipient.email,
        'name', notification_recipient.name
      )
      order by notification_recipient.name, notification_recipient.email
    ),
    '[]'::jsonb
  )
  into recipients
  from (
    select distinct
      lower(trim(p.email)) as email,
      coalesce(nullif(trim(p.full_name), ''), trim(p.email)) as name
    from public.profiles p
    join public.user_roles ur
      on ur.user_id = p.id
    where ur.role_code in ('administrativo', 'jefe_administrativo')
      and p.status = 'active'
      and nullif(trim(coalesce(p.email, '')), '') is not null
  ) as notification_recipient;

  if recipients = '[]'::jsonb then
    return;
  end if;

  event_key := case
    when p_is_reminder then format(
      'personnel-to-hire:%s:reminder:%s',
      candidate_record.id,
      to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS')
    )
    else format('personnel-to-hire:%s', candidate_record.id)
  end;

  perform public.queue_transactional_email_notification(
    event_key,
    'personnel_to_hire',
    jsonb_build_object(
      'kind', 'personnel_to_hire',
      'event_key', event_key,
      'is_reminder', p_is_reminder,
      'to', recipients,
      'candidate', jsonb_build_object(
        'id', candidate_record.id,
        'full_name', candidate_record.candidate_name,
        'rut', candidate_record.candidate_rut,
        'ready_for_hire_at', candidate_record.stage_entered_at
      ),
      'case', jsonb_build_object(
        'id', candidate_record.recruitment_case_id,
        'case_code', candidate_record.case_code
      ),
      'request', jsonb_build_object(
        'id', candidate_record.hiring_request_id,
        'folio', candidate_record.folio,
        'request_context', candidate_record.request_context,
        'module_label', candidate_record.module_label,
        'requester_name', candidate_record.requester_name,
        'requester_email', candidate_record.requester_email,
        'contract_name', candidate_record.contract_name,
        'job_position_name', candidate_record.job_position_name,
        'cost_center_code', candidate_record.cost_center_code,
        'cost_center_name', candidate_record.cost_center_name,
        'requested_entry_date', candidate_record.requested_entry_date,
        'owner_name', candidate_record.owner_name
      ),
      'route', '/control-contrataciones'
    )
  );
end;
$function$;

create or replace function public.trg_recruitment_case_candidates_ready_for_buk_email_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.stage_code = 'ready_for_hire'
     and (
       tg_op = 'INSERT'
       or old.stage_code is distinct from new.stage_code
     ) then
    update public.recruitment_case_candidates
       set ready_for_buk_notified_at = timezone('utc', now()),
           ready_for_buk_last_reminder_sent_at = null
     where id = new.id;

    perform public.enqueue_personnel_to_hire_email(new.id, false);
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_recruitment_case_candidates_ready_for_buk_email_dispatch
  on public.recruitment_case_candidates;

create trigger trg_recruitment_case_candidates_ready_for_buk_email_dispatch
after insert or update of stage_code on public.recruitment_case_candidates
for each row
execute function public.trg_recruitment_case_candidates_ready_for_buk_email_dispatch();

create or replace function public.process_pending_approval_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  rec record;
begin
  for rec in
    select id
    from public.hiring_request_approvals
    where status = 'pending'
      and step_code in ('area_manager', 'contracts_control')
      and created_at < now() - interval '24 hours'
      and (
        last_reminder_sent_at is null
        or last_reminder_sent_at < now() - interval '24 hours'
      )
  loop
    perform public.enqueue_hiring_pending_approval_email(rec.id, true);
    update public.hiring_request_approvals
       set last_reminder_sent_at = now()
     where id = rec.id;
  end loop;

  for rec in
    select id
    from public.candidate_stage_approvals
    where status = 'pending'
      and stage_code = 'who_pending'
      and created_at < now() - interval '24 hours'
      and (
        last_reminder_sent_at is null
        or last_reminder_sent_at < now() - interval '24 hours'
      )
  loop
    perform public.enqueue_who_pending_approval_email(rec.id, true);
    update public.candidate_stage_approvals
       set last_reminder_sent_at = now()
     where id = rec.id;
  end loop;

  for rec in
    select rcc.id
    from public.recruitment_case_candidates rcc
    where rcc.stage_code = 'ready_for_hire'
      and rcc.ready_for_buk_notified_at < now() - interval '24 hours'
      and (
        rcc.ready_for_buk_last_reminder_sent_at is null
        or rcc.ready_for_buk_last_reminder_sent_at < now() - interval '24 hours'
      )
      and not exists (
        select 1
        from public.buk_sync_jobs bsj
        where bsj.recruitment_case_candidate_id = rcc.id
          and bsj.status = 'success'
          and nullif(trim(coalesce(bsj.buk_employee_id, '')), '') is not null
      )
  loop
    perform public.enqueue_personnel_to_hire_email(rec.id, true);
    update public.recruitment_case_candidates
       set ready_for_buk_last_reminder_sent_at = now()
     where id = rec.id;
  end loop;
end;
$function$;

revoke all on function public.enqueue_personnel_to_hire_email(uuid, boolean)
from public, anon, authenticated;

revoke all on function public.trg_recruitment_case_candidates_ready_for_buk_email_dispatch()
from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
