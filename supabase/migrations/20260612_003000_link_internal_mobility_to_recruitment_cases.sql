begin;

alter table public.internal_mobility_requests
  add column if not exists recruitment_case_id uuid references public.recruitment_cases (id) on delete restrict,
  add column if not exists hiring_request_id uuid references public.hiring_requests (id) on delete restrict,
  add column if not exists recruitment_case_code text,
  add column if not exists source_folio text;

create index if not exists idx_internal_mobility_requests_recruitment_case_id
  on public.internal_mobility_requests (recruitment_case_id, status, created_at desc);

create index if not exists idx_internal_mobility_requests_hiring_request_id
  on public.internal_mobility_requests (hiring_request_id, status, created_at desc);

create or replace function public.get_recruitment_case_effective_metrics(
  p_case_id uuid
)
returns table (
  requested_vacancies integer,
  hired_candidate_count integer,
  ready_candidate_count integer,
  active_candidate_count integer,
  pending_mobility_count integer,
  approved_mobility_count integer,
  effective_filled_vacancies integer,
  effective_active_candidates integer,
  available_vacancies integer
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    rc.requested_vacancies,
    coalesce(candidate_stats.hired_candidate_count, 0) as hired_candidate_count,
    coalesce(candidate_stats.ready_candidate_count, 0) as ready_candidate_count,
    coalesce(candidate_stats.active_candidate_count, 0) as active_candidate_count,
    coalesce(mobility_stats.pending_mobility_count, 0) as pending_mobility_count,
    coalesce(mobility_stats.approved_mobility_count, 0) as approved_mobility_count,
    coalesce(candidate_stats.hired_candidate_count, 0) + coalesce(mobility_stats.approved_mobility_count, 0) as effective_filled_vacancies,
    coalesce(candidate_stats.active_candidate_count, 0) + coalesce(mobility_stats.pending_mobility_count, 0) as effective_active_candidates,
    greatest(
      rc.requested_vacancies - (
        coalesce(candidate_stats.hired_candidate_count, 0) + coalesce(mobility_stats.approved_mobility_count, 0)
      ),
      0
    ) as available_vacancies
  from public.recruitment_cases rc
  left join lateral (
    select
      count(*) filter (where rcc.stage_code = 'hired') as hired_candidate_count,
      count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidate_count,
      count(*) filter (where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')) as active_candidate_count
    from public.recruitment_case_candidates rcc
    where rcc.recruitment_case_id = rc.id
  ) as candidate_stats on true
  left join lateral (
    select
      count(*) filter (
        where imr.status in ('pending_area_manager', 'pending_contracts_control')
      ) as pending_mobility_count,
      count(*) filter (where imr.status = 'approved') as approved_mobility_count
    from public.internal_mobility_requests imr
    where imr.recruitment_case_id = rc.id
  ) as mobility_stats on true
  where rc.id = p_case_id;
$function$;

create or replace function public.sync_recruitment_case_status(
  p_case_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  case_record public.recruitment_cases%rowtype;
  case_metrics record;
  next_status text;
begin
  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = p_case_id
   for update;

  if case_record.id is null then
    raise exception 'No existe el caso de reclutamiento';
  end if;

  select *
    into case_metrics
    from public.get_recruitment_case_effective_metrics(p_case_id)
    limit 1;

  next_status :=
    case
      when case_record.close_reason is not null and case_record.closed_at is not null then case_record.status
      when coalesce(case_metrics.effective_filled_vacancies, 0) >= case_record.requested_vacancies then 'filled'
      when coalesce(case_metrics.effective_filled_vacancies, 0) > 0 then 'partially_filled'
      when coalesce(case_metrics.ready_candidate_count, 0) > 0 then 'ready_to_hire'
      when coalesce(case_metrics.effective_active_candidates, 0) > 0 then 'screening'
      else 'open'
    end;

  update public.recruitment_cases rc
     set filled_vacancies = coalesce(case_metrics.effective_filled_vacancies, 0),
         status = next_status,
         updated_at = timezone('utc', now())
   where rc.id = p_case_id;

  if case_record.status is distinct from next_status
     or case_record.filled_vacancies is distinct from coalesce(case_metrics.effective_filled_vacancies, 0) then
    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      p_case_id,
      coalesce(p_actor_user_id, case_record.opened_by),
      'case_status_synced',
      jsonb_build_object(
        'status', case_record.status,
        'filled_vacancies', case_record.filled_vacancies
      ),
      jsonb_build_object(
        'status', next_status,
        'filled_vacancies', coalesce(case_metrics.effective_filled_vacancies, 0)
      ),
      jsonb_build_object(
        'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
        'active_candidates', coalesce(case_metrics.active_candidate_count, 0),
        'pending_mobility_count', coalesce(case_metrics.pending_mobility_count, 0),
        'approved_mobility_count', coalesce(case_metrics.approved_mobility_count, 0),
        'effective_active_candidates', coalesce(case_metrics.effective_active_candidates, 0)
      )
    );
  end if;

  return next_status;
end;
$function$;

create or replace function public.get_internal_mobility_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'movilidad_interna') then
    raise exception 'Sin permisos para ver movilidad interna';
  end if;

  return jsonb_build_object(
    'buk_job_titles',
    coalesce((
      select jsonb_agg(job_title_value order by job_title_value)
      from (
        select distinct public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as job_title_value
        from public.employees_active_current e
        where nullif(trim(public.resolve_active_employee_job_title(e.raw_payload, e.job_title)), '') is not null
      ) job_titles
    ), '[]'::jsonb),
    'shift_catalog',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'code', s.code,
          'name', s.name,
          'active', s.is_active
        )
        order by s.name asc
      )
      from public.shifts s
      where s.is_active = true
    ), '[]'::jsonb),
    'destinations',
    '[]'::jsonb,
    'eligible_folios',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'recruitment_case_id', rc.id,
          'hiring_request_id', hr.id,
          'folio', hr.folio,
          'case_code', rc.case_code,
          'job_position_name', rc.job_position_name,
          'contract_name', rc.contract_name,
          'contract_number', hr.contract_number,
          'shift_name', hr.shift_name,
          'cost_center_code', rc.cost_center_code,
          'cost_center_name', rc.cost_center_name,
          'company_name', coalesce(
            nullif(trim(coalesce(bcm.company_name, '')), ''),
            public.resolve_known_company_name(null, hr.contract_number)
          ),
          'requested_vacancies', rc.requested_vacancies,
          'filled_vacancies', coalesce(case_metrics.effective_filled_vacancies, 0),
          'available_vacancies', coalesce(case_metrics.available_vacancies, 0),
          'pending_mobility_count', coalesce(case_metrics.pending_mobility_count, 0),
          'approved_mobility_count', coalesce(case_metrics.approved_mobility_count, 0),
          'label', concat_ws(
            ' · ',
            coalesce(hr.folio, rc.case_code),
            rc.job_position_name,
            rc.contract_name,
            'Cupos ' || coalesce(case_metrics.available_vacancies, 0) || '/' || rc.requested_vacancies
          )
        )
        order by rc.opened_at desc, coalesce(hr.folio, rc.case_code) asc
      )
      from public.recruitment_cases rc
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      left join public.contracts c
        on c.contract_number = hr.contract_number
       and c.is_active = true
      left join public.buk_contract_mappings bcm
        on bcm.contract_id = c.id
       and bcm.is_operational = true
       and bcm.is_one_to_one = true
      left join lateral public.get_recruitment_case_effective_metrics(rc.id) as case_metrics on true
      where rc.status not in ('filled', 'closed_unfilled', 'cancelled')
        and coalesce(case_metrics.available_vacancies, 0) > 0
        and public.user_can_view_hiring_request_process_summary(
          current_user_id,
          hr.requester_id,
          hr.cost_center_code
        )
    ), '[]'::jsonb)
  );
