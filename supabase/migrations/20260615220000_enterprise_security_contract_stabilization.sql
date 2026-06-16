begin;

create or replace function public.user_can_manage_operational_onboarding(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_actor_id is not null
    and (
      public.user_is_admin(p_actor_id)
      or public.user_can_access_module(p_actor_id, 'alta_operacional_personal')
    );
$$;

revoke all on function public.user_can_manage_operational_onboarding(uuid) from public, anon;
revoke all on function public.user_can_manage_operational_onboarding(uuid) from authenticated;

create or replace function public.submit_service_entries_batch(p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  existing_entry_id text;
  lock_key text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.user_can_access_module(current_user_id, 'operaciones') then
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

    if lower(coalesce(entry_item->>'driverShiftStatus', '')) not in ('roster', 'extra', 'unassigned') then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('driverShiftStatus', 'Estado de conductor inválido.')
      );
      continue;
    end if;

    if nullif(trim(entry_item->>'equipmentCode'), '') is null then
      errors := errors || jsonb_build_object(
        'index', entry_index - 1,
        'service_id', entry_item->>'serviceId',
        'field_errors', jsonb_build_object('equipmentCode', 'Equipo requerido.')
      );
      continue;
    end if;

    select c.id, c.code
      into resolved_contract_id, resolved_contract_code
      from public.contracts c
     where c.code = nullif(trim(entry_item->>'contractCode'), '')
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
  end loop;

  if jsonb_array_length(errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', errors);
  end if;

  for entry_item, entry_index in
    select value, ordinality::integer
    from jsonb_array_elements(p_entries) with ordinality
  loop
    select c.id, c.code
      into resolved_contract_id, resolved_contract_code
      from public.contracts c
     where c.code = nullif(trim(entry_item->>'contractCode'), '')
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

    select se.id::text
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
        driver_name,
        driver_document,
        driver_area,
        driver_shift_status,
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
        nullif(trim(entry_item->>'driverName'), ''),
        nullif(trim(entry_item->>'driverDocument'), ''),
        nullif(trim(entry_item->>'driverArea'), ''),
        lower(nullif(trim(entry_item->>'driverShiftStatus'), '')),
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
             driver_name = nullif(trim(entry_item->>'driverName'), ''),
             driver_document = nullif(trim(entry_item->>'driverDocument'), ''),
             driver_area = nullif(trim(entry_item->>'driverArea'), ''),
             driver_shift_status = lower(nullif(trim(entry_item->>'driverShiftStatus'), '')),
             equipment_code = resolved_equipment_code,
             equipment_plate = resolved_equipment_plate,
             equipment_type = resolved_equipment_type,
             equipment_client = resolved_equipment_client
       where id::text = existing_entry_id;
    end if;

    saved_count := saved_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saved_count', saved_count);
end;
$$;

revoke all on function public.submit_service_entries_batch(jsonb) from public, anon;
grant execute on function public.submit_service_entries_batch(jsonb) to authenticated;

create or replace function public.get_operational_onboarding_templates()
returns setof public.onboarding_templates
language sql
stable
security definer
set search_path = public
as $$
  select ot.*
    from public.onboarding_templates ot
   where public.user_can_manage_operational_onboarding(auth.uid())
   order by ot.created_at desc;
$$;

revoke all on function public.get_operational_onboarding_templates() from public, anon;
grant execute on function public.get_operational_onboarding_templates() to authenticated;

create or replace function public.get_operational_onboarding_template_tasks(p_template_id uuid)
returns setof public.onboarding_template_tasks
language sql
stable
security definer
set search_path = public
as $$
  select ott.*
    from public.onboarding_template_tasks ott
   where public.user_can_manage_operational_onboarding(auth.uid())
     and ott.template_id = p_template_id
   order by ott.order_index asc, ott.created_at asc;
$$;

revoke all on function public.get_operational_onboarding_template_tasks(uuid) from public, anon;
grant execute on function public.get_operational_onboarding_template_tasks(uuid) to authenticated;

create or replace function public.get_operational_onboarding_cases()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_payload order by created_at desc), '[]'::jsonb)
  from (
    select
      eoc.created_at,
      jsonb_build_object(
        'id', eoc.id,
        'employee_id', eoc.employee_id,
        'candidate_id', eoc.candidate_id,
        'hiring_request_id', eoc.hiring_request_id,
        'template_id', eoc.template_id,
        'status', eoc.status,
        'cargo', eoc.cargo,
        'contrato', eoc.contrato,
        'faena', eoc.faena,
        'division', eoc.division,
        'centro_costo', eoc.centro_costo,
        'target_ready_date', eoc.target_ready_date,
        'progress_percent', eoc.progress_percent,
        'total_tasks', eoc.total_tasks,
        'completed_tasks', eoc.completed_tasks,
        'expired_tasks', eoc.expired_tasks,
        'blocking_pending_tasks', eoc.blocking_pending_tasks,
        'created_at', eoc.created_at,
        'updated_at', eoc.updated_at,
        'candidates', case when cp.id is null then null else jsonb_build_object(
          'full_name', cp.full_name,
          'email', cp.email,
          'national_id', cp.national_id
        ) end,
        'employees', case when emp.id is null then null else jsonb_build_object(
          'full_name', emp.full_name,
          'email', emp.email,
          'document_number', emp.document_number
        ) end
      ) as row_payload
    from public.employee_onboarding_cases eoc
    left join public.candidate_profiles cp on cp.id = eoc.candidate_id
    left join public.employees emp on emp.id = eoc.employee_id
    where public.user_can_manage_operational_onboarding(auth.uid())
  ) rows;
