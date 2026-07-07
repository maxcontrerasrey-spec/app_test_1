-- =============================================================================
-- Hotfix: eliminar referencias a columnas inexistentes en
-- enqueue_personnel_to_hire_email(uuid, boolean)
-- =============================================================================
-- Contexto:
--   La función de notificación para "Personal a contratar" fue agregada en
--   20260703070000, pero volvió a seleccionar `hr.request_context` y
--   `hr.module_label` desde `public.hiring_requests`, columnas que no existen
--   en contratación. El error se gatilla en runtime cuando el trigger mueve
--   un candidato a `ready_for_hire`.
--
-- Solución:
--   Recompilar la función manteniendo el mismo flujo y payload, pero usando
--   valores literales consistentes con el resto de notificaciones del módulo:
--     - request_context = 'hiring'
--     - module_label    = 'Contratación'
-- =============================================================================

drop function if exists public.enqueue_personnel_to_hire_email(uuid, boolean);
drop function if exists public.enqueue_personnel_to_hire_email(uuid);

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
        'request_context', 'hiring',
        'module_label', 'Contratación',
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

revoke all on function public.enqueue_personnel_to_hire_email(uuid, boolean)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