end;
$function$;

drop function if exists public.submit_internal_mobility_request(text, bigint, text, bigint, text, boolean);
drop function if exists public.submit_internal_mobility_request(text, uuid, text, boolean);
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
    c.id as destination_contract_id,
    c.code as destination_contract_code,
    rc.contract_name,
    rc.job_position_name,
    rc.cost_center_code,
    rc.cost_center_name,
    hr.id as hiring_request_id,
    hr.folio,
    hr.contract_number,
    hr.shift_name,
    hr.requester_id as request_owner_id,
    coalesce(
      nullif(trim(coalesce(bcm.company_name, '')), ''),
      public.resolve_known_company_name(null, hr.contract_number)
    ) as destination_company_name,
    bcm.buk_area_code as destination_area_code
  into case_record
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  left join public.contracts c
    on c.contract_number = hr.contract_number
   and c.is_active = true
  left join public.buk_contract_mappings bcm
    on bcm.contract_id = c.id
   and bcm.is_operational = true
   and bcm.is_one_to_one = true
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
    'destination_contract_number', case_record.contract_number,
    'destination_area_name', case_record.contract_name,
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

create or replace function public.decide_internal_mobility_request_approval(
  p_approval_id bigint,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  approval_record public.internal_mobility_request_approvals%rowtype;
  request_record public.internal_mobility_requests%rowtype;
  contracts_control_record public.workflow_approvers%rowtype;
  next_approval_id bigint;
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision invalida';
  end if;

  select *
    into approval_record
    from public.internal_mobility_request_approvals imra
   where imra.id = p_approval_id
   for update;

  if approval_record.id is null then
    raise exception 'No existe la aprobación indicada';
  end if;

  if approval_record.status <> 'pending' then
    raise exception 'La aprobación seleccionada ya fue resuelta';
  end if;

  if approval_record.step_code not in ('area_manager', 'contracts_control') then
    raise exception 'La etapa indicada no admite decisiones manuales';
  end if;

  if approval_record.approver_user_id is null
     or (approval_record.approver_user_id <> current_user_id and not public.user_is_admin(current_user_id)) then
    raise exception 'Solo el aprobador asignado puede decidir esta solicitud';
  end if;

  select *
    into request_record
    from public.internal_mobility_requests imr
   where imr.id = approval_record.internal_mobility_request_id
   for update;

  if request_record.id is null then
    raise exception 'No existe la solicitud asociada';
  end if;

  if request_record.current_step_code is distinct from approval_record.step_code then
    raise exception 'La solicitud ya no se encuentra en esta etapa';
  end if;

  update public.internal_mobility_request_approvals imra
     set status = p_decision,
         decision_by = current_user_id,
         decision_comment = nullif(trim(coalesce(p_comment, '')), ''),
         decided_at = now_utc,
         locked_at = now_utc,
         updated_at = now_utc
   where imra.id = approval_record.id;

  if p_decision = 'rejected' then
    update public.internal_mobility_requests imr
       set status = 'rejected',
           current_step_code = null,
           rejected_at = now_utc,
           approved_at = null,
           final_decided_by = current_user_id,
           updated_at = now_utc
     where imr.id = request_record.id;

    insert into public.internal_mobility_request_audit_log (
      internal_mobility_request_id,
      approval_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      request_record.id,
      approval_record.id,
      current_user_id,
      'rejected',
      jsonb_build_object(
        'approval_status', approval_record.status,
        'request_status', request_record.status,
        'current_step_code', request_record.current_step_code
      ),
      jsonb_build_object(
        'approval_status', 'rejected',
        'request_status', 'rejected',
        'current_step_code', null,
        'step_code', approval_record.step_code,
        'comment', nullif(trim(coalesce(p_comment, '')), '')
      ),
      jsonb_build_object('decided_by', current_user_id)
    );

    if request_record.recruitment_case_id is not null then
      perform public.sync_recruitment_case_status(request_record.recruitment_case_id, current_user_id);
    end if;

    return;
  end if;

  if approval_record.step_code = 'area_manager' then
    select *
      into contracts_control_record
      from public.workflow_approvers wa
     where wa.step_code = 'contracts_control'
       and wa.is_active = true
     for share;

    if contracts_control_record.step_code is null then
      raise exception 'No existe aprobador configurado para Control de Contratos';
    end if;

    if contracts_control_record.approver_user_id is null then
      raise exception 'Control de Contratos aún no tiene usuario vinculado en la plataforma';
    end if;

    if not exists (
      select 1
      from public.profiles p
      where p.id = contracts_control_record.approver_user_id
        and p.status = 'active'
    ) then
      raise exception 'El usuario configurado para Control de Contratos no tiene una cuenta activa';
    end if;

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
      request_record.id,
      'contracts_control',
      'Control de contratos',
      3,
      contracts_control_record.approver_user_id,
      contracts_control_record.approver_name,
      contracts_control_record.approver_email,
      'pending',
      now_utc,
      now_utc
    )
    on conflict (internal_mobility_request_id, step_code) do update
    set approver_user_id = excluded.approver_user_id,
        approver_name = excluded.approver_name,
        approver_email = excluded.approver_email,
        status = 'pending',
        decision_by = null,
        decision_comment = null,
        decided_at = null,
        locked_at = null,
        updated_at = now_utc
    returning id into next_approval_id;

    update public.internal_mobility_requests imr
       set status = 'pending_contracts_control',
           current_step_code = 'contracts_control',
           final_decided_by = null,
           approved_at = null,
           rejected_at = null,
           updated_at = now_utc
     where imr.id = request_record.id;

    insert into public.internal_mobility_request_audit_log (
      internal_mobility_request_id,
      approval_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      request_record.id,
      approval_record.id,
      current_user_id,
      'approved',
      jsonb_build_object(
        'approval_status', approval_record.status,
        'request_status', request_record.status,
        'current_step_code', request_record.current_step_code
      ),
      jsonb_build_object(
        'approval_status', 'approved',
        'request_status', 'pending_contracts_control',
        'current_step_code', 'contracts_control',
        'step_code', approval_record.step_code,
        'comment', nullif(trim(coalesce(p_comment, '')), '')
      ),
      jsonb_build_object('decided_by', current_user_id)
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
      request_record.id,
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
      jsonb_build_object('created_by_flow', 'decide_internal_mobility_request_approval')
    from public.internal_mobility_request_approvals imra
    where imra.id = next_approval_id;

    return;
  end if;

  update public.internal_mobility_requests imr
     set status = 'approved',
         current_step_code = null,
         approved_at = now_utc,
         rejected_at = null,
         final_decided_by = current_user_id,
         updated_at = now_utc
   where imr.id = request_record.id;

  insert into public.internal_mobility_request_audit_log (
    internal_mobility_request_id,
    approval_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  )
  values (
    request_record.id,
    approval_record.id,
    current_user_id,
    'approved',
    jsonb_build_object(
      'approval_status', approval_record.status,
      'request_status', request_record.status,
      'current_step_code', request_record.current_step_code
    ),
    jsonb_build_object(
      'approval_status', 'approved',
      'request_status', 'approved',
      'current_step_code', null,
      'step_code', approval_record.step_code,
      'comment', nullif(trim(coalesce(p_comment, '')), '')
    ),
    jsonb_build_object('decided_by', current_user_id)
  );

  if request_record.recruitment_case_id is not null then
    perform public.sync_recruitment_case_status(request_record.recruitment_case_id, current_user_id);
  end if;

  perform public.enqueue_internal_mobility_recruitment_handoff_email(request_record.id);
end;
$function$;

create or replace function public.get_internal_mobility_request_detail(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  detail_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_view_internal_mobility_request(current_user_id, p_request_id) then
    raise exception 'Sin permisos para ver esta solicitud';
  end if;

  select jsonb_build_object(
    'request',
    jsonb_build_object(
      'id', imr.id,
      'folio', imr.folio,
      'status', imr.status,
      'requester_name', imr.requester_name,
      'requester_job_title', imr.requester_job_title,
      'requester_email', imr.requester_email,
      'employee_buk_employee_id', imr.employee_buk_employee_id,
      'employee_document_number', imr.employee_document_number,
      'employee_document_type', imr.employee_document_type,
      'employee_full_name', imr.employee_full_name,
      'current_job_title', imr.current_job_title,
      'current_contract_code', imr.current_contract_code,
      'current_area_name', imr.current_area_name,
      'current_area_code', imr.current_area_code,
      'current_company_name', imr.current_company_name,
      'current_shift_name', imr.current_shift_name,
      'recruitment_case_id', imr.recruitment_case_id,
      'hiring_request_id', imr.hiring_request_id,
      'recruitment_case_code', imr.recruitment_case_code,
      'source_folio', imr.source_folio,
      'destination_job_title', imr.destination_job_title,
      'destination_contract_id', imr.destination_contract_id,
      'destination_contract_code', imr.destination_contract_code,
      'destination_contract_number', imr.destination_contract_number,
      'destination_area_name', imr.destination_area_name,
      'destination_area_code', imr.destination_area_code,
      'destination_cost_center_code', imr.destination_cost_center_code,
      'destination_cost_center_name', imr.destination_cost_center_name,
      'destination_company_name', imr.destination_company_name,
      'destination_shift_id', imr.destination_shift_id,
      'destination_shift_name', imr.destination_shift_name,
      'requires_termination', imr.requires_termination,
      'motive', imr.motive,
      'current_step_code', imr.current_step_code,
      'submitted_at', imr.submitted_at,
      'approved_at', imr.approved_at,
      'rejected_at', imr.rejected_at,
      'created_at', imr.created_at,
      'updated_at', imr.updated_at
    ),
    'approvals',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', imra.id,
          'step_code', imra.step_code,
          'step_name', imra.step_name,
          'step_order', imra.step_order,
          'approver_user_id', imra.approver_user_id,
          'approver_name', imra.approver_name,
          'approver_email', imra.approver_email,
          'status', imra.status,
          'decision_comment', imra.decision_comment,
          'decided_at', imra.decided_at,
          'created_at', imra.created_at
        )
        order by imra.step_order asc, imra.created_at asc
      )
      from public.internal_mobility_request_approvals imra
      where imra.internal_mobility_request_id = imr.id
    ), '[]'::jsonb),
    'audit_log',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', imral.id,
          'action_type', imral.action_type,
          'actor_user_id', imral.actor_user_id,
          'actor_name', actor_profile.full_name,
          'created_at', imral.created_at,
          'old_values', imral.old_values,
          'new_values', imral.new_values,
          'metadata', imral.metadata
        )
        order by imral.created_at desc, imral.id desc
      )
      from public.internal_mobility_request_audit_log imral
      left join public.profiles actor_profile
        on actor_profile.id = imral.actor_user_id
      where imral.internal_mobility_request_id = imr.id
    ), '[]'::jsonb)
  )
  into detail_payload
  from public.internal_mobility_requests imr
  where imr.id = p_request_id;

  if detail_payload is null then
    raise exception 'No existe la solicitud indicada';
  end if;

  return detail_payload;
