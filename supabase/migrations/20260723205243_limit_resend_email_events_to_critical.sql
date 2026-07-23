begin;

alter table public.transactional_email_settings
  add column if not exists enabled_event_types text[] not null default array[
    'pending_approval',
    'recruitment_handoff',
    'who_approval',
    'rejection',
    'personnel_to_hire',
    'competency_formalization'
  ]::text[],
  add column if not exists reminders_enabled boolean not null default true;

alter table public.transactional_email_settings
  drop constraint if exists transactional_email_settings_enabled_event_types_check;

alter table public.transactional_email_settings
  add constraint transactional_email_settings_enabled_event_types_check
  check (
    array_position(enabled_event_types, null) is null
    and enabled_event_types <@ array[
      'pending_approval',
      'recruitment_handoff',
      'who_approval',
      'rejection',
      'personnel_to_hire',
      'competency_formalization'
    ]::text[]
  );

create or replace function public.queue_transactional_email_notification(
  p_event_key text,
  p_event_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  settings_record public.transactional_email_settings%rowtype;
  dispatch_id bigint;
  http_request_id bigint;
  webhook_secret text;
  is_reminder boolean := coalesce((p_payload->>'is_reminder')::boolean, false);
begin
  select *
    into settings_record
    from public.transactional_email_settings
   where singleton = true
   limit 1;

  if not coalesce(settings_record.is_enabled, false) then
    return;
  end if;

  if not p_event_type = any(coalesce(settings_record.enabled_event_types, array[]::text[])) then
    return;
  end if;

  if is_reminder and not coalesce(settings_record.reminders_enabled, false) then
    return;
  end if;

  if nullif(trim(coalesce(settings_record.edge_function_url, '')), '') is null then
    return;
  end if;

  webhook_secret := nullif(trim(coalesce(settings_record.webhook_secret_value, '')), '');

  if webhook_secret is null then
    return;
  end if;

  insert into public.transactional_email_dispatches (
    event_key,
    event_type,
    status,
    payload
  )
  values (
    p_event_key,
    p_event_type,
    'queued',
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (event_key) do nothing
  returning id into dispatch_id;

  if dispatch_id is null then
    return;
  end if;

  begin
    http_request_id := net.http_post(
      url := settings_record.edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-webhook-secret', webhook_secret
      ),
      body := coalesce(p_payload, '{}'::jsonb),
      timeout_milliseconds := 10000
    );

    update public.transactional_email_dispatches
       set request_id = http_request_id
     where id = dispatch_id;
  exception
    when others then
      update public.transactional_email_dispatches
         set status = 'failed',
             last_error = sqlerrm
       where id = dispatch_id;
  end;
end;
$function$;

update public.transactional_email_settings
   set enabled_event_types = array[
         'pending_approval',
         'who_approval',
         'rejection'
       ]::text[],
       reminders_enabled = false
 where singleton = true;

revoke all on function public.queue_transactional_email_notification(text, text, jsonb)
from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
