-- =============================================================================
-- Migración correctiva: Eliminar referencias a columnas inexistentes en
-- enqueue_hiring_pending_approval_email(bigint, boolean)
-- =============================================================================
-- Contexto:
--   La migración 20260612204419 (y su corrección 20260615171200) definieron
--   la función enqueue_hiring_pending_approval_email seleccionando dos columnas
--   que NO existen en la tabla public.hiring_requests:
--     - hr.request_context  → columna inexistente
--     - hr.module_label     → columna inexistente
--
--   Ambas columnas existen en el módulo de MOVILIDAD INTERNA, pero fueron
--   copiadas incorrectamente al código de contrataciones.
--
--   Error que produce: 42703 "column hr.request_context does not exist"
--   El error solo aparece en EJECUCIÓN (no en la migración) porque PostgreSQL
--   no valida el cuerpo de las funciones al crearlas.
--
-- Solución:
--   Reemplazar la función completa:
--     - Eliminar hr.request_context del SELECT → no existe en la tabla
--     - Eliminar hr.module_label del SELECT    → no existe en la tabla
--     - En el payload del correo, usar valores literales:
--         'request_context' → 'hiring'         (valor fijo, siempre es contratación)
--         'module_label'    → 'Contratación'   (valor fijo, igual que en 20260612205940)
-- =============================================================================

-- 1. Eliminar la función actual (única firma que debe existir post-20260615171200)
drop function if exists public.enqueue_hiring_pending_approval_email(bigint, boolean);
-- Por seguridad, también eliminar la versión antigua de 1 parámetro si aún existiera
drop function if exists public.enqueue_hiring_pending_approval_email(bigint);

-- 2. Recrear la función con las columnas corregidas
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
    hr.id              as hiring_request_id,
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
    hr.vacancies
    -- NOTA: request_context y module_label NO existen en hiring_requests.
    -- Se usan valores literales en el payload más abajo.
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

  event_key := format(
    'hiring-approval-pending:%s%s',
    approval_record.id,
    case when p_is_reminder then ':reminder' else '' end
  );

  perform public.queue_transactional_email_notification(
    event_key,
    'pending_approval',
    jsonb_build_object(
      'kind',         'pending_approval',
      'event_key',    event_key,
      'is_reminder',  p_is_reminder,
      'to', jsonb_build_array(
        jsonb_build_object(
          'email', approval_record.approver_email,
          'name',  coalesce(nullif(trim(approval_record.approver_name), ''), approval_record.approver_email)
        )
      ),
      'approval', jsonb_build_object(
        'id',         approval_record.id,
        'step_code',  approval_record.step_code,
        'step_name',  approval_record.step_name,
        'created_at', approval_record.created_at
      ),
      'request', jsonb_build_object(
        'id',                   approval_record.hiring_request_id,
        'folio',                approval_record.folio,
        'request_context',      'hiring',
        'module_label',         'Contratación',
        'requester_name',       approval_record.requester_name,
        'requester_email',      approval_record.requester_email,
        'contract_name',        approval_record.contract_name,
        'contract_number',      approval_record.contract_number,
        'job_position_name',    approval_record.job_position_name,
        'cost_center_code',     approval_record.cost_center_code,
        'cost_center_name',     approval_record.cost_center_name,
        'requested_entry_date', approval_record.requested_entry_date,
        'start_date',           approval_record.start_date,
        'vacancies',            approval_record.vacancies
      ),
      'route', '/control-contrataciones'
    )
  );
end;
$function$;

-- 3. Blindar permisos: solo invocable internamente (triggers / security definer)
revoke all on function public.enqueue_hiring_pending_approval_email(bigint, boolean)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
