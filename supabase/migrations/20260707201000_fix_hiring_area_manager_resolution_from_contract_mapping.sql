begin;

create or replace function public.submit_hiring_request(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_vacancies integer,
  p_requested_entry_date date,
  p_start_date date,
  p_end_date date,
  p_campamento boolean,
  p_pasajes boolean,
  p_other_benefits text,
  p_salary_offer numeric,
  p_shift_id bigint,
  p_requester_signed boolean
)
returns table (request_id uuid, folio text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  requester_profile public.profiles%rowtype;
  contract_record public.contracts%rowtype;
  contract_mapping_record public.buk_contract_mappings%rowtype;
  job_position_record public.job_positions%rowtype;
  shift_record public.shifts%rowtype;
  area_manager_record public.cost_center_approvers%rowtype;
  area_manager_profile public.profiles%rowtype;
  contracts_control_record public.workflow_approvers%rowtype;
  request_snapshot jsonb;
  resolved_contract_name text;
  created_request_id uuid;
  next_folio text;
  initial_request_status text;
  initial_step_code text;
  skip_area_manager_approval boolean := false;
  auto_area_manager_comment text := 'Autoaprobada por coincidencia entre solicitante y gerente aprobador del centro de costo';
  area_manager_approval_id bigint;
  contracts_control_approval_id bigint;
  resolved_area_manager_user_id uuid := null;
  resolved_area_manager_name text := null;
  resolved_area_manager_email text := null;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'solicitud_contrataciones') then
    raise exception 'Sin permisos para crear solicitudes';
  end if;

  if not coalesce(p_requester_signed, false) then
    raise exception 'La solicitud debe enviarse con firma del solicitante';
  end if;

  if p_vacancies is null or p_vacancies <= 0 then
    raise exception 'La cantidad de vacantes debe ser mayor a 0';
  end if;

  if p_salary_offer is null or p_salary_offer < 0 then
    raise exception 'La renta liquida ofrecida es invalida';
  end if;

  if p_requested_entry_date is null or p_start_date is null or p_end_date is null then
    raise exception 'Faltan fechas obligatorias en la solicitud';
  end if;

  if p_end_date < p_start_date then
    raise exception 'La fecha de termino no puede ser anterior a la fecha de inicio';
  end if;

  select *
    into requester_profile
    from public.profiles
   where id = current_user_id
   for share;

  if requester_profile.id is null then
    raise exception 'No existe perfil para el usuario autenticado';
  end if;

  select *
    into contract_record
    from public.contracts
   where id = p_contract_id
     and is_active = true
   for share;

  if contract_record.id is null then
    raise exception 'Contrato invalido o inactivo';
  end if;

  select *
    into contract_mapping_record
    from public.buk_contract_mappings
   where contract_id = contract_record.id
     and is_operational = true
     and is_one_to_one = true
   order by buk_area_name
   limit 1;

  resolved_contract_name := coalesce(contract_mapping_record.buk_area_name, contract_record.contract_name);

  select *
    into job_position_record
    from public.job_positions
   where id = p_job_position_id
     and is_active = true
   for share;

  if job_position_record.id is null then
    raise exception 'Cargo invalido o inactivo';
  end if;

  select *
    into shift_record
    from public.shifts
   where id = p_shift_id
     and is_active = true
   for share;

  if shift_record.id is null then
    raise exception 'Turno invalido o inactivo';
  end if;

  if nullif(trim(coalesce(contract_mapping_record.manager_name, '')), '') is not null then
    select *
      into area_manager_profile
      from public.profiles
     where lower(trim(coalesce(full_name, ''))) = lower(trim(contract_mapping_record.manager_name))
       and status = 'active'
     order by updated_at desc
     limit 1
     for share;

    if area_manager_profile.id is not null then
      resolved_area_manager_user_id := area_manager_profile.id;
      resolved_area_manager_name := coalesce(area_manager_profile.full_name, area_manager_profile.email);
      resolved_area_manager_email := area_manager_profile.email;
    end if;
  end if;

  if resolved_area_manager_user_id is null then
    select *
      into area_manager_record
      from public.cost_center_approvers
     where cost_center_code = contract_record.cost_center_code
       and is_active = true
     for share;

    if area_manager_record.id is null then
      raise exception 'No existe gerente configurado para el centro de costo del contrato';
    end if;

    if area_manager_record.approver_user_id is null then
      raise exception 'El gerente del centro de costo aun no tiene usuario vinculado en la plataforma';
    end if;

    select *
      into area_manager_profile
      from public.profiles
     where id = area_manager_record.approver_user_id
       and status = 'active'
     for share;

    if area_manager_profile.id is null then
      raise exception 'El gerente del centro de costo no tiene una cuenta activa';
    end if;

    resolved_area_manager_user_id := area_manager_record.approver_user_id;
    resolved_area_manager_name := coalesce(area_manager_record.approver_name, area_manager_profile.full_name, area_manager_profile.email);
    resolved_area_manager_email := coalesce(area_manager_record.approver_email, area_manager_profile.email);
  end if;

  if resolved_area_manager_user_id is null then
    raise exception 'No fue posible resolver el gerente de area del contrato';
  end if;

  select *
    into contracts_control_record
    from public.workflow_approvers
   where step_code = 'contracts_control'
     and is_active = true
   for share;

  if contracts_control_record.step_code is null then
    raise exception 'No existe aprobador configurado para Control de Contratos';
  end if;

  if contracts_control_record.approver_user_id is null then
    raise exception 'Control de Contratos aun no tiene usuario vinculado en la plataforma';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = contracts_control_record.approver_user_id
      and p.status = 'active'
  ) then
    raise exception 'El usuario configurado para Control de Contratos no tiene una cuenta activa';
  end if;

  skip_area_manager_approval := resolved_area_manager_user_id = current_user_id;
  initial_request_status := case
    when skip_area_manager_approval then 'pending_contracts_control'
    else 'pending_area_manager'
  end;
  initial_step_code := case
    when skip_area_manager_approval then 'contracts_control'
    else 'area_manager'
  end;

  next_folio := lpad(nextval('public.hiring_folio_seq')::text, 4, '0');

  insert into public.hiring_requests (
    folio,
    requester_id,
    requester_name,
    requester_job_title,
    requester_email,
    requested_entry_date,
    job_position_id,
    job_position_name,
    vacancies,
    contract_id,
    contract_name,
    contract_number,
    cost_unit,
    cost_unit_name,
    cost_center_code,
    cost_center_name,
    start_date,
    end_date,
    campamento,
    pasajes,
    other_benefits,
    salary_offer,
    shift_id,
    shift_name,
    requester_signed,
    status,
    current_step_code,
    submitted_at,
    submitted_by,
    created_at,
    updated_at
  )
  values (
    next_folio,
    current_user_id,
    coalesce(requester_profile.full_name, requester_profile.email),
    requester_profile.job_title,
    requester_profile.email,
    p_requested_entry_date,
    job_position_record.id,
    job_position_record.name,
    p_vacancies,
    contract_record.id,
    resolved_contract_name,
    contract_record.contract_number,
    contract_record.cost_unit,
    contract_record.cost_unit_name,
    contract_record.cost_center_code,
    contract_record.cost_center_name,
    p_start_date,
    p_end_date,
    coalesce(p_campamento, false),
    coalesce(p_pasajes, false),
    nullif(trim(coalesce(p_other_benefits, '')), ''),
    p_salary_offer,
    shift_record.id,
    shift_record.name,
    true,
    initial_request_status,
    initial_step_code,
    timezone('utc', now()),
    current_user_id,
    timezone('utc', now()),
    timezone('utc', now())
  )
  returning id into created_request_id;

  request_snapshot := jsonb_build_object(
    'folio', next_folio,
    'requester_id', current_user_id,
    'requester_name', coalesce(requester_profile.full_name, requester_profile.email),
    'requester_job_title', requester_profile.job_title,
    'requester_email', requester_profile.email,
    'requested_entry_date', p_requested_entry_date,
    'job_position_id', job_position_record.id,
    'job_position_name', job_position_record.name,
    'vacancies', p_vacancies,
    'contract_id', contract_record.id,
    'contract_name', resolved_contract_name,
    'contract_number', contract_record.contract_number,
    'cost_unit', contract_record.cost_unit,
    'cost_unit_name', contract_record.cost_unit_name,
    'cost_center_code', contract_record.cost_center_code,
    'cost_center_name', contract_record.cost_center_name,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'campamento', coalesce(p_campamento, false),
    'pasajes', coalesce(p_pasajes, false),
    'other_benefits', nullif(trim(coalesce(p_other_benefits, '')), ''),
    'salary_offer', p_salary_offer,
    'shift_id', shift_record.id,
    'shift_name', shift_record.name,
    'requester_signed', true
  );

  insert into public.hiring_request_snapshots (
    hiring_request_id,
    snapshot_type,
    payload,
    created_by
  )
  values (
    created_request_id,
    'submitted',
    request_snapshot,
    current_user_id
  );

  insert into public.hiring_request_approvals (
    hiring_request_id,
    step_code,
    step_name,
    step_order,
    approver_user_id,
    approver_name,
    approver_email,
    status,
    decision_by,
    decision_comment,
    decided_at,
    locked_at,
    created_at,
    updated_at
  )
  values (
    created_request_id,
    'requester_signature',
    'Firma solicitante',
    1,
    current_user_id,
    coalesce(requester_profile.full_name, requester_profile.email),
    requester_profile.email,
    'approved',
    current_user_id,
    null,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (hiring_request_id, step_code) do nothing;

  if skip_area_manager_approval then
    insert into public.hiring_request_approvals (
      hiring_request_id,
      step_code,
      step_name,
      step_order,
      approver_user_id,
      approver_name,
      approver_email,
      status,
      decision_by,
      decision_comment,
      decided_at,
      locked_at,
      created_at,
      updated_at
    )
    values (
      created_request_id,
      'area_manager',
      'Gerente de area',
      2,
      resolved_area_manager_user_id,
      resolved_area_manager_name,
      resolved_area_manager_email,
      'approved',
      current_user_id,
      auto_area_manager_comment,
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id into area_manager_approval_id;

    insert into public.hiring_request_approvals (
      hiring_request_id,
      step_code,
      step_name,
      step_order,
      approver_user_id,
      approver_name,
      approver_email,
      status,
      created_at,
      updated_at
    )
    values (
      created_request_id,
      'contracts_control',
      'Control de contratos',
      3,
      contracts_control_record.approver_user_id,
      contracts_control_record.approver_name,
      contracts_control_record.approver_email,
      'pending',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id into contracts_control_approval_id;
  else
    insert into public.hiring_request_approvals (
      hiring_request_id,
      step_code,
      step_name,
      step_order,
      approver_user_id,
      approver_name,
      approver_email,
      status,
      created_at,
      updated_at
    )
    values (
      created_request_id,
      'area_manager',
      'Gerente de area',
      2,
      resolved_area_manager_user_id,
      resolved_area_manager_name,
      resolved_area_manager_email,
      'pending',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id into area_manager_approval_id;
  end if;

  insert into public.hiring_request_audit_log (
    hiring_request_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  )
  values (
    created_request_id,
    current_user_id,
    'submitted',
    request_snapshot,
    jsonb_build_object(
      'current_step_code', initial_step_code,
      'status', initial_request_status,
      'auto_skipped_area_manager', skip_area_manager_approval
    )
  );

  insert into public.hiring_request_audit_log (
    hiring_request_id,
    approval_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  )
  values (
    created_request_id,
    area_manager_approval_id,
    current_user_id,
    'approval_created',
    jsonb_build_object(
      'step_code', 'area_manager',
      'step_name', 'Gerente de area',
      'approver_user_id', resolved_area_manager_user_id,
      'approver_name', resolved_area_manager_name,
      'approver_email', resolved_area_manager_email,
      'status', case when skip_area_manager_approval then 'approved' else 'pending' end
    ),
    jsonb_build_object(
      'created_by_flow', 'submit_hiring_request',
      'auto_skipped_for_self_approval', skip_area_manager_approval
    )
  );

  if skip_area_manager_approval then
    insert into public.hiring_request_audit_log (
      hiring_request_id,
      approval_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      created_request_id,
      area_manager_approval_id,
      current_user_id,
      'approved',
      jsonb_build_object(
        'request_status', 'pending_area_manager',
        'current_step_code', 'area_manager',
        'approval_status', 'pending'
      ),
      jsonb_build_object(
        'request_status', initial_request_status,
        'current_step_code', initial_step_code,
        'approval_status', 'approved'
      ),
      jsonb_build_object(
        'step_code', 'area_manager',
        'comment', auto_area_manager_comment,
        'auto_skipped_for_self_approval', true
      )
    );

    insert into public.hiring_request_audit_log (
      hiring_request_id,
      approval_id,
      actor_user_id,
      action_type,
      new_values,
      metadata
    )
    values (
      created_request_id,
      contracts_control_approval_id,
      current_user_id,
      'approval_created',
      jsonb_build_object(
        'step_code', 'contracts_control',
        'step_name', 'Control de contratos',
        'approver_user_id', contracts_control_record.approver_user_id,
        'approver_name', contracts_control_record.approver_name,
        'approver_email', contracts_control_record.approver_email,
        'status', 'pending'
      ),
      jsonb_build_object(
        'created_by_flow', 'submit_hiring_request',
        'created_after_auto_skip', true
      )
    );
  end if;

  return query
  select created_request_id, next_folio;
end;
$function$;

grant execute on function public.submit_hiring_request(
  bigint,
  bigint,
  integer,
  date,
  date,
  date,
  boolean,
  boolean,
  text,
  numeric,
  bigint,
  boolean
) to authenticated;

notify pgrst, 'reload schema';

commit;
