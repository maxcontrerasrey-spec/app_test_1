begin;

create index if not exists idx_employees_active_buk_employee_id_recent
  on public.employees (buk_employee_id, updated_at desc, created_at desc)
  where is_active = true
    and nullif(trim(coalesce(buk_employee_id, '')), '') is not null;

create or replace function public.submit_service_entries_batch(p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid;
  errors jsonb;
  saved_count integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.user_can_manage_operations(current_user_id) then
    raise exception 'Sin permisos para registrar servicios operacionales.';
  end if;

  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'El payload de planificación debe ser un arreglo.';
  end if;

  if jsonb_array_length(p_entries) = 0 then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_array(jsonb_build_object(
      'index', 0,
      'field_errors', jsonb_build_object('payload', 'No hay servicios para guardar.')
    )));
  end if;

  with prepared_rows as materialized (
    select *
    from public.prepare_operations_service_entry_batch(p_entries, current_user_id)
  ),
  validation_rows as (
    select
      prepared.entry_index,
      prepared.service_id,
      (
        '{}'::jsonb
        || case
          when prepared.entry_item_type is distinct from 'object'
            then jsonb_build_object('payload', 'Cada servicio debe ser un objeto.')
          else '{}'::jsonb
        end
        || case
          when prepared.contract_code_input is null
            then jsonb_build_object('contractCode', 'Contrato requerido.')
          when prepared.contract_id is null
            then jsonb_build_object('contractCode', 'Contrato no encontrado.')
          when not prepared.can_edit_contract
            then jsonb_build_object('contractCode', 'No tienes permiso para editar servicios de este contrato.')
          else '{}'::jsonb
        end
        || case
          when prepared.service_external_key is null
            then jsonb_build_object('serviceExternalKey', 'Servicio requerido o inválido.')
          when prepared.base_service_id is null or prepared.service_is_active is false
            then jsonb_build_object('serviceExternalKey', 'Servicio no disponible para el contrato seleccionado.')
          else '{}'::jsonb
        end
        || case
          when prepared.service_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or prepared.service_date is null
            then jsonb_build_object('serviceDate', 'Fecha de servicio inválida.')
          else '{}'::jsonb
        end
        || case
          when prepared.shift not in ('am', 'pm')
            then jsonb_build_object('shift', 'Turno requerido o inválido.')
          else '{}'::jsonb
        end
        || case
          when prepared.service_execution_status not in ('planned', 'not_performed')
            then jsonb_build_object('serviceExecutionStatus', 'Estado operativo inválido.')
          else '{}'::jsonb
        end
        || case
          when length(prepared.service_execution_note) > 240
            then jsonb_build_object('serviceExecutionNote', 'La observación operativa excede el máximo permitido.')
          else '{}'::jsonb
        end
        || case
          when prepared.service_execution_status = 'planned'
            and (prepared.equipment_code is null or prepared.equipment_is_active is false)
            then jsonb_build_object('equipmentCode', 'Selecciona un equipo válido.')
          else '{}'::jsonb
        end
        || case
          when prepared.service_execution_status = 'planned'
            and prepared.driver_buk_employee_id is null
            then jsonb_build_object('driverName', 'Selecciona un conductor BUK activo y válido.')
          else '{}'::jsonb
        end
      ) as field_errors
    from prepared_rows prepared
  ),
  validation_payload as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'index', validation_rows.entry_index,
          'service_id', validation_rows.service_id,
          'field_errors', validation_rows.field_errors
        )
        order by validation_rows.entry_index
      ) filter (where validation_rows.field_errors <> '{}'::jsonb),
      '[]'::jsonb
    ) as errors
    from validation_rows
  ),
  upserted as (
    insert into public.service_entries (
      service_date,
      shift,
      base_service_id,
      contract_id,
      contract_code,
      service_operational_name,
      service_contractual_name,
      service_category,
      service_company,
      service_execution_status,
      service_execution_note,
      driver_buk_employee_id,
      driver_name,
      driver_document,
      driver_area,
      driver_shift_status,
      driver_shift_source,
      driver_roster_base_status,
      driver_roster_effective_status,
      equipment_code,
      equipment_plate,
      equipment_type,
      equipment_client,
      created_by
    )
    select
      prepared.service_date,
      prepared.shift,
      prepared.base_service_id,
      prepared.contract_id,
      prepared.contract_code,
      prepared.service_operational_name,
      prepared.service_contractual_name,
      prepared.service_category,
      prepared.service_company,
      prepared.service_execution_status,
      nullif(prepared.service_execution_note, ''),
      prepared.driver_buk_employee_id,
      prepared.driver_name,
      prepared.driver_document,
      prepared.driver_area,
      prepared.driver_shift_status,
      case when prepared.service_execution_status = 'planned' then 'roster' else null end,
      prepared.driver_roster_base_status,
      prepared.driver_roster_effective_status,
      prepared.equipment_code,
      prepared.equipment_plate,
      prepared.equipment_type,
      prepared.equipment_client,
      current_user_id
    from prepared_rows prepared
    cross join validation_payload
    where jsonb_array_length(validation_payload.errors) = 0
    on conflict (service_date, shift, contract_id, base_service_id, created_by)
    do update
       set contract_code = excluded.contract_code,
           service_operational_name = excluded.service_operational_name,
           service_contractual_name = excluded.service_contractual_name,
           service_category = excluded.service_category,
           service_company = excluded.service_company,
           service_execution_status = excluded.service_execution_status,
           service_execution_note = excluded.service_execution_note,
           driver_buk_employee_id = excluded.driver_buk_employee_id,
           driver_name = excluded.driver_name,
           driver_document = excluded.driver_document,
           driver_area = excluded.driver_area,
           driver_shift_status = excluded.driver_shift_status,
           driver_shift_source = excluded.driver_shift_source,
           driver_roster_base_status = excluded.driver_roster_base_status,
           driver_roster_effective_status = excluded.driver_roster_effective_status,
           equipment_code = excluded.equipment_code,
           equipment_plate = excluded.equipment_plate,
           equipment_type = excluded.equipment_type,
           equipment_client = excluded.equipment_client
    returning 1
  )
  select validation_payload.errors, count(upserted.*)::integer
    into errors, saved_count
    from validation_payload
    left join upserted on true
   group by validation_payload.errors;

  if jsonb_array_length(errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', errors);
  end if;

  return jsonb_build_object('ok', true, 'saved_count', coalesce(saved_count, 0));
end;
$function$;

revoke all on function public.submit_service_entries_batch(jsonb) from public, anon;
grant execute on function public.submit_service_entries_batch(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
