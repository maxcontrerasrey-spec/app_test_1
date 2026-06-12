-- Habilitar extensión pg_cron (en Supabase normalmente se activa en el dashboard, pero lo intentamos por si acaso)
create extension if not exists pg_cron schema extensions;

-- 1. Agregar columnas para control de recordatorios
alter table public.hiring_request_approvals
  add column if not exists last_reminder_sent_at timestamptz;

alter table public.candidate_stage_approvals
  add column if not exists last_reminder_sent_at timestamptz;

-- 2. Función para encolar correo de WHO
create or replace function public.enqueue_who_pending_approval_email(
  p_approval_id bigint,
  p_is_reminder boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  approval_record record;
  recipients jsonb := '[]'::jsonb;
  event_key text;
begin
  select
    csa.id,
    csa.stage_code,
    csa.created_at,
    rcc.id as candidate_id,
    p_cand.full_name as candidate_name,
    p_cand.rut as candidate_rut,
    hr.id as hiring_request_id,
    hr.folio,
    hr.requester_name,
    hr.requester_email,
    hr.job_position_name,
    hr.contract_name
  into approval_record
  from public.candidate_stage_approvals csa
  join public.recruitment_case_candidates rcc on rcc.id = csa.recruitment_case_candidate_id
  join public.profiles p_cand on p_cand.id = rcc.candidate_id
  join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  join public.hiring_requests hr on hr.id = rc.hiring_request_id
  where csa.id = p_approval_id
    and csa.status = 'pending'
    and csa.stage_code = 'who_pending'
  limit 1;

  if approval_record.id is null then
    return;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'email', who_approvers.email,
        'name', who_approvers.name
      )
      order by who_approvers.name, who_approvers.email
    ),
    '[]'::jsonb
  )
  into recipients
  from (
    select distinct
      lower(trim(p.email)) as email,
      coalesce(nullif(trim(p.full_name), ''), trim(p.email)) as name
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.role_capabilities rc on rc.role_code = ur.role_code
    where rc.capability = 'can_approve_who_stage'
      and p.status = 'active'
      and nullif(trim(coalesce(p.email, '')), '') is not null
  ) as who_approvers;

  if recipients = '[]'::jsonb then
    return;
  end if;

  event_key := format('who-approval-pending:%s%s', approval_record.id, case when p_is_reminder then ':reminder' else '' end);

  perform public.queue_transactional_email_notification(
    event_key,
    'who_approval',
    jsonb_build_object(
      'kind', 'who_approval',
      'event_key', event_key,
      'is_reminder', p_is_reminder,
      'to', recipients,
      'approval', jsonb_build_object(
        'id', approval_record.id,
        'stage_code', approval_record.stage_code,
        'created_at', approval_record.created_at
      ),
      'candidate', jsonb_build_object(
        'id', approval_record.candidate_id,
        'full_name', approval_record.candidate_name,
        'rut', approval_record.candidate_rut
      ),
      'request', jsonb_build_object(
        'id', approval_record.hiring_request_id,
        'folio', approval_record.folio,
        'requester_name', approval_record.requester_name,
        'requester_email', approval_record.requester_email,
        'job_position_name', approval_record.job_position_name,
        'contract_name', approval_record.contract_name
      ),
      'route', '/control-contrataciones'
    )
  );
end;
$function$;

