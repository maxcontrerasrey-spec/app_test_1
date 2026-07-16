begin;

drop function if exists public.prepare_operations_service_entry_batch(jsonb, uuid) cascade;

create or replace function public.prepare_operations_service_entry_batch(
  p_entries jsonb,
  batch_user_id uuid
)
returns table (
  entry_index integer,
  service_id text,
  entry_item_type text,
  contract_code_input text,
  service_external_key bigint,
  service_date date,
  service_date_text text,
  shift text,
  service_execution_status text,
  service_execution_note text,
  contract_id bigint,
  contract_code text,
  can_edit_contract boolean,
  base_service_id bigint,
  service_is_active boolean,
  service_operational_name text,
  service_contractual_name text,
  service_category text,
  service_company text,
  equipment_code text,
  equipment_plate text,
  equipment_type text,
  equipment_client text,
  equipment_is_active boolean,
  driver_buk_employee_id text,
  driver_name text,
  driver_document text,
  driver_area text,
  driver_roster_base_status text,
  driver_roster_effective_status text,
  driver_shift_status text
)
language sql
stable
security definer
set search_path = public
as $function$
  with raw_entries as (
    select
      (entry.ordinality - 1)::integer as entry_index,
      entry.value as entry_item,
      jsonb_typeof(entry.value) as entry_item_type
    from jsonb_array_elements(p_entries) with ordinality as entry(value, ordinality)
  ),
  normalized as (
    select
      raw.entry_index,
      raw.entry_item,
      raw.entry_item_type,
      raw.entry_item->>'serviceId' as service_id,
      nullif(trim(coalesce(raw.entry_item->>'contractCode', '')), '') as contract_code_input,
      case
        when coalesce(raw.entry_item->>'serviceExternalKey', '') ~ '^[0-9]+$'
          then (raw.entry_item->>'serviceExternalKey')::bigint
        else null
      end as service_external_key,
      case
        when coalesce(raw.entry_item->>'serviceDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then (raw.entry_item->>'serviceDate')::date
        else null
      end as service_date,
      coalesce(raw.entry_item->>'serviceDate', '') as service_date_text,
      lower(trim(coalesce(raw.entry_item->>'shift', ''))) as shift,
      coalesce(nullif(lower(trim(coalesce(raw.entry_item->>'serviceExecutionStatus', ''))), ''), 'planned') as service_execution_status,
      trim(coalesce(raw.entry_item->>'serviceExecutionNote', '')) as service_execution_note,
      nullif(trim(coalesce(raw.entry_item->>'equipmentCode', '')), '') as input_equipment_code,
      nullif(trim(coalesce(raw.entry_item->>'driverBukEmployeeId', '')), '') as input_driver_buk_employee_id,
      nullif(public.build_employee_document_digits(raw.entry_item->>'driverDocument', '{}'::jsonb), '') as input_driver_document_digits,
      public.normalize_recruitment_search_text(raw.entry_item->>'driverName') as input_driver_search,
      public.normalize_recruitment_search_text(raw.entry_item->>'driverArea') as input_driver_area_search
    from raw_entries raw
  ),
  resolved as (
    select
      normalized.entry_index,
      normalized.service_id,
      normalized.entry_item_type,
      normalized.contract_code_input,
      normalized.service_external_key,
      normalized.service_date,
      normalized.service_date_text,
      normalized.shift,
      normalized.service_execution_status,
      case
        when normalized.service_execution_status = 'not_performed' and normalized.service_execution_note = ''
          then 'Servicio no realizado'
        else normalized.service_execution_note
      end as service_execution_note,
      contract_match.id as contract_id,
      contract_match.contract_code,
      coalesce(public.user_can_edit_operations_contract(batch_user_id, contract_match.id), false) as can_edit_contract,
      service_match.id as base_service_id,
      service_match.is_active as service_is_active,
      service_match.operational_name as service_operational_name,
      service_match.contractual_name as service_contractual_name,
      service_match.contractual_category as service_category,
      service_match.company_name as service_company,
      equipment_match.equipment_code,
      equipment_match.plate as equipment_plate,
      equipment_match.equipment_type,
      equipment_match.current_client as equipment_client,
      equipment_match.is_active as equipment_is_active,
      driver_match.buk_employee_id as driver_buk_employee_id,
      driver_match.full_name as driver_name,
      driver_match.document_number as driver_document,
      driver_match.area_name as driver_area,
      roster_status.base_status as driver_roster_base_status,
      roster_status.effective_status as driver_roster_effective_status,
      public.map_operations_driver_shift_status(roster_status.effective_status) as driver_shift_status
    from normalized
    left join lateral (
      select
        c.id,
        coalesce(nullif(trim(c.contract_name), ''), c.code) as contract_code
      from public.contracts c
      where (
        c.code = normalized.contract_code_input
        or c.contract_name = normalized.contract_code_input
        or c.contract_name = replace(coalesce(normalized.contract_code_input, ''), 'SERVICIO ', '')
      )
        and c.is_active = true
      order by c.id
      limit 1
    ) contract_match on true
    left join lateral (
      select
        bs.id,
        bs.is_active,
        bs.operational_name,
        bs.company_name,
        bs.contractual_name,
        bs.contractual_category
      from public.base_services bs
      where bs.external_key = normalized.service_external_key
        and bs.contract_id = contract_match.id
      order by bs.id
      limit 1
    ) service_match on true
    left join lateral (
      select
        e.equipment_code,
        e.plate,
        e.equipment_type,
        e.current_client,
        e.is_active
      from public.equipment e
      where e.equipment_code = normalized.input_equipment_code
      limit 1
    ) equipment_match on normalized.service_execution_status = 'planned'
    left join lateral (
      select
        candidate.buk_employee_id,
        candidate.full_name,
        candidate.document_number,
        candidate.area_name
      from (
        select
          e.buk_employee_id,
          e.full_name,
          coalesce(
            nullif(trim(coalesce(e.document_number, '')), ''),
            nullif(trim(coalesce(e.raw_payload ->> 'document_number', '')), ''),
            nullif(trim(coalesce(e.raw_payload ->> 'rut', '')), '')
          ) as document_number,
          nullif(trim(e.area_name), '') as area_name,
          row_number() over (
            partition by public.build_active_employee_identity_key(
              e.document_type,
              e.document_number,
              e.buk_employee_id,
              e.raw_payload
            )
            order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
          ) as identity_rank,
          case
            when normalized.input_driver_buk_employee_id is not null
              and e.buk_employee_id = normalized.input_driver_buk_employee_id then 0
            when normalized.input_driver_document_digits is not null
              and public.build_employee_document_digits(e.document_number, e.raw_payload) = normalized.input_driver_document_digits then 1
            when normalized.input_driver_search <> ''
              and public.build_active_employee_search_text(
                e.full_name,
                e.document_number,
                e.job_title,
                e.contract_code,
                e.area_name,
                e.raw_payload
              ) like '%' || normalized.input_driver_search || '%' then 2
            else 9
          end as match_priority,
          case
            when normalized.input_driver_area_search <> ''
              and public.normalize_recruitment_search_text(coalesce(e.area_name, '')) like '%' || normalized.input_driver_area_search || '%' then 0
            else 1
          end as area_priority
        from public.resolve_operations_driver_candidates(
          normalized.input_driver_buk_employee_id,
          normalized.input_driver_document_digits,
          normalized.input_driver_search
        ) e
      ) candidate
      where candidate.identity_rank = 1
        and candidate.match_priority < 9
      order by candidate.match_priority, candidate.area_priority, candidate.full_name asc
      limit 1
    ) driver_match on normalized.service_execution_status = 'planned'
    left join lateral (
      select
        rs.base_status,
        rs.effective_status
      from public.resolve_hr_roster_day_status(driver_match.buk_employee_id, normalized.service_date) rs
    ) roster_status on normalized.service_execution_status = 'planned'
      and driver_match.buk_employee_id is not null
      and normalized.service_date is not null
  )
  select
    resolved.entry_index,
    resolved.service_id,
    resolved.entry_item_type,
    resolved.contract_code_input,
    resolved.service_external_key,
    resolved.service_date,
    resolved.service_date_text,
    resolved.shift,
    resolved.service_execution_status,
    resolved.service_execution_note,
    resolved.contract_id,
    resolved.contract_code,
    resolved.can_edit_contract,
    resolved.base_service_id,
    resolved.service_is_active,
    resolved.service_operational_name,
    resolved.service_contractual_name,
    resolved.service_category,
    resolved.service_company,
    resolved.equipment_code,
    resolved.equipment_plate,
    resolved.equipment_type,
    resolved.equipment_client,
    resolved.equipment_is_active,
    resolved.driver_buk_employee_id,
    resolved.driver_name,
    resolved.driver_document,
    resolved.driver_area,
    resolved.driver_roster_base_status,
    resolved.driver_roster_effective_status,
    resolved.driver_shift_status
  from resolved;
$function$;

revoke all on function public.prepare_operations_service_entry_batch(jsonb, uuid) from public, anon, authenticated;

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

  with validation_rows as (
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
    from public.prepare_operations_service_entry_batch(p_entries, current_user_id) prepared
  )
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
  )
  into errors
  from validation_rows;

  if jsonb_array_length(errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', errors);
  end if;

  with upserted as (
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
    from public.prepare_operations_service_entry_batch(p_entries, current_user_id) prepared
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
  select count(*)::integer
    into saved_count
    from upserted;

  return jsonb_build_object('ok', true, 'saved_count', saved_count);
end;
$function$;

revoke all on function public.submit_service_entries_batch(jsonb) from public, anon;
grant execute on function public.submit_service_entries_batch(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
