begin;

create or replace function public.submit_internal_mobility_request(
  p_buk_employee_id text,
  p_recruitment_case_id uuid,
  p_motive text,
  p_requester_signed boolean default false
)
returns table (
  request_id uuid,
  folio text,
  status text,
  requires_termination boolean,
  current_company_name text,
  destination_company_name text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  requester_profile public.profiles%rowtype;
  worker_record record;
  case_record record;
  case_metrics record;
  area_manager_record public.cost_center_approvers%rowtype;
  area_manager_profile public.profiles%rowtype;
  created_request_id uuid;
  request_snapshot jsonb;
  next_folio text;
  should_require_termination boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para crear solicitudes de movilidad interna';
  end if;

  if coalesce(p_requester_signed, false) is not true then
    raise exception 'Debe confirmar la firma del solicitante';
  end if;

  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    raise exception 'Debe seleccionar un trabajador activo';
  end if;

  if p_recruitment_case_id is null then
    raise exception 'Debe seleccionar un folio con cupos disponibles';
  end if;

  if nullif(trim(coalesce(p_motive, '')), '') is null then
    raise exception 'Debe ingresar el motivo del cambio';
  end if;

  select *
    into requester_profile
    from public.profiles
   where id = current_user_id
   for share;

  if requester_profile.id is null then
    raise exception 'No existe perfil para el usuario autenticado';
  end if;

  select
    e.buk_employee_id,
    e.full_name,
    coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut') as document_number,
    coalesce(e.document_type, e.raw_payload ->> 'document_type', 'rut') as document_type,
    public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as current_job_title,
    coalesce(c.code, nullif(trim(e.contract_code), '')) as current_contract_code,
    coalesce(bcm.buk_area_name, nullif(trim(e.area_name), '')) as current_area_name,
    coalesce(bcm.buk_area_code, nullif(trim(e.area_code), '')) as current_area_code,
    public.resolve_active_employee_company_name(e.raw_payload, e.area_name) as current_company_name,
    public.resolve_active_employee_shift_name(
      e.raw_payload,
      coalesce(e.document_number, e.raw_payload ->> 'document_number', e.raw_payload ->> 'rut')
    ) as current_shift_name
  into worker_record
  from public.employees_active_current e
  left join public.buk_contract_mappings bcm
    on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
   and bcm.is_operational = true
   and bcm.is_one_to_one = true
   and bcm.contract_id is not null
  left join public.contracts c
    on c.id = bcm.contract_id
   and c.is_active = true
  where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
  limit 1;

  if worker_record.buk_employee_id is null then
    raise exception 'Trabajador activo no encontrado';
  end if;

  select
    rc.id as recruitment_case_id,
    rc.case_code,
    rc.status as recruitment_case_status,
    rc.requested_vacancies,
    destination_resolution.contract_id as destination_contract_id,
    destination_resolution.contract_code as destination_contract_code,
    rc.contract_name,
    rc.job_position_name,
    rc.cost_center_code,
    rc.cost_center_name,
    hr.id as hiring_request_id,
    hr.folio,
    hr.contract_number,
    hr.shift_name,
    hr.requester_id as request_owner_id,
    destination_resolution.company_name as destination_company_name,
    destination_resolution.buk_area_code as destination_area_code
  into case_record
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  left join lateral (
    select
      bcm.contract_id,
      c.code as contract_code,
      bcm.buk_area_code,
      coalesce(
        nullif(trim(coalesce(bcm.company_name, '')), ''),
        public.resolve_known_company_name(null, hr.contract_number)
      ) as company_name
    from public.buk_contract_mappings bcm
    join public.contracts c
      on c.id = bcm.contract_id
     and c.is_active = true
    where bcm.is_operational = true
      and bcm.is_one_to_one = true
      and bcm.contract_id is not null
      and bcm.contract_number = hr.contract_number
      and (
        bcm.buk_area_name_normalized = public.normalize_buk_area_name(coalesce(hr.contract_name, rc.contract_name))
        or bcm.cost_center_code = hr.cost_center_code
      )
    order by
      case
        when bcm.buk_area_name_normalized = public.normalize_buk_area_name(coalesce(hr.contract_name, rc.contract_name))
          then 0
        else 1
      end,
      bcm.updated_at desc,
      bcm.id desc
    limit 1
  ) destination_resolution on true
  where rc.id = p_recruitment_case_id
    and public.user_can_view_hiring_request_process_summary(
      current_user_id,
      hr.requester_id,
      hr.cost_center_code
    )
  limit 1
  for update of rc;

  if case_record.recruitment_case_id is null then
    raise exception 'El folio seleccionado no existe o no está visible para tu usuario';
  end if;

  if case_record.recruitment_case_status in ('filled', 'closed_unfilled', 'cancelled') then
    raise exception 'El folio seleccionado ya no admite movilidad interna';
  end if;

  if case_record.destination_contract_id is null then
    raise exception 'El folio seleccionado no tiene contrato destino operativo resuelto';
  end if;

  select *
    into case_metrics
    from public.get_recruitment_case_effective_metrics(case_record.recruitment_case_id)
    limit 1;

  if coalesce(case_metrics.available_vacancies, 0) <= 0 then
    raise exception 'El folio seleccionado ya no tiene cupos disponibles';
  end if;

  if nullif(trim(coalesce(case_record.destination_company_name, '')), '') is null then
    raise exception 'El folio seleccionado no tiene empresa destino resuelta';
  end if;

  select *
    into area_manager_record
    from public.cost_center_approvers
   where cost_center_code = case_record.cost_center_code
     and is_active = true
   for share;

  if area_manager_record.id is null then
    raise exception 'No existe gerente configurado para el centro de costo del folio';
  end if;

  if area_manager_record.approver_user_id is null then
    raise exception 'El gerente del folio aún no tiene usuario vinculado en la plataforma';
  end if;

  select *
    into area_manager_profile
    from public.profiles area_manager_profile_row
   where area_manager_profile_row.id = area_manager_record.approver_user_id
     and area_manager_profile_row.status = 'active'
   for share;

  if area_manager_profile.id is null then
    raise exception 'El gerente del folio no tiene una cuenta activa';
  end if;

  should_require_termination :=
    worker_record.current_company_name is not null
    and worker_record.current_company_name is distinct from case_record.destination_company_name;

  next_folio := 'MI-' || lpad(nextval('public.internal_mobility_folio_seq')::text, 4, '0');

  insert into public.internal_mobility_requests (
    folio,
    requester_id,
    requester_name,
    requester_job_title,
    requester_email,
    employee_buk_employee_id,
    employee_document_number,
    employee_document_type,
    employee_full_name,
    current_job_title,
    current_contract_code,
    current_area_name,
    current_area_code,
    current_company_name,
    current_shift_name,
    recruitment_case_id,
    hiring_request_id,
    recruitment_case_code,
    source_folio,
    destination_job_title,
    destination_contract_id,
    destination_contract_code,
    destination_contract_number,
    destination_area_name,
    destination_area_code,
    destination_cost_center_code,
    destination_cost_center_name,
    destination_company_name,
    destination_shift_id,
    destination_shift_name,
    requires_termination,
    motive,
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
    worker_record.buk_employee_id,
    worker_record.document_number,
    worker_record.document_type,
    worker_record.full_name,
    worker_record.current_job_title,
    worker_record.current_contract_code,
    worker_record.current_area_name,
    worker_record.current_area_code,
    worker_record.current_company_name,
    worker_record.current_shift_name,
    case_record.recruitment_case_id,
    case_record.hiring_request_id,
    case_record.case_code,
    case_record.folio,
    case_record.job_position_name,
    case_record.destination_contract_id,
    case_record.destination_contract_code,
    case_record.contract_number,
    case_record.contract_name,
    case_record.destination_area_code,
    case_record.cost_center_code,
    case_record.cost_center_name,
    case_record.destination_company_name,
    null,
    case_record.shift_name,
    should_require_termination,
    trim(p_motive),
    'pending_area_manager',
    'area_manager',
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
    'employee_buk_employee_id', worker_record.buk_employee_id,
    'employee_document_number', worker_record.document_number,
    'employee_document_type', worker_record.document_type,
    'employee_full_name', worker_record.full_name,
    'current_job_title', worker_record.current_job_title,
    'current_contract_code', worker_record.current_contract_code,
    'current_area_name', worker_record.current_area_name,
    'current_area_code', worker_record.current_area_code,
    'current_company_name', worker_record.current_company_name,
    'current_shift_name', worker_record.current_shift_name,
    'recruitment_case_id', case_record.recruitment_case_id,
    'hiring_request_id', case_record.hiring_request_id,
    'recruitment_case_code', case_record.case_code,
    'source_folio', case_record.folio,
    'destination_job_title', case_record.job_position_name,
    'destination_contract_id', case_record.destination_contract_id,
    'destination_contract_code', case_record.destination_contract_code,
    'destination_contract_number', case_record.contract_number,
    'destination_area_name', case_record.contract_name,
    'destination_area_code', case_record.destination_area_code,
    'destination_cost_center_code', case_record.cost_center_code,
    'destination_cost_center_name', case_record.cost_center_name,
    'destination_company_name', case_record.destination_company_name,
    'destination_shift_name', case_record.shift_name,
    'requires_termination', should_require_termination,
    'motive', trim(p_motive),
    'requester_signed', true
  );

  insert into public.internal_mobility_request_snapshots (
    internal_mobility_request_id,
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

  insert into public.internal_mobility_request_approvals (
    internal_mobility_request_id,
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
  on conflict (internal_mobility_request_id, step_code) do nothing;

  insert into public.internal_mobility_request_approvals (
    internal_mobility_request_id,
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
    area_manager_record.approver_user_id,
    area_manager_record.approver_name,
    coalesce(area_manager_record.approver_email, area_manager_profile.email),
    'pending',
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
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
      'current_step_code', 'area_manager',
      'status', 'pending_area_manager'
    )
  );

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
    approval_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  )
  select
    created_request_id,
    imra.id,
    current_user_id,
    'approval_created',
    jsonb_build_object(
      'step_code', imra.step_code,
      'step_name', imra.step_name,
      'approver_user_id', imra.approver_user_id,
      'approver_name', imra.approver_name,
      'approver_email', imra.approver_email,
      'status', imra.status
    ),
    jsonb_build_object('created_by_flow', 'submit_internal_mobility_request')
  from public.internal_mobility_request_approvals imra
  where imra.internal_mobility_request_id = created_request_id
    and imra.step_code = 'area_manager';

  perform public.sync_recruitment_case_status(case_record.recruitment_case_id, current_user_id);

  return query
  select
    created_request_id,
    next_folio,
    'pending_area_manager'::text,
    should_require_termination,
    worker_record.current_company_name::text,
    case_record.destination_company_name::text;
end;
$function$;

grant execute on function public.submit_internal_mobility_request(text, uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