end;
$function$;

create or replace function public.get_dashboard_home_bundle(
  p_birthdays_limit integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  active_folios jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select coalesce(
    jsonb_agg(case_row.payload order by case_row.sort_opened_at desc),
    '[]'::jsonb
  )
  into active_folios
  from (
    select
      jsonb_build_object(
        'id', rc.id,
        'case_code', rc.case_code,
        'status', rc.status,
        'requested_vacancies', rc.requested_vacancies,
        'filled_vacancies', coalesce(case_metrics.effective_filled_vacancies, 0),
        'title', rc.title,
        'contract_name', rc.contract_name,
        'job_position_name', rc.job_position_name,
        'cost_center_code', rc.cost_center_code,
        'cost_center_name', rc.cost_center_name,
        'requested_entry_date', rc.requested_entry_date,
        'target_close_date', rc.target_close_date,
        'opened_at', rc.opened_at,
        'requester_name', hr.requester_name,
        'requester_email', hr.requester_email,
        'hiring_request_status', hr.status,
        'can_close_request', public.user_can_close_hiring_request(current_user_id, hr.id),
        'owner_name', owner_profile.full_name,
        'owner_user_id', owner_assignment.user_id,
        'candidate_count', coalesce(case_metrics.effective_active_candidates, 0),
        'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
        'hired_candidates', coalesce(case_metrics.effective_filled_vacancies, 0),
        'mobility_active_count', coalesce(case_metrics.pending_mobility_count, 0),
        'mobility_approved_count', coalesce(case_metrics.approved_mobility_count, 0)
      ) as payload,
      rc.opened_at as sort_opened_at
    from public.recruitment_cases rc
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
    left join lateral public.get_recruitment_case_effective_metrics(rc.id) as case_metrics on true
    where rc.status in ('open', 'sourcing', 'screening', 'ready_to_hire', 'partially_filled')
      and public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
    order by rc.opened_at desc
    limit 25
  ) as case_row;

  return jsonb_build_object(
    'tasks_data',
    coalesce(public.get_dashboard_tasks(current_user_id)::jsonb, '[]'::jsonb),
    'approval_tracking_data',
    coalesce(public.get_dashboard_approval_tracking()::jsonb, '[]'::jsonb),
    'active_folios_data',
    active_folios,
    'birthdays_data',
    coalesce(
      public.get_upcoming_birthdays(greatest(coalesce(p_birthdays_limit, 6), 1)),
      '[]'::jsonb
    )
  );
end;
$function$;

create or replace function public.get_recruitment_control_dashboard_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_access_candidate_control boolean := false;
  summary jsonb := '{}'::jsonb;
  pending_approvals jsonb := '[]'::jsonb;
  active_cases jsonb := '[]'::jsonb;
  candidate_control jsonb := '[]'::jsonb;
  personnel_to_hire jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_access_candidate_control := public.user_can_access_candidate_control(current_user_id);

  select jsonb_build_object(
    'pending_contracts_control', count(*) filter (
      where hra.step_code = 'contracts_control' and hra.status = 'pending'
    ),
    'active_cases', count(*) filter (where rc.status not in ('filled', 'closed_unfilled', 'cancelled')),
    'ready_to_hire_cases', count(*) filter (where rc.status = 'ready_to_hire'),
    'filled_cases', count(*) filter (where rc.status = 'filled'),
    'total_cases', count(*)
  )
    into summary
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  left join public.hiring_request_approvals hra
    on hra.hiring_request_id = rc.hiring_request_id
   and hra.step_code = 'contracts_control'
   and hra.status = 'pending'
  where public.user_can_view_hiring_request_process_summary(
    current_user_id,
    hr.requester_id,
    hr.cost_center_code
  );

  select coalesce(
    jsonb_agg(queue_row.payload order by queue_row.sort_created_at asc, queue_row.sort_id asc),
    '[]'::jsonb
  )
    into pending_approvals
  from (
    select
      jsonb_build_object(
        'id', hra.id,
        'step_code', hra.step_code,
        'step_name', hra.step_name,
        'hiring_request_id', hra.hiring_request_id,
        'approver_user_id', hra.approver_user_id,
        'approver_name', hra.approver_name,
        'approver_email', hra.approver_email,
        'created_at', hra.created_at,
        'hiring_requests', jsonb_build_object(
          'folio', hr.folio,
          'status', hr.status,
          'requester_name', hr.requester_name,
          'requester_email', hr.requester_email,
          'contract_name', hr.contract_name,
          'contract_number', hr.contract_number,
          'job_position_name', hr.job_position_name,
          'vacancies', hr.vacancies,
          'requested_entry_date', hr.requested_entry_date,
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'travel_methodology', hr.travel_methodology,
          'other_benefits', hr.other_benefits
        )
      ) as payload,
      hra.created_at as sort_created_at,
      hra.id as sort_id
    from public.hiring_request_approvals hra
    join public.hiring_requests hr
      on hr.id = hra.hiring_request_id
    where hra.step_code in ('area_manager', 'contracts_control')
      and hra.status = 'pending'
      and hr.status not in ('closed', 'rejected')
      and (
        public.user_is_admin(current_user_id)
        or public.user_has_role(current_user_id, 'reclutamiento')
        or hra.approver_user_id = current_user_id
        or (
          hra.step_code = 'contracts_control'
          and public.user_has_role(current_user_id, 'control_contratos')
        )
      )
    order by hra.created_at asc, hra.id asc
    limit 20
  ) as queue_row;

  select coalesce(
    jsonb_agg(case_row.payload order by case_row.sort_opened_at desc),
    '[]'::jsonb
  )
    into active_cases
  from (
    select *
    from (
      select
        jsonb_build_object(
          'id', rc.id,
          'source_type', 'case',
          'hiring_request_id', hr.id,
          'folio', hr.folio,
          'case_code', rc.case_code,
          'status', rc.status,
          'requested_vacancies', rc.requested_vacancies,
          'filled_vacancies', coalesce(case_metrics.effective_filled_vacancies, 0),
          'title', rc.title,
          'contract_name', rc.contract_name,
          'job_position_name', rc.job_position_name,
          'cost_center_code', rc.cost_center_code,
          'cost_center_name', rc.cost_center_name,
          'requested_entry_date', rc.requested_entry_date,
          'target_close_date', rc.target_close_date,
          'opened_at', rc.opened_at,
          'requester_name', hr.requester_name,
          'requester_email', hr.requester_email,
          'hiring_request_status', hr.status,
          'can_close_request', public.user_can_close_hiring_request(current_user_id, hr.id),
          'owner_name', owner_profile.full_name,
          'owner_user_id', owner_assignment.user_id,
          'candidate_count', coalesce(case_metrics.effective_active_candidates, 0),
          'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
          'hired_candidates', coalesce(case_metrics.effective_filled_vacancies, 0),
          'mobility_active_count', coalesce(case_metrics.pending_mobility_count, 0),
          'mobility_approved_count', coalesce(case_metrics.approved_mobility_count, 0),
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'travel_methodology', hr.travel_methodology,
          'other_benefits', hr.other_benefits,
          'approval_summary', case
            when latest_approval.id is null then null
            else jsonb_build_object(
              'step_name', latest_approval.step_name,
              'status', latest_approval.status,
              'decision_comment', latest_approval.decision_comment,
              'decided_at', latest_approval.decided_at,
              'decided_by_name', latest_approval.decided_by_name
            )
          end
        ) as payload,
        rc.opened_at as sort_opened_at
      from public.recruitment_cases rc
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
      left join lateral public.get_recruitment_case_effective_metrics(rc.id) as case_metrics on true
      left join lateral (
        select
          hra.id,
          hra.step_name,
          hra.status,
          hra.decision_comment,
          hra.decided_at,
          decision_profile.full_name as decided_by_name
        from public.hiring_request_approvals hra
        left join public.profiles decision_profile
          on decision_profile.id = hra.decision_by
        where hra.hiring_request_id = hr.id
        order by coalesce(hra.decided_at, hra.created_at) desc, hra.id desc
        limit 1
      ) as latest_approval on true
      where public.user_can_view_hiring_request_process_summary(
        current_user_id,
        hr.requester_id,
        hr.cost_center_code
      )

      union all

      select
        jsonb_build_object(
          'id', hr.id,
          'source_type', 'request',
          'hiring_request_id', hr.id,
          'folio', hr.folio,
          'case_code', coalesce(hr.folio, 'Sin folio'),
          'status', 'cancelled',
          'requested_vacancies', coalesce(hr.vacancies, 0),
          'filled_vacancies', 0,
          'title', coalesce(hr.folio, 'Borrador') || ' - ' || hr.job_position_name,
          'contract_name', hr.contract_name,
          'job_position_name', hr.job_position_name,
          'cost_center_code', hr.cost_center_code,
          'cost_center_name', hr.cost_center_name,
          'requested_entry_date', hr.requested_entry_date,
          'target_close_date', null,
          'opened_at', coalesce(hr.rejected_at, hr.updated_at, hr.submitted_at, hr.created_at),
          'requester_name', hr.requester_name,
          'requester_email', hr.requester_email,
          'hiring_request_status', hr.status,
          'can_close_request', false,
          'owner_name', null,
          'owner_user_id', null,
          'candidate_count', 0,
          'ready_candidates', 0,
          'hired_candidates', 0,
          'mobility_active_count', 0,
          'mobility_approved_count', 0,
          'start_date', hr.start_date,
          'end_date', hr.end_date,
          'shift_name', hr.shift_name,
          'salary_offer', hr.salary_offer,
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'travel_methodology', hr.travel_methodology,
          'other_benefits', hr.other_benefits,
          'approval_summary', case
            when latest_approval.id is null then null
            else jsonb_build_object(
              'step_name', latest_approval.step_name,
              'status', latest_approval.status,
              'decision_comment', latest_approval.decision_comment,
              'decided_at', latest_approval.decided_at,
              'decided_by_name', latest_approval.decided_by_name
            )
          end
        ) as payload,
        coalesce(hr.rejected_at, hr.updated_at, hr.submitted_at, hr.created_at) as sort_opened_at
      from public.hiring_requests hr
      left join public.recruitment_cases rc
        on rc.hiring_request_id = hr.id
      left join lateral (
        select
          hra.id,
          hra.step_name,
          hra.status,
          hra.decision_comment,
          hra.decided_at,
          decision_profile.full_name as decided_by_name
        from public.hiring_request_approvals hra
        left join public.profiles decision_profile
          on decision_profile.id = hra.decision_by
        where hra.hiring_request_id = hr.id
        order by coalesce(hra.decided_at, hra.created_at) desc, hra.id desc
        limit 1
      ) as latest_approval on true
      where rc.id is null
        and hr.status in ('rejected', 'closed')
        and public.user_can_view_hiring_request_process_summary(
          current_user_id,
          hr.requester_id,
          hr.cost_center_code
        )
    ) case_union
    order by case_union.sort_opened_at desc
    limit 60
  ) as case_row;

  if can_access_candidate_control then
    select coalesce(
      jsonb_agg(
        candidate_row.payload
        order by
          candidate_row.sort_case_status_priority asc,
          candidate_row.sort_case_opened_at desc,
          candidate_row.sort_stage_rank asc,
          candidate_row.sort_candidate_created_at asc
      ),
      '[]'::jsonb
    )
      into candidate_control
    from (
      select
        jsonb_build_object(
          'id', rcc.id,
          'candidate_profile_id', cp.id,
          'recruitment_case_id', rc.id,
          'case_code', rc.case_code,
          'folio', hr.folio,
          'case_status', rc.status,
          'national_id', cp.national_id,
          'full_name', cp.full_name,
          'email', cp.email,
          'phone', cp.phone,
          'driver_license_number', cp.driver_license_number,
          'driver_license_class', cp.driver_license_class,
          'driver_license_expiry', cp.driver_license_expiry,
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'contract_name', rc.contract_name,
          'job_position_name', rc.job_position_name,
          'cost_center_code', rc.cost_center_code,
          'cost_center_name', rc.cost_center_name,
          'owner_name', owner_profile.full_name,
          'active_process_count', coalesce(active_processes.active_process_count, 0),
          'contract_locked_case_id', contract_lock.recruitment_case_id,
          'contract_locked_case_code', contract_lock.case_code,
          'contract_locked_folio', contract_lock.folio,
          'contract_locked_stage_code', contract_lock.stage_code,
          'is_contract_path_blocked', contract_lock.case_candidate_id is not null,
          'interview_notes', rcc.interview_notes
        ) as payload,
        case
          when rc.status = 'ready_to_hire' then 0
          when rc.status = 'screening' then 1
          when rc.status = 'open' then 2
          when rc.status = 'sourcing' then 3
          when rc.status = 'partially_filled' then 4
          when rc.status = 'filled' then 5
          else 6
        end as sort_case_status_priority,
        rc.opened_at as sort_case_opened_at,
        case rcc.stage_code
          when 'ready_for_hire' then 0
          when 'document_review' then 1
          when 'medical_exams' then 2
          when 'who_pending' then 3
          when 'who_approved' then 4
          when 'lead' then 5
          when 'hired' then 6
          else 7
        end as sort_stage_rank,
        rcc.created_at as sort_candidate_created_at
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
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
      left join lateral (
        select count(*) as active_process_count
        from public.recruitment_case_candidates rcc_active
        join public.recruitment_cases rc_active
          on rc_active.id = rcc_active.recruitment_case_id
        where rcc_active.candidate_profile_id = rcc.candidate_profile_id
          and rcc_active.stage_code not in ('hired', 'rejected', 'withdrawn')
          and rc_active.status not in ('filled', 'closed_unfilled', 'cancelled')
      ) as active_processes on true
      left join lateral (
        select *
        from public.find_active_candidate_contract_lock(
          rcc.candidate_profile_id,
          rcc.id
        )
        limit 1
      ) as contract_lock on true
      where public.user_can_access_recruitment_case(current_user_id, rc.id)
        and (
          (
            rc.status not in ('filled', 'closed_unfilled', 'cancelled')
            and rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
          )
          or (
            rc.status = 'cancelled'
            and hr.status = 'closed'
            and rcc.stage_code in ('rejected', 'withdrawn')
          )
        )
    ) as candidate_row;

    select coalesce(
      jsonb_agg(
        hired_row.payload
        order by
          hired_row.sort_case_opened_at desc,
          hired_row.sort_hired_at desc,
          hired_row.sort_candidate_created_at asc
      ),
      '[]'::jsonb
    )
      into personnel_to_hire
    from (
      select
        jsonb_build_object(
          'id', rcc.id,
          'candidate_profile_id', cp.id,
          'recruitment_case_id', rc.id,
          'case_code', rc.case_code,
          'folio', hr.folio,
          'case_status', rc.status,
          'national_id', cp.national_id,
          'full_name', cp.full_name,
          'email', cp.email,
          'phone', cp.phone,
          'driver_license_number', cp.driver_license_number,
          'driver_license_class', cp.driver_license_class,
          'driver_license_expiry', cp.driver_license_expiry,
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'contract_name', rc.contract_name,
          'job_position_name', rc.job_position_name,
          'cost_center_code', rc.cost_center_code,
          'cost_center_name', rc.cost_center_name,
          'owner_name', owner_profile.full_name,
          'active_process_count', 0,
          'contract_locked_case_id', null,
          'contract_locked_case_code', null,
          'contract_locked_folio', null,
          'contract_locked_stage_code', null,
          'is_contract_path_blocked', false,
          'interview_notes', rcc.interview_notes,
          'hired_at', rcc.hired_at
        ) as payload,
        rc.opened_at as sort_case_opened_at,
        coalesce(rcc.hired_at, rcc.updated_at, rcc.created_at) as sort_hired_at,
        rcc.created_at as sort_candidate_created_at
      from public.recruitment_case_candidates rcc
      join public.recruitment_cases rc
        on rc.id = rcc.recruitment_case_id
      join public.hiring_requests hr
        on hr.id = rc.hiring_request_id
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
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
      where public.user_can_access_recruitment_case(current_user_id, rc.id)
        and rcc.stage_code = 'hired'
    ) as hired_row;
  end if;

  return jsonb_build_object(
    'summary', coalesce(summary, '{}'::jsonb),
    'pending_approvals', coalesce(pending_approvals, '[]'::jsonb),
    'active_cases', coalesce(active_cases, '[]'::jsonb),
    'candidate_control', coalesce(candidate_control, '[]'::jsonb),
    'personnel_to_hire', coalesce(personnel_to_hire, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.submit_internal_mobility_request(text, uuid, text, boolean) from public, anon;
grant execute on function public.submit_internal_mobility_request(text, uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