$$;

revoke all on function public.get_operational_onboarding_cases() from public, anon;
grant execute on function public.get_operational_onboarding_cases() to authenticated;

create or replace function public.get_operational_onboarding_tasks()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_payload order by created_at desc), '[]'::jsonb)
  from (
    select
      eot.created_at,
      jsonb_build_object(
        'id', eot.id,
        'case_id', eot.case_id,
        'template_task_id', eot.template_task_id,
        'area_responsible', eot.area_responsible,
        'owner_user_id', eot.owner_user_id,
        'role_responsible', eot.role_responsible,
        'task_name', eot.task_name,
        'task_description', eot.task_description,
        'status', eot.status,
        'is_required', eot.is_required,
        'is_blocking', eot.is_blocking,
        'requires_evidence', eot.requires_evidence,
        'evidence_type', eot.evidence_type,
        'due_at', eot.due_at,
        'started_at', eot.started_at,
        'completed_at', eot.completed_at,
        'completed_by', eot.completed_by,
        'rejected_at', eot.rejected_at,
        'rejected_by', eot.rejected_by,
        'rejection_reason', eot.rejection_reason,
        'close_comment', eot.close_comment,
        'order_index', eot.order_index,
        'created_at', eot.created_at,
        'updated_at', eot.updated_at,
        'cases', jsonb_build_object(
          'candidates', case when cp.id is null then null else jsonb_build_object('full_name', cp.full_name) end,
          'employees', case when emp.id is null then null else jsonb_build_object('full_name', emp.full_name) end
        )
      ) as row_payload
    from public.employee_onboarding_tasks eot
    join public.employee_onboarding_cases eoc on eoc.id = eot.case_id
    left join public.candidate_profiles cp on cp.id = eoc.candidate_id
    left join public.employees emp on emp.id = eoc.employee_id
    where public.user_can_manage_operational_onboarding(auth.uid())
  ) rows;
$$;

revoke all on function public.get_operational_onboarding_tasks() from public, anon;
grant execute on function public.get_operational_onboarding_tasks() to authenticated;