-- 3. Trigger para disparar correo al crear WHO
create or replace function public.trg_candidate_stage_approvals_email_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'pending' and new.stage_code = 'who_pending' then
    perform public.enqueue_who_pending_approval_email(new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_candidate_stage_approvals_email_dispatch on public.candidate_stage_approvals;
create trigger trg_candidate_stage_approvals_email_dispatch
after insert on public.candidate_stage_approvals
for each row
execute function public.trg_candidate_stage_approvals_email_dispatch();

-- 4. Actualizar funcion de recordatorios para hiring (aceptar p_is_reminder)
create or replace function public.enqueue_hiring_pending_approval_email(
  p_approval_id bigint,
  p_is_reminder boolean default false
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
    hra.step_code,
    hra.step_name,
    hra.approver_user_id,
    hra.approver_name,
    hra.approver_email,
    hra.created_at,
    hr.id as hiring_request_id,
    hr.folio,
    hr.requester_name,
    hr.requester_email,
    hr.contract_name,
    hr.contract_number,
    hr.job_position_name,
    hr.cost_center_code,
    hr.cost_center_name,
    hr.requested_entry_date,
    hr.start_date,
    hr.vacancies,
    hr.request_context,
    hr.module_label
  into approval_record
  from public.hiring_request_approvals hra
  join public.hiring_requests hr
    on hr.id = hra.hiring_request_id
  where hra.id = p_approval_id
    and hra.status = 'pending'
    and hra.step_code in ('area_manager', 'contracts_control')
  limit 1;

  if approval_record.id is null then
    return;
  end if;

  if nullif(trim(coalesce(approval_record.approver_email, '')), '') is null then
    return;
  end if;

  event_key := format('hiring-approval-pending:%s%s', approval_record.id, case when p_is_reminder then ':reminder' else '' end);

  perform public.queue_transactional_email_notification(
    event_key,
    'pending_approval',
    jsonb_build_object(
      'kind', 'pending_approval',
      'event_key', event_key,
      'is_reminder', p_is_reminder,
      'to', jsonb_build_array(
        jsonb_build_object(
          'email', approval_record.approver_email,
          'name', coalesce(nullif(trim(approval_record.approver_name), ''), approval_record.approver_email)
        )
      ),
      'approval', jsonb_build_object(
        'id', approval_record.id,
        'step_code', approval_record.step_code,
        'step_name', approval_record.step_name,
        'created_at', approval_record.created_at
      ),
      'request', jsonb_build_object(
        'id', approval_record.hiring_request_id,
        'folio', approval_record.folio,
        'requester_name', approval_record.requester_name,
        'requester_email', approval_record.requester_email,
        'contract_name', approval_record.contract_name,
        'contract_number', approval_record.contract_number,
        'job_position_name', approval_record.job_position_name,
        'cost_center_code', approval_record.cost_center_code,
        'cost_center_name', approval_record.cost_center_name,
        'requested_entry_date', approval_record.requested_entry_date,
        'start_date', approval_record.start_date,
        'vacancies', approval_record.vacancies,
        'request_context', approval_record.request_context,
        'module_label', approval_record.module_label
      ),
      'route', '/control-contrataciones'
    )
  );
end;
$function$;

-- 5. Crear funcion de procesamiento de recordatorios
create or replace function public.process_pending_approval_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  rec record;
begin
  -- Reminders para hiring_request_approvals (Contrataciones / Movilidad)
  for rec in 
    select id 
    from public.hiring_request_approvals 
    where status = 'pending' 
      and step_code in ('area_manager', 'contracts_control')
      and created_at < now() - interval '24 hours'
      and (last_reminder_sent_at is null or last_reminder_sent_at < now() - interval '24 hours')
  loop
    perform public.enqueue_hiring_pending_approval_email(rec.id, true);
    update public.hiring_request_approvals set last_reminder_sent_at = now() where id = rec.id;
  end loop;

  -- Reminders para candidate_stage_approvals (WHO)
  for rec in 
    select id 
    from public.candidate_stage_approvals 
    where status = 'pending' 
      and stage_code = 'who_pending'
      and created_at < now() - interval '24 hours'
      and (last_reminder_sent_at is null or last_reminder_sent_at < now() - interval '24 hours')
  loop
    perform public.enqueue_who_pending_approval_email(rec.id, true);
    update public.candidate_stage_approvals set last_reminder_sent_at = now() where id = rec.id;
  end loop;
end;
$function$;

-- 6. Programar cron job
-- Envolvemos en bloque DO para evitar errores si la extensión pg_cron no está
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'transactional_email_reminders',
      '0 * * * *', -- Cada hora en el minuto 0
      'SELECT public.process_pending_approval_reminders();'
    );
  end if;
exception
  when others then
    raise notice 'No se pudo programar el cron. Asegurese de que pg_cron esta habilitado.';
end $$;

-- 7. Permisos
revoke all on function public.enqueue_who_pending_approval_email(bigint, boolean) from public, anon, authenticated;
revoke all on function public.trg_candidate_stage_approvals_email_dispatch() from public, anon, authenticated;
revoke all on function public.process_pending_approval_reminders() from public, anon, authenticated;

notify pgrst, 'reload schema';
