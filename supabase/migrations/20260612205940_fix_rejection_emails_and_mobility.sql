-- Fix hiring rejection email queue function
create or replace function public.enqueue_hiring_rejected_email(
  p_approval_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  approval_record record;
  event_key text;
begin
  select
    hra.id,
    hra.step_name,
    hra.decision_comment as comments,
    hr.id as hiring_request_id,
    hr.folio,
    hr.requester_name,
    hr.requester_email,
    hr.contract_name,
    hr.job_position_name
  into approval_record
  from public.hiring_request_approvals hra
  join public.hiring_requests hr
    on hr.id = hra.hiring_request_id
  where hra.id = p_approval_id
    and hra.status = 'rejected'
  limit 1;

  if approval_record.id is null then
    return;
  end if;

  if nullif(trim(coalesce(approval_record.requester_email, '')), '') is null then
    return;
  end if;

  event_key := format('hiring-rejected:%s', approval_record.id);

  perform public.queue_transactional_email_notification(
    event_key,
    'rejection',
    jsonb_build_object(
      'kind', 'rejection',
      'event_key', event_key,
      'to', jsonb_build_array(
        jsonb_build_object(
          'email', approval_record.requester_email,
          'name', coalesce(nullif(trim(approval_record.requester_name), ''), approval_record.requester_email)
        )
      ),
      'approval', jsonb_build_object(
        'id', approval_record.id,
        'step_name', approval_record.step_name,
        'comments', approval_record.comments
      ),
      'request', jsonb_build_object(
        'id', approval_record.hiring_request_id,
        'folio', approval_record.folio,
        'requester_name', approval_record.requester_name,
        'requester_email', approval_record.requester_email,
        'contract_name', approval_record.contract_name,
        'job_position_name', approval_record.job_position_name,
        'request_context', 'hiring',
        'module_label', 'Contratación'
      ),
      'route', '/mis-solicitudes'
    )
  );
end;
$function$;

-- Crear funcion y trigger para movilidad interna rechazada
create or replace function public.enqueue_mobility_rejected_email(
  p_approval_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  approval_record record;
  event_key text;
begin
  select
    ima.id,
    ima.step_name,
    ima.decision_comment as comments,
    imr.id as request_id,
    imr.folio,
    imr.requester_name,
    imr.requester_email,
    imr.destination_area_name as contract_name,
    imr.destination_job_title as job_position_name
  into approval_record
  from public.internal_mobility_request_approvals ima
  join public.internal_mobility_requests imr
    on imr.id = ima.internal_mobility_request_id
  where ima.id = p_approval_id
    and ima.status = 'rejected'
  limit 1;

  if approval_record.id is null then
    return;
  end if;

  if nullif(trim(coalesce(approval_record.requester_email, '')), '') is null then
    return;
  end if;

  event_key := format('mobility-rejected:%s', approval_record.id);

  perform public.queue_transactional_email_notification(
    event_key,
    'rejection',
    jsonb_build_object(
      'kind', 'rejection',
      'event_key', event_key,
      'to', jsonb_build_array(
        jsonb_build_object(
          'email', approval_record.requester_email,
          'name', coalesce(nullif(trim(approval_record.requester_name), ''), approval_record.requester_email)
        )
      ),
      'approval', jsonb_build_object(
        'id', approval_record.id,
        'step_name', approval_record.step_name,
        'comments', approval_record.comments
      ),
      'request', jsonb_build_object(
        'id', approval_record.request_id,
        'folio', approval_record.folio,
        'requester_name', approval_record.requester_name,
        'requester_email', approval_record.requester_email,
        'contract_name', approval_record.contract_name,
        'job_position_name', approval_record.job_position_name,
        'request_context', 'internal_mobility',
        'module_label', 'Movilidad Interna'
      ),
      'route', '/mis-solicitudes'
    )
  );
end;
$function$;

create or replace function public.trg_mobility_approvals_rejected_email_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'rejected' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.enqueue_mobility_rejected_email(new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_mobility_approvals_rejected_email_dispatch on public.internal_mobility_request_approvals;
create trigger trg_mobility_approvals_rejected_email_dispatch
after insert or update on public.internal_mobility_request_approvals
for each row
execute function public.trg_mobility_approvals_rejected_email_dispatch();

revoke all on function public.enqueue_hiring_rejected_email(bigint) from public, anon, authenticated;
revoke all on function public.enqueue_mobility_rejected_email(bigint) from public, anon, authenticated;
revoke all on function public.trg_mobility_approvals_rejected_email_dispatch() from public, anon, authenticated;

alter table public.transactional_email_dispatches drop constraint if exists transactional_email_dispatches_event_type_check;
alter table public.transactional_email_dispatches add constraint transactional_email_dispatches_event_type_check check (event_type in ('pending_approval', 'recruitment_handoff', 'who_approval', 'rejection'));

notify pgrst, 'reload schema';
