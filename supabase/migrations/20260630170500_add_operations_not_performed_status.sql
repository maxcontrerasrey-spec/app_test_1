begin;

alter table public.service_entries
  add column if not exists service_execution_status text not null default 'planned',
  add column if not exists service_execution_note text;

update public.service_entries
   set service_execution_status = 'planned'
 where service_execution_status is null;

alter table public.service_entries
  alter column equipment_code drop not null;

alter table public.service_entries
  drop constraint if exists service_entries_service_execution_status_check;

alter table public.service_entries
  add constraint service_entries_service_execution_status_check
  check (service_execution_status in ('planned', 'not_performed'));

create or replace function public.submit_service_entries_batch(p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid;
  entry_item jsonb;
  entry_index integer;
  errors jsonb := '[]'::jsonb;
  saved_count integer := 0;
  resolved_contract_id bigint;
  resolved_contract_code text;
  resolved_service_id bigint;
  resolved_service_is_active boolean;
  resolved_service_operational_name text;
  resolved_service_company_name text;
  resolved_service_contractual_name text;
  resolved_service_contractual_category text;
  resolved_equipment_code text;
  resolved_equipment_plate text;
  resolved_equipment_type text;
  resolved_equipment_client text;
  resolved_equipment_is_active boolean;
  resolved_driver_buk_employee_id text;
  resolved_driver_name text;
  resolved_driver_document text;
  resolved_driver_area text;
  resolved_driver_base_status text;
  resolved_driver_effective_status text;
  resolved_driver_shift_status text;
  entry_driver_buk_employee_id text;
  entry_driver_document_digits text;
  entry_driver_search text;
  entry_driver_area_search text;
  entry_service_execution_status text;
  entry_service_execution_note text;
  existing_entry_id uuid;
  lock_key text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.user_can_manage_operations(current_user_id) then
    raise exception 'Sin permisos para registrar servicios operacionales.';
  end if;

  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'El payload de planificación debe ser un arreglo.';
  end if;

  if jsonb_array_length(p_entries) = 0 then
    return jsonb_build_object('ok', false, 'errors', jsonb_build_array(jsonb_build_object(
      'index', 0,
      'field_errors', jsonb_build_object('payload', 'No hay servicios para guardar.')
    )));
  end if;

  for entry_item, entry_index in
    select value, ordinality::integer
    from jsonb_array_elements(p_entries) with ordinality
  loop
    entry_service_execution_status := coalesce(
      nullif(lower(trim(coalesce(entry_item->>'serviceExecutionStatus', ''))), ''),
      'planned'
    );
    entry_service_execution_note := trim(coalesce(entry_item->>'serviceExecutionNote', ''));

    if jsonb_typeof(entry_item) <> 'object' then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'field_errors', jsonb_build_object('payload', 'Cada servicio debe ser un objeto.')
      );
      continue;
    end if;

    if nullif(trim(entry_item->>'contractCode'), '') is null then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('contractCode', 'Contrato requerido.')
      );
      continue;
    end if;

    if coalesce(entry_item->>'serviceExternalKey', '') !~ '^[0-9]+$' then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('serviceExternalKey', 'Servicio requerido o inválido.')
      );
      continue;
    end if;

    if coalesce(entry_item->>'serviceDate', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('serviceDate', 'Fecha de servicio inválida.')
      );
      continue;
    end if;

    if lower(coalesce(entry_item->>'shift', '')) not in ('am', 'pm') then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('shift', 'Turno requerido o inválido.')
      );
      continue;
    end if;

    if entry_service_execution_status not in ('planned', 'not_performed') then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('serviceExecutionStatus', 'Estado operativo inválido.')
      );
      continue;
    end if;

    if length(entry_service_execution_note) > 240 then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('serviceExecutionNote', 'La observación operativa excede el máximo permitido.')
      );
      continue;
    end if;

    if entry_service_execution_status = 'planned'
       and nullif(trim(entry_item->>'equipmentCode'), '') is null then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('equipmentCode', 'Equipo requerido.')
      );
      continue;
    end if;

    select
      c.id,
      coalesce(nullif(trim(c.contract_name), ''), c.code)
      into resolved_contract_id, resolved_contract_code
     from public.contracts c
     where (
       c.code = nullif(trim(entry_item->>'contractCode'), '')
       or c.contract_name = nullif(trim(entry_item->>'contractCode'), '')
       or c.contract_name = replace(nullif(trim(entry_item->>'contractCode'), ''), 'SERVICIO ', '')
     )
       and c.is_active = true
     limit 1;

    if resolved_contract_id is null then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('contractCode', 'Contrato no encontrado.')
      );
      continue;
    end if;

    if not exists (
      select 1
        from public.user_contracts uc
       where uc.user_id = current_user_id
         and uc.contract_id = resolved_contract_id
    ) then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('contractCode', 'No tienes acceso a este contrato.')
      );
      continue;
    end if;

    select
      bs.id,
      bs.is_active,
      bs.operational_name,
      bs.company_name,
      bs.contractual_name,
      bs.contractual_category
      into
        resolved_service_id,
        resolved_service_is_active,
        resolved_service_operational_name,
        resolved_service_company_name,
        resolved_service_contractual_name,
        resolved_service_contractual_category
      from public.base_services bs
     where bs.external_key = nullif(entry_item->>'serviceExternalKey', '')::bigint
       and bs.contract_id = resolved_contract_id
     limit 1;

    if resolved_service_id is null or resolved_service_is_active is false then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('serviceExternalKey', 'Servicio no disponible para el contrato seleccionado.')
      );
      continue;
    end if;

    if entry_service_execution_status = 'planned' then
      select
        e.equipment_code,
        e.plate,
        e.equipment_type,
        e.current_client,
        e.is_active
        into
          resolved_equipment_code,
          resolved_equipment_plate,
          resolved_equipment_type,
          resolved_equipment_client,
          resolved_equipment_is_active
        from public.equipment e
       where e.equipment_code = nullif(trim(entry_item->>'equipmentCode'), '')
       limit 1;

      if resolved_equipment_code is null or resolved_equipment_is_active is false then
        errors := errors || jsonb_build_object(
          'index', entry_index - 1,
          'service_id', entry_item->>'serviceId',
          'field_errors', jsonb_build_object('equipmentCode', 'Selecciona un equipo válido.')
        );
        continue;
      end if;

      entry_driver_buk_employee_id := nullif(trim(coalesce(entry_item->>'driverBukEmployeeId', '')), '');
      entry_driver_document_digits := nullif(public.build_employee_document_digits(entry_item->>'driverDocument', '{}'::jsonb), '');
      entry_driver_search := public.normalize_recruitment_search_text(entry_item->>'driverName');
      entry_driver_area_search := public.normalize_recruitment_search_text(entry_item->>'driverArea');

      select
        candidate.buk_employee_id,
        candidate.full_name,
        candidate.document_number,
        candidate.area_name
        into
          resolved_driver_buk_employee_id,
          resolved_driver_name,
          resolved_driver_document,
          resolved_driver_area
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
            public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key,
            public.build_employee_document_digits(e.document_number, e.raw_payload) as document_digits,
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
              when entry_driver_buk_employee_id is not null and e.buk_employee_id = entry_driver_buk_employee_id then 0
              when entry_driver_document_digits is not null
                and public.build_employee_document_digits(e.document_number, e.raw_payload) = entry_driver_document_digits then 1
              when entry_driver_search <> ''
                and public.build_active_employee_search_text(
                  e.full_name,
                  e.document_number,
                  e.job_title,
                  e.contract_code,
                  e.area_name,
                  e.raw_payload
                ) like '%' || entry_driver_search || '%' then 2
              else 9
            end as match_priority,
            case
              when entry_driver_area_search <> ''
                and public.normalize_recruitment_search_text(coalesce(e.area_name, '')) like '%' || entry_driver_area_search || '%' then 0
              else 1
            end as area_priority
          from public.employees_active_current e
          where
            (
              entry_driver_buk_employee_id is not null
              and e.buk_employee_id = entry_driver_buk_employee_id
            )
            or (
              entry_driver_document_digits is not null
              and public.build_employee_document_digits(e.document_number, e.raw_payload) = entry_driver_document_digits
            )
            or (
              entry_driver_search <> ''
              and public.build_active_employee_search_text(
                e.full_name,
                e.document_number,
                e.job_title,
                e.contract_code,
                e.area_name,
                e.raw_payload
              ) like '%' || entry_driver_search || '%'
            )
        ) candidate
       where candidate.identity_rank = 1
         and candidate.match_priority < 9
       order by candidate.match_priority, candidate.area_priority, candidate.full_name asc
       limit 1;

      if resolved_driver_buk_employee_id is null then
        errors := errors || jsonb_build_object(
          'index', entry_index - 1,
          'service_id', entry_item->>'serviceId',
          'field_errors', jsonb_build_object('driverName', 'Selecciona un conductor BUK activo y válido.')
        );
        continue;
      end if;
    end if;
  end loop;

  if jsonb_array_length(errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', errors);
  end if;

  for entry_item, entry_index in
    select value, ordinality::integer
    from jsonb_array_elements(p_entries) with ordinality
  loop
    entry_service_execution_status := coalesce(
      nullif(lower(trim(coalesce(entry_item->>'serviceExecutionStatus', ''))), ''),
      'planned'
    );
    entry_service_execution_note := trim(coalesce(entry_item->>'serviceExecutionNote', ''));

    if entry_service_execution_status = 'not_performed' and entry_service_execution_note = '' then
      entry_service_execution_note := 'Servicio no realizado';
    end if;

    select
      c.id,
      coalesce(nullif(trim(c.contract_name), ''), c.code)
      into resolved_contract_id, resolved_contract_code
     from public.contracts c
     where (
       c.code = nullif(trim(entry_item->>'contractCode'), '')
       or c.contract_name = nullif(trim(entry_item->>'contractCode'), '')
       or c.contract_name = replace(nullif(trim(entry_item->>'contractCode'), ''), 'SERVICIO ', '')
     )
       and c.is_active = true
     limit 1;

    select
      bs.id,
      bs.operational_name,
      bs.company_name,
      bs.contractual_name,
      bs.contractual_category
      into
        resolved_service_id,
        resolved_service_operational_name,
        resolved_service_company_name,
        resolved_service_contractual_name,
        resolved_service_contractual_category
      from public.base_services bs
     where bs.external_key = nullif(entry_item->>'serviceExternalKey', '')::bigint
       and bs.contract_id = resolved_contract_id
     limit 1;

    if entry_service_execution_status = 'planned' then
      select
        e.equipment_code,
        e.plate,
        e.equipment_type,
        e.current_client
        into
          resolved_equipment_code,
          resolved_equipment_plate,
          resolved_equipment_type,
          resolved_equipment_client
        from public.equipment e
       where e.equipment_code = nullif(trim(entry_item->>'equipmentCode'), '')
       limit 1;

      entry_driver_buk_employee_id := nullif(trim(coalesce(entry_item->>'driverBukEmployeeId', '')), '');
      entry_driver_document_digits := nullif(public.build_employee_document_digits(entry_item->>'driverDocument', '{}'::jsonb), '');
      entry_driver_search := public.normalize_recruitment_search_text(entry_item->>'driverName');
      entry_driver_area_search := public.normalize_recruitment_search_text(entry_item->>'driverArea');

      select
        candidate.buk_employee_id,
        candidate.full_name,
        candidate.document_number,
        candidate.area_name
        into
          resolved_driver_buk_employee_id,
          resolved_driver_name,
          resolved_driver_document,
          resolved_driver_area
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
              when entry_driver_buk_employee_id is not null and e.buk_employee_id = entry_driver_buk_employee_id then 0
              when entry_driver_document_digits is not null
                and public.build_employee_document_digits(e.document_number, e.raw_payload) = entry_driver_document_digits then 1
              when entry_driver_search <> ''
                and public.build_active_employee_search_text(
                  e.full_name,
                  e.document_number,
                  e.job_title,
                  e.contract_code,
                  e.area_name,
                  e.raw_payload
                ) like '%' || entry_driver_search || '%' then 2
              else 9
            end as match_priority,
            case
              when entry_driver_area_search <> ''
                and public.normalize_recruitment_search_text(coalesce(e.area_name, '')) like '%' || entry_driver_area_search || '%' then 0
              else 1
            end as area_priority
          from public.employees_active_current e
          where
            (
              entry_driver_buk_employee_id is not null
              and e.buk_employee_id = entry_driver_buk_employee_id
            )
            or (
              entry_driver_document_digits is not null
              and public.build_employee_document_digits(e.document_number, e.raw_payload) = entry_driver_document_digits
            )
            or (
              entry_driver_search <> ''
              and public.build_active_employee_search_text(
                e.full_name,
                e.document_number,
                e.job_title,
                e.contract_code,
                e.area_name,
                e.raw_payload
              ) like '%' || entry_driver_search || '%'
            )
        ) candidate
       where candidate.identity_rank = 1
         and candidate.match_priority < 9
       order by candidate.match_priority, candidate.area_priority, candidate.full_name asc
       limit 1;

      select
        rs.base_status,
        rs.effective_status
        into
          resolved_driver_base_status,
          resolved_driver_effective_status
        from public.resolve_hr_roster_day_status(
          resolved_driver_buk_employee_id,
          (entry_item->>'serviceDate')::date
        ) rs;

      resolved_driver_shift_status := public.map_operations_driver_shift_status(resolved_driver_effective_status);
    else
      resolved_equipment_code := null;
      resolved_equipment_plate := null;
      resolved_equipment_type := null;
      resolved_equipment_client := null;
      resolved_driver_buk_employee_id := null;
      resolved_driver_name := null;
      resolved_driver_document := null;
      resolved_driver_area := null;
      resolved_driver_base_status := null;
      resolved_driver_effective_status := null;
      resolved_driver_shift_status := null;
    end if;

    lock_key := concat_ws(
      ':',
      current_user_id::text,
      entry_item->>'serviceDate',
      lower(entry_item->>'shift'),
      resolved_contract_id::text,
      resolved_service_id::text
    );
    perform pg_advisory_xact_lock(hashtext(lock_key));

    existing_entry_id := null;

    select se.id
      into existing_entry_id
      from public.service_entries se
     where se.service_date = (entry_item->>'serviceDate')::date
       and se.shift = lower(entry_item->>'shift')
       and se.contract_id = resolved_contract_id
       and se.base_service_id = resolved_service_id
       and se.created_by = current_user_id
     order by se.created_at desc
     limit 1
     for update;

    if existing_entry_id is null then
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
      values (
        (entry_item->>'serviceDate')::date,
        lower(entry_item->>'shift'),
        resolved_service_id,
        resolved_contract_id,
        resolved_contract_code,
        resolved_service_operational_name,
        resolved_service_contractual_name,
        resolved_service_contractual_category,
        resolved_service_company_name,
        entry_service_execution_status,
        nullif(entry_service_execution_note, ''),
        resolved_driver_buk_employee_id,
        resolved_driver_name,
        resolved_driver_document,
        resolved_driver_area,
        resolved_driver_shift_status,
        case when entry_service_execution_status = 'planned' then 'roster' else null end,
        resolved_driver_base_status,
        resolved_driver_effective_status,
        resolved_equipment_code,
        resolved_equipment_plate,
        resolved_equipment_type,
        resolved_equipment_client,
        current_user_id
      );
    else
      update public.service_entries
         set service_date = (entry_item->>'serviceDate')::date,
             shift = lower(entry_item->>'shift'),
             base_service_id = resolved_service_id,
             contract_id = resolved_contract_id,
             contract_code = resolved_contract_code,
             service_operational_name = resolved_service_operational_name,
             service_contractual_name = resolved_service_contractual_name,
             service_category = resolved_service_contractual_category,
             service_company = resolved_service_company_name,
             service_execution_status = entry_service_execution_status,
             service_execution_note = nullif(entry_service_execution_note, ''),
             driver_buk_employee_id = resolved_driver_buk_employee_id,
             driver_name = resolved_driver_name,
             driver_document = resolved_driver_document,
             driver_area = resolved_driver_area,
             driver_shift_status = resolved_driver_shift_status,
             driver_shift_source = case when entry_service_execution_status = 'planned' then 'roster' else null end,
             driver_roster_base_status = resolved_driver_base_status,
             driver_roster_effective_status = resolved_driver_effective_status,
             equipment_code = resolved_equipment_code,
             equipment_plate = resolved_equipment_plate,
             equipment_type = resolved_equipment_type,
             equipment_client = resolved_equipment_client
       where id = existing_entry_id;
    end if;

    saved_count := saved_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saved_count', saved_count);
end;
$function$;

revoke all on function public.submit_service_entries_batch(jsonb) from public, anon;
grant execute on function public.submit_service_entries_batch(jsonb) to authenticated;

commit;