create or replace function public.get_operational_onboarding_activity_log()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_payload order by created_at desc), '[]'::jsonb)
  from (
    select
      eoal.created_at,
      jsonb_build_object(
        'id', eoal.id,
        'case_id', eoal.case_id,
        'task_id', eoal.task_id,
        'action', eoal.action,
        'old_value', eoal.old_value,
        'new_value', eoal.new_value,
        'comment', eoal.comment,
        'created_by', eoal.created_by,
        'created_at', eoal.created_at,
        'profiles', case when p.id is null then null else jsonb_build_object('full_name', p.full_name) end,
        'tasks', case when eot.id is null then null else jsonb_build_object('task_name', eot.task_name) end,
        'cases', jsonb_build_object(
          'candidates', case when cp.id is null then null else jsonb_build_object('full_name', cp.full_name) end,
          'employees', case when emp.id is null then null else jsonb_build_object('full_name', emp.full_name) end
        )
      ) as row_payload
    from public.employee_onboarding_activity_log eoal
    join public.employee_onboarding_cases eoc on eoc.id = eoal.case_id
    left join public.employee_onboarding_tasks eot on eot.id = eoal.task_id
    left join public.profiles p on p.id = eoal.created_by
    left join public.candidate_profiles cp on cp.id = eoc.candidate_id
    left join public.employees emp on emp.id = eoc.employee_id
    where public.user_can_manage_operational_onboarding(auth.uid())
  ) rows;
$$;

revoke all on function public.get_operational_onboarding_activity_log() from public, anon;
grant execute on function public.get_operational_onboarding_activity_log() to authenticated;

create or replace function public.get_operational_onboarding_candidate_profiles()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cp.id,
    'full_name', cp.full_name,
    'national_id', cp.national_id,
    'status', cp.status
  ) order by cp.created_at desc), '[]'::jsonb)
  from public.candidate_profiles cp
  where public.user_can_manage_operational_onboarding(auth.uid());
$$;

revoke all on function public.get_operational_onboarding_candidate_profiles() from public, anon;
grant execute on function public.get_operational_onboarding_candidate_profiles() to authenticated;

create or replace function public.user_can_access_candidate_document_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  current_user_id uuid;
  first_folder text;
  case_candidate_id uuid;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return false;
  end if;

  first_folder := (storage.foldername(p_object_name))[1];

  if first_folder is null or first_folder !~* uuid_pattern then
    return false;
  end if;

  case_candidate_id := first_folder::uuid;

  return exists (
    select 1
      from public.recruitment_case_candidates rcc
     where rcc.id = case_candidate_id
       and public.user_can_view_recruitment_case(current_user_id, rcc.recruitment_case_id)
  );
end;
$$;

revoke all on function public.user_can_access_candidate_document_object(text) from public, anon;
grant execute on function public.user_can_access_candidate_document_object(text) to authenticated;

drop policy if exists "Authenticated users can upload candidate docs" on storage.objects;
drop policy if exists "Authenticated users can read candidate docs" on storage.objects;
drop policy if exists "Authenticated users can update candidate docs" on storage.objects;
drop policy if exists "Authenticated users can delete candidate docs" on storage.objects;
drop policy if exists "candidate_docs_insert_scoped" on storage.objects;
drop policy if exists "candidate_docs_select_scoped" on storage.objects;
drop policy if exists "candidate_docs_update_scoped" on storage.objects;
drop policy if exists "candidate_docs_delete_scoped" on storage.objects;

create policy "candidate_docs_insert_scoped"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'candidate-docs'
  and public.user_can_access_candidate_document_object(name)
);

create policy "candidate_docs_select_scoped"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'candidate-docs'
  and public.user_can_access_candidate_document_object(name)
);

create policy "candidate_docs_update_scoped"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'candidate-docs'
  and public.user_can_access_candidate_document_object(name)
)
with check (
  bucket_id = 'candidate-docs'
  and public.user_can_access_candidate_document_object(name)
);

create policy "candidate_docs_delete_scoped"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'candidate-docs'
  and public.user_can_access_candidate_document_object(name)
);

revoke insert, update, delete on public.onboarding_templates from authenticated;
revoke insert, update, delete on public.onboarding_template_tasks from authenticated;
revoke insert, update, delete on public.employee_onboarding_cases from authenticated;
revoke insert, update, delete on public.employee_onboarding_tasks from authenticated;
revoke insert, update, delete on public.employee_onboarding_evidence from authenticated;
revoke insert, update, delete on public.employee_onboarding_activity_log from authenticated;

notify pgrst, 'reload schema';

commit;
