-- =============================================================================
-- Migración correctiva: Eliminar sobrecarga ambigua de
-- enqueue_hiring_pending_approval_email
-- =============================================================================
-- Contexto:
--   La migración 20260611_170000 creó la función con firma (bigint).
--   La migración 20260612204419 la redefinió con firma (bigint, boolean DEFAULT false)
--   usando CREATE OR REPLACE, pero como los parámetros cambiaron, PostgreSQL
--   NO reemplazó la original sino que creó una SEGUNDA función.
--
--   Resultado: dos funciones coexisten:
--     1) enqueue_hiring_pending_approval_email(bigint)
--     2) enqueue_hiring_pending_approval_email(bigint, boolean)
--
--   Cuando el trigger trg_hiring_request_pending_email_dispatch llama
--   perform enqueue_hiring_pending_approval_email(new.id), PostgreSQL no
--   puede decidir cuál usar → Error 42725 "function is not unique".
--
-- Solución:
--   Eliminar la versión antigua de 1 parámetro. La versión de 2 parámetros
--   (con DEFAULT false) atenderá correctamente todas las llamadas.
-- =============================================================================

-- 1. Eliminar la sobrecarga antigua (1 parámetro)
drop function if exists public.enqueue_hiring_pending_approval_email(bigint);

-- 2. Verificar que la versión correcta (2 parámetros) sigue existiendo.
--    Si por alguna razón no existe, la recreamos completa.
--    (CREATE OR REPLACE es seguro aquí porque la firma no cambia)
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
      )
    )
  );
end;
$function$;

-- 3. Blindar permisos: solo invocable internamente (triggers / security definer)
revoke all on function public.enqueue_hiring_pending_approval_email(bigint, boolean)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
