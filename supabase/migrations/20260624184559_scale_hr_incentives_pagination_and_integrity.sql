begin;

alter table public.hr_incentive_requests
  add column if not exists area_manager_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists area_manager_name text,
  add column if not exists area_manager_email text;

with area_manager_snapshots as (
  select distinct on (hira.incentive_request_id)
    hira.incentive_request_id,
    hira.approver_user_id,
    nullif(trim(coalesce(hira.approver_name, '')), '') as approver_name,
    nullif(trim(coalesce(hira.approver_email, '')), '') as approver_email
  from public.hr_incentive_request_approvals hira
  where hira.step_code = 'area_manager'
  order by hira.incentive_request_id, hira.created_at desc, hira.id desc
)
update public.hr_incentive_requests hir
set
  area_manager_user_id = coalesce(snapshot.approver_user_id, hir.area_manager_user_id),
  area_manager_name = coalesce(snapshot.approver_name, hir.area_manager_name),
  area_manager_email = coalesce(snapshot.approver_email, hir.area_manager_email)
from area_manager_snapshots snapshot
where snapshot.incentive_request_id = hir.id
  and (
    hir.area_manager_user_id is distinct from snapshot.approver_user_id
    or hir.area_manager_name is distinct from snapshot.approver_name
    or hir.area_manager_email is distinct from snapshot.approver_email
  );

update public.hr_incentive_requests hir
set period_code = public.resolve_hr_incentive_period_code(hir.service_date)
where hir.period_code is distinct from public.resolve_hr_incentive_period_code(hir.service_date);

alter table public.hr_incentive_requests
  drop constraint if exists hr_incentive_requests_period_code_matches_service_date;

alter table public.hr_incentive_requests
  add constraint hr_incentive_requests_period_code_matches_service_date
  check (period_code = public.resolve_hr_incentive_period_code(service_date));

alter table public.hr_incentive_request_approvals
  drop constraint if exists hr_incentive_request_approvals_pending_requires_approver;

alter table public.hr_incentive_request_approvals
  add constraint hr_incentive_request_approvals_pending_requires_approver
  check (status <> 'pending' or approver_user_id is not null);

create unique index if not exists idx_hr_incentive_request_approvals_single_pending_per_request
  on public.hr_incentive_request_approvals (incentive_request_id)
  where status = 'pending';

create index if not exists idx_hr_incentive_requests_created_at_folio
  on public.hr_incentive_requests (created_at desc, folio desc);

create index if not exists idx_hr_incentive_requests_contract_created_at
  on public.hr_incentive_requests (selected_contract_code, created_at desc, folio desc);

create index if not exists idx_hr_incentive_requests_employee_buk_created_at
  on public.hr_incentive_requests (employee_buk_employee_id, created_at desc);

create index if not exists idx_hr_incentive_requests_rest_day_reconcile_lookup
  on public.hr_incentive_requests (
    employee_buk_employee_id,
    service_date,
    created_at desc
  )
  where declared_rest_day is true
    and status in ('P', 'E', 'F');

drop trigger if exists trg_hr_incentive_requests_period_integrity_audit
  on public.hr_incentive_requests;

create or replace function public.get_hr_incentive_setup_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para administrar incentivos';
  end if;

  return jsonb_build_object(
    'buk_job_titles',
    coalesce((
      with active_job_titles as (
        select distinct
          coalesce(
            nullif(trim(e.job_title), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
            nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
            nullif(trim(e.raw_payload ->> 'job_title'), '')
          ) as resolved_job_title
        from public.employees_active_current e
      )
      select jsonb_agg(ajt.resolved_job_title order by upper(ajt.resolved_job_title), ajt.resolved_job_title)
      from active_job_titles ajt
      where ajt.resolved_job_title is not null
    ), '[]'::jsonb),
    'buk_unions',
    coalesce((
      with active_unions as (
        select distinct public.get_hr_incentive_union_name(e.raw_payload) as union_name
        from public.employees_active_current e
      )
      select jsonb_agg(au.union_name order by upper(au.union_name), au.union_name)
      from active_unions au
      where au.union_name is not null
    ), '[]'::jsonb),
    'buk_union_statuses',
    coalesce((
      with active_union_statuses as (
        select distinct public.get_hr_incentive_union_status(e.raw_payload) as union_status
        from public.employees_active_current e
      )
      select jsonb_agg(
        jsonb_build_object(
          'value', aus.union_status,
          'label', public.get_hr_incentive_union_status_label(aus.union_status)
        )
        order by case aus.union_status
          when 'unionized' then 0
          when 'non_unionized' then 1
          else 2
        end
      )
      from active_union_statuses aus
      where aus.union_status is not null
    ), '[]'::jsonb),
    'contract_options',
    coalesce((
      with contract_catalog as (
        select distinct on (c.code)
          c.code as value,
          concat_ws(
            ' · ',
            coalesce(
              nullif(trim(bcm.buk_area_name), ''),
              nullif(trim(c.contract_name), ''),
              c.code
            ),
            c.code
          ) as label
        from public.contracts c
        left join public.buk_contract_mappings bcm
          on bcm.contract_id = c.id
         and bcm.is_operational = true
        where c.is_active = true
        order by c.code, bcm.is_one_to_one desc, bcm.updated_at desc nulls last, bcm.id desc nulls last
      )
      select jsonb_agg(
        jsonb_build_object(
          'value', cc.value,
          'label', cc.label
        )
        order by upper(cc.label), cc.label
      )
      from contract_catalog cc
    ), '[]'::jsonb),
    'allowed_job_titles',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', jt.id,
          'job_title', jt.job_title,
          'is_active', jt.is_active,
          'created_at', jt.created_at
        )
        order by jt.is_active desc, jt.job_title
      )
      from public.hr_incentive_allowed_job_titles jt
    ), '[]'::jsonb),
    'incentive_types',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', it.id,
          'code', it.code,
          'name', it.name,
          'calculation_basis', it.calculation_basis,
          'requires_replacement', it.requires_replacement,
          'requires_rest_day', it.requires_rest_day,
          'is_active', it.is_active,
          'created_at', it.created_at
        )
        order by it.is_active desc, it.name
      )
      from public.hr_incentive_types it
    ), '[]'::jsonb),
    'rate_rules',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rr.id,
          'incentive_type_id', rr.incentive_type_id,
          'incentive_type_name', it.name,
          'contract_code', rr.contract_code,
          'job_title', rr.job_title,
          'union_name', rr.union_name,
          'union_status', rr.union_status,
          'amount', rr.amount,
          'priority', rr.priority,
          'valid_from', rr.valid_from,
          'valid_to', rr.valid_to,
          'is_active', rr.is_active,
          'created_at', rr.created_at
        )
        order by rr.is_active desc, it.name, rr.priority asc, rr.contract_code nulls last, rr.job_title nulls last, rr.union_name nulls last, rr.union_status nulls last
      )
      from public.hr_incentive_rate_rules rr
      join public.hr_incentive_types it
        on it.id = rr.incentive_type_id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.resolve_hr_incentive_contract_approvers(
  p_selected_contract_code text
)
returns table (
  contract_id bigint,
  contract_code text,
  contract_name text,
  cost_center_code text,
  cost_center_name text,
  contract_admin_user_id uuid,
  contract_admin_name text,
  contract_admin_email text,
  area_manager_user_id uuid,
  area_manager_name text,
  area_manager_email text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  selected_contract_row record;
  contract_admin_mapping_row record;
  contract_admin_profile_row public.profiles%rowtype;
  area_manager_row public.cost_center_approvers%rowtype;
  area_manager_profile_row public.profiles%rowtype;
  matching_contract_admin_profiles integer := 0;
begin
  if nullif(trim(coalesce(p_selected_contract_code, '')), '') is null then
    raise exception 'Debe indicar el contrato aplicable para resolver aprobadores';
  end if;

  select
    c.id,
    c.code,
    c.contract_name,
    c.cost_center_code,
    c.cost_center_name
  into selected_contract_row
  from public.contracts c
  where c.code = trim(p_selected_contract_code)
    and c.is_active = true
  limit 1;

  if selected_contract_row.id is null then
    raise exception 'No existe un contrato activo para el codigo %', trim(p_selected_contract_code);
  end if;

  select
    bcm.contract_admin_name
  into contract_admin_mapping_row
  from public.buk_contract_mappings bcm
  where bcm.contract_id = selected_contract_row.id
    and bcm.is_operational = true
    and nullif(trim(coalesce(bcm.contract_admin_name, '')), '') is not null
  order by bcm.is_one_to_one desc, bcm.updated_at desc, bcm.id desc
  limit 1;

  if nullif(trim(coalesce(contract_admin_mapping_row.contract_admin_name, '')), '') is null then
    raise exception 'El contrato % no tiene administrador de contrato configurado', trim(p_selected_contract_code);
  end if;

  select count(*)
  into matching_contract_admin_profiles
  from public.profiles p
  where lower(trim(coalesce(p.full_name, ''))) =
        lower(trim(contract_admin_mapping_row.contract_admin_name))
    and p.status = 'active';

  if matching_contract_admin_profiles > 1 then
    raise exception
      'El administrador de contrato % coincide con % cuentas activas. Vincula una identidad unica antes de seguir.',
      trim(contract_admin_mapping_row.contract_admin_name),
      matching_contract_admin_profiles;
  end if;

  select *
  into contract_admin_profile_row
  from public.profiles p
  where lower(trim(coalesce(p.full_name, ''))) =
        lower(trim(contract_admin_mapping_row.contract_admin_name))
    and p.status = 'active'
  limit 1;

  if contract_admin_profile_row.id is null then
    raise exception 'El administrador de contrato % no tiene una cuenta activa en la plataforma', trim(contract_admin_mapping_row.contract_admin_name);
  end if;

  select *
  into area_manager_row
  from public.cost_center_approvers cca
  where cca.cost_center_code = selected_contract_row.cost_center_code
    and cca.is_active = true
  limit 1;

  if area_manager_row.id is null then
    raise exception 'El contrato % no tiene gerente de area configurado', trim(p_selected_contract_code);
  end if;

  if area_manager_row.approver_user_id is null then
    raise exception 'El gerente de area del contrato % aun no tiene usuario vinculado', trim(p_selected_contract_code);
  end if;

  select *
  into area_manager_profile_row
  from public.profiles p
  where p.id = area_manager_row.approver_user_id
    and p.status = 'active'
  limit 1;

  if area_manager_profile_row.id is null then
    raise exception 'El gerente de area del contrato % no tiene una cuenta activa', trim(p_selected_contract_code);
  end if;

  return query
  select
    selected_contract_row.id::bigint,
    selected_contract_row.code::text,
    selected_contract_row.contract_name::text,
    selected_contract_row.cost_center_code::text,
    selected_contract_row.cost_center_name::text,
    contract_admin_profile_row.id,
    coalesce(contract_admin_profile_row.full_name, contract_admin_profile_row.email)::text,
    contract_admin_profile_row.email::text,
    area_manager_profile_row.id,
    coalesce(area_manager_row.approver_name, area_manager_profile_row.full_name, area_manager_profile_row.email)::text,
    coalesce(area_manager_row.approver_email, area_manager_profile_row.email)::text;
end;
$function$;

create or replace function public.create_hr_incentive_request(
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_selected_area_name text,
  p_selected_area_code text default null,
  p_service_date timestamptz default null,
  p_duration_hours numeric default null,
  p_motive text default null,
  p_description text default null,
  p_replacement_buk_employee_id text default null,
  p_declared_rest_day boolean default null
)
returns table (
  request_id uuid,
  folio bigint,
  status text,
  calculated_amount numeric,
  period_code text,
  entry_lag_days integer,
  is_out_of_deadline boolean,
  is_contract_mismatch boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_data jsonb;
  replacement_worker_data jsonb;
  preview_payload jsonb;
  rule_data jsonb;
  approver_context_row record;
  replacement_roster_row record;
  new_request_id uuid;
  new_folio bigint;
  resolved_now timestamptz := timezone('utc', now());
  resolved_service_at timestamptz := coalesce(p_service_date, resolved_now);
  resolved_period_code text := public.resolve_hr_incentive_period_code(coalesce(p_service_date, resolved_now));
  resolved_entry_lag_days integer := public.resolve_hr_incentive_entry_lag_days(
    resolved_now,
    coalesce(p_service_date, resolved_now)
  );
  resolved_is_out_of_deadline boolean := false;
  resolved_is_contract_mismatch boolean := false;
  roster_exception_id uuid;
  roster_exception_source text;
  resolved_calendar_marking text := 'not_applicable';
  resolved_actual_rest_day boolean := false;
  resolved_schedule_status text;
  resolved_schedule_label text;
  resolved_replacement_schedule_status text;
  resolved_replacement_schedule_label text;
  resolved_extra_shift_note text;
  upserted_extra_shift_created boolean := false;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para registrar incentivos';
  end if;

  if nullif(trim(coalesce(p_selected_contract_code, '')), '') is null then
    raise exception 'Debe seleccionar el contrato/área aplicable';
  end if;

  if nullif(trim(coalesce(p_selected_area_name, '')), '') is null then
    raise exception 'Debe indicar el nombre del contrato/área aplicable';
  end if;

  if p_declared_rest_day is null then
    raise exception 'Debes confirmar si el trabajador estaba en descanso antes de registrar el incentivo';
  end if;

  if resolved_entry_lag_days > 7 then
    raise exception
      'No se pueden registrar incentivos con más de 7 días hacia atrás. Fecha mínima permitida: %',
      to_char(
        timezone('America/Santiago', resolved_now)::date - 7,
        'DD/MM/YYYY'
      );
  end if;

  resolved_is_out_of_deadline := resolved_entry_lag_days > 2;

  worker_data := public.get_hr_incentive_worker_core(p_buk_employee_id);
  resolved_is_contract_mismatch := public.resolve_hr_incentive_contract_mismatch(
    worker_data ->> 'primary_contract_code',
    trim(p_selected_contract_code)
  );

  preview_payload := public.build_hr_incentive_preview_from_worker_data(
    worker_data,
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_duration_hours,
    resolved_service_at::date
  );
  rule_data := preview_payload -> 'rule';
  resolved_actual_rest_day := coalesce(
    (preview_payload -> 'roster_validation' ->> 'is_rest_day')::boolean,
    false
  );
  resolved_schedule_status := preview_payload -> 'roster_validation' ->> 'schedule_status';
  resolved_schedule_label := preview_payload -> 'roster_validation' ->> 'schedule_label';

  if p_declared_rest_day is distinct from resolved_actual_rest_day then
    raise exception
      'La confirmación "En descanso" no coincide con la pauta vigente. Para el % el sistema detecta "%".',
      to_char(resolved_service_at::date, 'DD/MM/YYYY'),
      coalesce(resolved_schedule_label, 'Sin pauta');
  end if;

  select *
  into approver_context_row
  from public.resolve_hr_incentive_contract_approvers(trim(p_selected_contract_code));

  if coalesce((rule_data ->> 'requires_replacement')::boolean, false) then
    if nullif(trim(coalesce(p_replacement_buk_employee_id, '')), '') is null then
      raise exception 'El tipo de incentivo seleccionado exige trabajador reemplazado';
    end if;

    replacement_worker_data := public.get_hr_incentive_worker_core(p_replacement_buk_employee_id);

    select *
    into replacement_roster_row
    from public.resolve_hr_roster_day_status(
      p_replacement_buk_employee_id,
      resolved_service_at::date
    );

    resolved_replacement_schedule_status := replacement_roster_row.effective_status;
    resolved_replacement_schedule_label := coalesce(
      replacement_roster_row.exception_label,
      case replacement_roster_row.effective_status
        when 'working' then 'En turno'
        when 'extra_shift' then 'Turno adicional'
        when 'resting' then 'Descanso'
        when 'training' then 'Capacitación'
        when 'vacation' then 'Vacaciones'
        when 'medical_leave' then 'Licencia médica'
        when 'absent' then 'Inasistencia'
        when 'administrative_leave' then 'Permiso administrativo'
        when 'union_leave' then 'Permiso sindical'
        when 'unassigned' then 'Sin pauta'
        else 'Sin pauta'
      end
    );

    if coalesce(resolved_replacement_schedule_status, 'unassigned') not in ('working', 'extra_shift') then
      raise exception
        'El trabajador reemplazado debe estar en turno para registrar este incentivo. Para el % el sistema detecta "%".',
        to_char(resolved_service_at::date, 'DD/MM/YYYY'),
        resolved_replacement_schedule_label;
    end if;
  end if;

  insert into public.hr_incentive_requests as hir (
    employee_buk_employee_id,
    employee_document_type,
    employee_document_number,
    employee_full_name,
    employee_job_title,
    employee_union_name,
    employee_union_status,
    employee_union_joined_at,
    primary_contract_code,
    primary_area_name,
    selected_contract_code,
    selected_area_name,
    selected_area_code,
    incentive_type_id,
    incentive_type_name,
    requires_replacement,
    replacement_buk_employee_id,
    replacement_document_number,
    replacement_full_name,
    motive,
    description,
    service_date,
    duration_hours,
    period_code,
    calculation_basis,
    rate_rule_id,
    rate_rule_amount,
    calculated_amount,
    entry_lag_days,
    is_out_of_deadline,
    is_contract_mismatch,
    declared_rest_day,
    area_manager_user_id,
    area_manager_name,
    area_manager_email,
    status,
    created_by
  )
  values (
    worker_data ->> 'buk_employee_id',
    coalesce(worker_data ->> 'document_type', 'rut'),
    worker_data ->> 'document_number',
    worker_data ->> 'full_name',
    worker_data ->> 'job_title',
    nullif(worker_data ->> 'union_name', ''),
    coalesce(worker_data ->> 'union_status', 'unknown'),
    nullif(worker_data ->> 'union_joined_at', '')::date,
    worker_data ->> 'primary_contract_code',
    worker_data ->> 'primary_area_name',
    trim(p_selected_contract_code),
    trim(p_selected_area_name),
    nullif(trim(coalesce(p_selected_area_code, '')), ''),
    p_incentive_type_id,
    rule_data ->> 'incentive_type_name',
    coalesce((rule_data ->> 'requires_replacement')::boolean, false),
    nullif(trim(coalesce(p_replacement_buk_employee_id, '')), ''),
    nullif(trim(coalesce(replacement_worker_data ->> 'document_number', '')), ''),
    nullif(trim(coalesce(replacement_worker_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(p_motive, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    resolved_service_at,
    p_duration_hours,
    resolved_period_code,
    rule_data ->> 'calculation_basis',
    (rule_data ->> 'rate_rule_id')::uuid,
    (rule_data ->> 'rate_rule_amount')::numeric,
    (preview_payload ->> 'calculated_amount')::numeric,
    resolved_entry_lag_days,
    resolved_is_out_of_deadline,
    resolved_is_contract_mismatch,
    p_declared_rest_day,
    approver_context_row.area_manager_user_id,
    approver_context_row.area_manager_name,
    approver_context_row.area_manager_email,
    'P',
    current_user_id
  )
  returning hir.id, hir.folio into new_request_id, new_folio;

  if resolved_actual_rest_day then
    resolved_extra_shift_note := format(
      'Marcado automáticamente por incentivo folio %s (%s).',
      new_folio,
      coalesce(rule_data ->> 'incentive_type_name', 'Sin tipo')
    );

    with upserted_exception as (
      insert into public.hr_roster_exceptions (
        employee_buk_employee_id,
        employee_document_type,
        employee_document_number,
        employee_full_name,
        exception_date,
        exception_type,
        exception_source,
        notes,
        created_by
      )
      values (
        worker_data ->> 'buk_employee_id',
        coalesce(worker_data ->> 'document_type', 'rut'),
        worker_data ->> 'document_number',
        worker_data ->> 'full_name',
        resolved_service_at::date,
        'extra_shift',
        'incentive_auto',
        resolved_extra_shift_note,
        current_user_id
      )
      on conflict (employee_buk_employee_id, exception_date) do update
      set
        employee_document_type = excluded.employee_document_type,
        employee_document_number = excluded.employee_document_number,
        employee_full_name = excluded.employee_full_name,
        notes = excluded.notes,
        is_active = true,
        updated_at = timezone('utc', now())
      where public.hr_roster_exceptions.exception_type = 'extra_shift'
        and coalesce(public.hr_roster_exceptions.exception_source, 'manual') <> 'buk'
      returning
        public.hr_roster_exceptions.id,
        public.hr_roster_exceptions.exception_source,
        (xmax = 0) as inserted
    )
    select
      ue.id,
      ue.exception_source,
      ue.inserted
    into
      roster_exception_id,
      roster_exception_source,
      upserted_extra_shift_created
    from upserted_exception ue;

    if roster_exception_id is not null then
      resolved_calendar_marking := case
        when upserted_extra_shift_created then 'extra_shift_created'
        else 'extra_shift_refreshed'
      end;
    else
      select
        hre.id,
        hre.exception_source
      into
        roster_exception_id,
        roster_exception_source
      from public.hr_roster_exceptions hre
      where hre.employee_buk_employee_id = worker_data ->> 'buk_employee_id'
        and hre.exception_date = resolved_service_at::date
      limit 1;

      resolved_calendar_marking := 'existing_exception_preserved';
    end if;
  end if;

  insert into public.hr_incentive_request_approvals (
    incentive_request_id,
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
    new_request_id,
    'contract_admin',
    'Administrador de contrato',
    1,
    approver_context_row.contract_admin_user_id,
    approver_context_row.contract_admin_name,
    approver_context_row.contract_admin_email,
    'pending',
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    metadata
  )
  values (
    new_request_id,
    'created',
    current_user_id,
    jsonb_build_object(
      'selected_contract_code', trim(p_selected_contract_code),
      'selected_area_name', trim(p_selected_area_name),
      'selected_area_code', nullif(trim(coalesce(p_selected_area_code, '')), ''),
      'duration_hours', p_duration_hours,
      'employee_union_name', nullif(worker_data ->> 'union_name', ''),
      'employee_union_status', coalesce(worker_data ->> 'union_status', 'unknown'),
      'calculated_amount', (preview_payload ->> 'calculated_amount')::numeric,
      'period_code', resolved_period_code,
      'entry_lag_days', resolved_entry_lag_days,
      'is_out_of_deadline', resolved_is_out_of_deadline,
      'is_contract_mismatch', resolved_is_contract_mismatch,
      'declared_rest_day', p_declared_rest_day,
      'actual_rest_day', resolved_actual_rest_day,
      'schedule_status', resolved_schedule_status,
      'schedule_label', resolved_schedule_label,
      'area_manager_user_id', approver_context_row.area_manager_user_id,
      'area_manager_name', approver_context_row.area_manager_name,
      'area_manager_email', approver_context_row.area_manager_email,
      'replacement_roster_validation', case
        when coalesce((rule_data ->> 'requires_replacement')::boolean, false) then jsonb_build_object(
          'schedule_status', resolved_replacement_schedule_status,
          'schedule_label', resolved_replacement_schedule_label
        )
        else null
      end,
      'calendar_marking', resolved_calendar_marking,
      'roster_validation', preview_payload -> 'roster_validation'
    )
  );

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    metadata
  )
  values (
    new_request_id,
    'approval_created',
    current_user_id,
    jsonb_build_object(
      'step_code', 'contract_admin',
      'step_name', 'Administrador de contrato',
      'approver_user_id', approver_context_row.contract_admin_user_id,
      'approver_name', approver_context_row.contract_admin_name,
      'approver_email', approver_context_row.contract_admin_email,
      'status', 'pending',
      'period_code', resolved_period_code,
      'is_out_of_deadline', resolved_is_out_of_deadline,
      'is_contract_mismatch', resolved_is_contract_mismatch
    )
  );

  return query
  select
    new_request_id,
    new_folio,
    'P'::text,
    (preview_payload ->> 'calculated_amount')::numeric,
    resolved_period_code,
    resolved_entry_lag_days,
    resolved_is_out_of_deadline,
    resolved_is_contract_mismatch;
end;
$function$;

create or replace function public.decide_hr_incentive_request_approval(
  p_approval_id bigint,
  p_decision text,
  p_comment text default null
)
returns table (
  request_id uuid,
  request_status text,
  decided_step text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  approval_row public.hr_incentive_request_approvals%rowtype;
  request_row public.hr_incentive_requests%rowtype;
  next_step_approver_row record;
  next_approval_id bigint;
  resolved_area_manager_user_id uuid;
  resolved_area_manager_name text;
  resolved_area_manager_email text;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision invalida';
  end if;

  if p_decision = 'rejected' and normalized_comment is null then
    raise exception 'Debe indicar un comentario al rechazar el incentivo';
  end if;

  select *
  into approval_row
  from public.hr_incentive_request_approvals hira
  where hira.id = p_approval_id
  for update;

  if approval_row.id is null then
    raise exception 'No existe la aprobacion solicitada';
  end if;

  if approval_row.status <> 'pending' then
    raise exception 'La aprobacion ya fue resuelta y no puede volver a decidirse';
  end if;

  if approval_row.approver_user_id is null
     or (approval_row.approver_user_id <> current_user_id and not public.user_is_admin(current_user_id)) then
    raise exception 'El usuario no esta autorizado para decidir esta aprobacion';
  end if;

  select *
  into request_row
  from public.hr_incentive_requests hir
  where hir.id = approval_row.incentive_request_id
  for update;

  if request_row.id is null then
    raise exception 'No existe la solicitud asociada a la aprobacion';
  end if;

  if approval_row.step_code = 'contract_admin' and request_row.status <> 'P' then
    raise exception 'La solicitud no esta pendiente de administrador de contrato';
  end if;

  if approval_row.step_code = 'area_manager' and request_row.status <> 'E' then
    raise exception 'La solicitud no esta pendiente de gerente de area';
  end if;

  update public.hr_incentive_request_approvals hira
     set status = p_decision,
         decision_by = current_user_id,
         decision_comment = normalized_comment,
         decided_at = timezone('utc', now()),
         locked_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where hira.id = approval_row.id
     and hira.status = 'pending';

  if p_decision = 'rejected' then
    update public.hr_incentive_requests hir
       set status = 'R',
           updated_at = timezone('utc', now())
     where hir.id = request_row.id;

    update public.hr_incentive_request_approvals hira
       set status = 'cancelled',
           decision_by = current_user_id,
           decision_comment = coalesce(normalized_comment, 'Solicitud rechazada'),
           decided_at = timezone('utc', now()),
           locked_at = timezone('utc', now()),
           updated_at = timezone('utc', now())
     where hira.incentive_request_id = request_row.id
       and hira.id <> approval_row.id
       and hira.status = 'pending';

    if request_row.declared_rest_day is true then
      perform public.reconcile_hr_roster_extra_shift_from_incentives(
        request_row.employee_buk_employee_id,
        request_row.service_date::date,
        request_row.employee_document_type,
        request_row.employee_document_number,
        request_row.employee_full_name
      );
    end if;

    insert into public.hr_incentive_request_history (
      incentive_request_id,
      action_type,
      actor_user_id,
      comment,
      metadata
    )
    values (
      request_row.id,
      'rejected',
      current_user_id,
      normalized_comment,
      jsonb_build_object(
        'step_code', approval_row.step_code,
        'step_name', approval_row.step_name
      )
    );

    return query
    select
      request_row.id,
      'R'::text,
      approval_row.step_code;
    return;
  end if;

  if approval_row.step_code = 'contract_admin' then
    resolved_area_manager_user_id := request_row.area_manager_user_id;
    resolved_area_manager_name := nullif(trim(coalesce(request_row.area_manager_name, '')), '');
    resolved_area_manager_email := nullif(trim(coalesce(request_row.area_manager_email, '')), '');

    if resolved_area_manager_user_id is null
       or resolved_area_manager_name is null then
      select *
      into next_step_approver_row
      from public.resolve_hr_incentive_contract_approvers(request_row.selected_contract_code);

      resolved_area_manager_user_id := next_step_approver_row.area_manager_user_id;
      resolved_area_manager_name := next_step_approver_row.area_manager_name;
      resolved_area_manager_email := next_step_approver_row.area_manager_email;

      update public.hr_incentive_requests hir
         set area_manager_user_id = resolved_area_manager_user_id,
             area_manager_name = resolved_area_manager_name,
             area_manager_email = resolved_area_manager_email,
             updated_at = timezone('utc', now())
       where hir.id = request_row.id;
    end if;

    if exists (
      select 1
      from public.hr_incentive_request_approvals hira_existing
      where hira_existing.incentive_request_id = request_row.id
        and hira_existing.step_code = 'area_manager'
    ) then
      raise exception 'La aprobacion de gerente de area ya existe para este incentivo';
    end if;

    if resolved_area_manager_user_id = approval_row.approver_user_id then
      insert into public.hr_incentive_request_approvals (
        incentive_request_id,
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
        request_row.id,
        'area_manager',
        'Gerente de area',
        2,
        resolved_area_manager_user_id,
        resolved_area_manager_name,
        resolved_area_manager_email,
        'approved',
        current_user_id,
        coalesce(
          normalized_comment,
          'Autoaprobado porque el mismo usuario cumple las dos etapas secuenciales.'
        ),
        timezone('utc', now()),
        timezone('utc', now()),
        timezone('utc', now()),
        timezone('utc', now())
      )
      returning id into next_approval_id;

      update public.hr_incentive_requests hir
         set status = 'F',
             updated_at = timezone('utc', now())
       where hir.id = request_row.id;

      insert into public.hr_incentive_request_history (
        incentive_request_id,
        action_type,
        actor_user_id,
        comment,
        metadata
      )
      values (
        request_row.id,
        'approved',
        current_user_id,
        normalized_comment,
        jsonb_build_object(
          'step_code', approval_row.step_code,
          'step_name', approval_row.step_name
        )
      );

      insert into public.hr_incentive_request_history (
        incentive_request_id,
        action_type,
        actor_user_id,
        comment,
        metadata
      )
      values (
        request_row.id,
        'approved_final',
        current_user_id,
        coalesce(
          normalized_comment,
          'Autoaprobado porque el mismo usuario cumple las dos etapas secuenciales.'
        ),
        jsonb_build_object(
          'step_code', 'area_manager',
          'step_name', 'Gerente de area',
          'approval_id', next_approval_id,
          'auto_approved', true
        )
      );

      return query
      select
        request_row.id,
        'F'::text,
        approval_row.step_code;
      return;
    end if;

    insert into public.hr_incentive_request_approvals (
      incentive_request_id,
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
      request_row.id,
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
    returning id into next_approval_id;

    update public.hr_incentive_requests hir
       set status = 'E',
           updated_at = timezone('utc', now())
     where hir.id = request_row.id;

    insert into public.hr_incentive_request_history (
      incentive_request_id,
      action_type,
      actor_user_id,
      comment,
      metadata
    )
    values (
      request_row.id,
      'approved',
      current_user_id,
      normalized_comment,
      jsonb_build_object(
        'step_code', approval_row.step_code,
        'step_name', approval_row.step_name
      )
    );

    insert into public.hr_incentive_request_history (
      incentive_request_id,
      action_type,
      actor_user_id,
      metadata
    )
    values (
      request_row.id,
      'approval_created',
      current_user_id,
      jsonb_build_object(
        'approval_id', next_approval_id,
        'step_code', 'area_manager',
        'step_name', 'Gerente de area',
        'approver_user_id', resolved_area_manager_user_id,
        'approver_name', resolved_area_manager_name,
        'approver_email', resolved_area_manager_email,
        'status', 'pending'
      )
    );

    return query
    select
      request_row.id,
      'E'::text,
      approval_row.step_code;
    return;
  end if;

  update public.hr_incentive_requests hir
     set status = 'F',
         updated_at = timezone('utc', now())
   where hir.id = request_row.id;

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    comment,
    metadata
  )
  values (
    request_row.id,
    'approved_final',
    current_user_id,
    normalized_comment,
    jsonb_build_object(
      'step_code', approval_row.step_code,
      'step_name', approval_row.step_name
    )
  );

  return query
  select
    request_row.id,
    'F'::text,
    approval_row.step_code;
end;
$function$;

drop function if exists public.get_hr_incentive_requests(text, text[], text[], text, uuid[], date);

create or replace function public.get_hr_incentive_requests(
  p_period_code text default null,
  p_statuses text[] default null,
  p_contract_codes text[] default null,
  p_worker_search text default null,
  p_type_ids uuid[] default null,
  p_service_date_until date default null,
  p_limit integer default null,
  p_offset integer default 0,
  p_sort_column text default null,
  p_sort_direction text default 'desc'
)
returns table (
  id uuid,
  folio bigint,
  employee_buk_employee_id text,
  employee_document_type text,
  employee_document_number text,
  employee_full_name text,
  employee_job_title text,
  employee_union_name text,
  employee_union_status text,
  employee_union_joined_at date,
  primary_contract_code text,
  primary_area_name text,
  selected_contract_code text,
  selected_area_name text,
  selected_area_code text,
  incentive_type_id uuid,
  incentive_type_name text,
  requires_replacement boolean,
  replacement_buk_employee_id text,
  replacement_document_number text,
  replacement_full_name text,
  motive text,
  description text,
  service_date timestamptz,
  duration_hours numeric,
  period_code text,
  calculation_basis text,
  rate_rule_id uuid,
  rate_rule_amount numeric,
  calculated_amount numeric,
  created_by uuid,
  requester_name text,
  requester_email text,
  status text,
  current_flow_user text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_comment text,
  created_at timestamptz,
  updated_at timestamptz,
  entry_lag_days integer,
  is_out_of_deadline boolean,
  is_contract_mismatch boolean,
  declared_rest_day boolean,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_worker_search, '')));
  normalized_contract_codes text[];
  normalized_type_ids uuid[];
  normalized_statuses text[];
  include_all_statuses boolean := false;
  normalized_sort_column text := lower(trim(coalesce(p_sort_column, '')));
  normalized_sort_direction text := case
    when lower(trim(coalesce(p_sort_direction, 'desc'))) = 'asc' then 'asc'
    else 'desc'
  end;
  resolved_limit integer := nullif(greatest(coalesce(p_limit, 0), 0), 0);
  resolved_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para ver incentivos';
  end if;

  select coalesce(array_agg(distinct trimmed_value), '{}'::text[])
    into normalized_contract_codes
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_contract_codes, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_contracts;

  select coalesce(array_agg(distinct raw_value), '{}'::uuid[])
    into normalized_type_ids
  from unnest(coalesce(p_type_ids, '{}'::uuid[])) as raw_value
  where raw_value is not null;

  select coalesce(array_agg(distinct upper(trimmed_value)), '{}'::text[])
    into normalized_statuses
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_statuses, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_statuses;

  include_all_statuses := 'A' = any(normalized_statuses);

  return query
  with filtered_requests as (
    select
      hir.id,
      hir.folio,
      hir.employee_buk_employee_id,
      hir.employee_document_type,
      hir.employee_document_number,
      hir.employee_full_name,
      hir.employee_job_title,
      hir.employee_union_name,
      hir.employee_union_status,
      hir.employee_union_joined_at,
      hir.primary_contract_code,
      hir.primary_area_name,
      hir.selected_contract_code,
      hir.selected_area_name,
      hir.selected_area_code,
      hir.incentive_type_id,
      hir.incentive_type_name,
      hir.requires_replacement,
      hir.replacement_buk_employee_id,
      hir.replacement_document_number,
      hir.replacement_full_name,
      hir.motive,
      hir.description,
      hir.service_date,
      hir.duration_hours,
      hir.period_code,
      hir.calculation_basis,
      hir.rate_rule_id,
      hir.rate_rule_amount,
      hir.calculated_amount,
      hir.created_by,
      coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible') as requester_name,
      requester_profile.email as requester_email,
      hir.status,
      pending_approval.approver_name as current_flow_user,
      hir.cancelled_at,
      hir.cancelled_by,
      hir.cancellation_comment,
      hir.created_at,
      hir.updated_at,
      hir.entry_lag_days,
      hir.is_out_of_deadline,
      hir.is_contract_mismatch,
      hir.declared_rest_day
    from public.hr_incentive_requests hir
    left join public.profiles requester_profile
      on requester_profile.id = hir.created_by
    left join lateral (
      select hira.approver_name
      from public.hr_incentive_request_approvals hira
      where hira.incentive_request_id = hir.id
        and hira.status = 'pending'
      order by hira.step_order asc, hira.created_at asc
      limit 1
    ) pending_approval on true
    where
      (p_period_code is null or trim(p_period_code) = '' or hir.period_code = trim(p_period_code))
      and (
        coalesce(array_length(normalized_statuses, 1), 0) = 0
        or include_all_statuses
        or hir.status = any(normalized_statuses)
      )
      and (
        coalesce(array_length(normalized_contract_codes, 1), 0) = 0
        or hir.selected_contract_code = any(normalized_contract_codes)
      )
      and (
        coalesce(array_length(normalized_type_ids, 1), 0) = 0
        or hir.incentive_type_id = any(normalized_type_ids)
      )
      and (p_service_date_until is null or hir.service_date::date <= p_service_date_until)
      and (
        normalized_search = ''
        or lower(
          concat_ws(
            ' ',
            hir.employee_full_name,
            coalesce(hir.employee_document_number, ''),
            coalesce(hir.employee_job_title, ''),
            coalesce(hir.replacement_full_name, ''),
            coalesce(hir.selected_area_name, ''),
            coalesce(hir.selected_contract_code, ''),
            coalesce(hir.incentive_type_name, ''),
            coalesce(pending_approval.approver_name, '')
          )
        ) like '%' || normalized_search || '%'
      )
  ),
  ordered_requests as (
    select
      fr.*,
      count(*) over () as total_count
    from filtered_requests fr
    order by
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'asc' then fr.folio end asc nulls last,
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'desc' then fr.folio end desc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'asc' then lower(fr.employee_full_name) end asc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'desc' then lower(fr.employee_full_name) end desc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'asc' then lower(fr.incentive_type_name) end asc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'desc' then lower(fr.incentive_type_name) end desc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'asc' then lower(fr.selected_area_name) end asc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'desc' then lower(fr.selected_area_name) end desc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'asc' then fr.service_date end asc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'desc' then fr.service_date end desc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'asc' then fr.calculated_amount end asc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'desc' then fr.calculated_amount end desc nulls last,
      case when normalized_sort_column = 'estado' and normalized_sort_direction = 'asc' then
        case fr.status
          when 'F' then 1
          when 'C' then 2
          when 'P' then 3
          when 'E' then 4
          when 'R' then 5
          else 99
        end
      end asc nulls last,
      case when normalized_sort_column = 'estado' and normalized_sort_direction = 'desc' then
        case fr.status
          when 'F' then 1
          when 'C' then 2
          when 'P' then 3
          when 'E' then 4
          when 'R' then 5
          else 99
        end
      end desc nulls last,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto', 'estado') then fr.created_at end desc,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto', 'estado') then fr.folio end desc,
      fr.id desc
    offset resolved_offset
    limit resolved_limit
  )
  select *
  from ordered_requests;
end;
$function$;

drop function if exists public.get_hr_incentive_approval_queue();

create or replace function public.get_hr_incentive_approval_queue(
  p_search text default null,
  p_limit integer default null,
  p_offset integer default 0,
  p_sort_column text default null,
  p_sort_direction text default 'asc'
)
returns table (
  approval_id bigint,
  request_id uuid,
  folio bigint,
  step_code text,
  step_name text,
  step_order integer,
  approval_status text,
  approver_user_id uuid,
  approver_name text,
  employee_full_name text,
  employee_document_number text,
  employee_job_title text,
  employee_union_name text,
  selected_contract_code text,
  selected_area_name text,
  incentive_type_name text,
  service_date timestamptz,
  calculated_amount numeric,
  period_code text,
  entry_lag_days integer,
  is_out_of_deadline boolean,
  is_contract_mismatch boolean,
  requester_name text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_view_all boolean := false;
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_sort_column text := lower(trim(coalesce(p_sort_column, '')));
  normalized_sort_direction text := case
    when lower(trim(coalesce(p_sort_direction, 'asc'))) = 'desc' then 'desc'
    else 'asc'
  end;
  resolved_limit integer := nullif(greatest(coalesce(p_limit, 0), 0), 0);
  resolved_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_view_all := public.user_can_manage_hr_incentives(current_user_id);

  if not can_view_all and not exists (
    select 1
    from public.hr_incentive_request_approvals hira
    where hira.approver_user_id = current_user_id
      and hira.status = 'pending'
  ) then
    raise exception 'Sin permisos para ver aprobaciones de incentivos';
  end if;

  return query
  with filtered_queue as (
    select
      hira.id as approval_id,
      hir.id as request_id,
      hir.folio,
      hira.step_code,
      hira.step_name,
      hira.step_order,
      hira.status as approval_status,
      hira.approver_user_id,
      hira.approver_name,
      hir.employee_full_name,
      hir.employee_document_number,
      hir.employee_job_title,
      hir.employee_union_name,
      hir.selected_contract_code,
      hir.selected_area_name,
      hir.incentive_type_name,
      hir.service_date,
      hir.calculated_amount,
      hir.period_code,
      hir.entry_lag_days,
      hir.is_out_of_deadline,
      hir.is_contract_mismatch,
      coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible') as requester_name,
      hir.created_at
    from public.hr_incentive_request_approvals hira
    join public.hr_incentive_requests hir
      on hir.id = hira.incentive_request_id
    left join public.profiles requester_profile
      on requester_profile.id = hir.created_by
    where hira.status = 'pending'
      and (can_view_all or hira.approver_user_id = current_user_id)
      and (
        normalized_search = ''
        or lower(
          concat_ws(
            ' ',
            hir.employee_full_name,
            coalesce(hir.employee_document_number, ''),
            coalesce(hir.employee_job_title, ''),
            coalesce(hir.employee_union_name, ''),
            coalesce(hir.selected_contract_code, ''),
            coalesce(hir.selected_area_name, ''),
            coalesce(hir.incentive_type_name, ''),
            coalesce(requester_profile.full_name, requester_profile.email, ''),
            coalesce(hira.approver_name, ''),
            case hira.step_code
              when 'contract_admin' then 'administrador de contrato'
              when 'area_manager' then 'gerente de area'
              else hira.step_code
            end
          )
        ) like '%' || normalized_search || '%'
      )
  ),
  ordered_queue as (
    select
      fq.*,
      count(*) over () as total_count
    from filtered_queue fq
    order by
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'asc' then fq.folio end asc nulls last,
      case when normalized_sort_column = 'folio' and normalized_sort_direction = 'desc' then fq.folio end desc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'asc' then lower(fq.employee_full_name) end asc nulls last,
      case when normalized_sort_column = 'trabajador' and normalized_sort_direction = 'desc' then lower(fq.employee_full_name) end desc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'asc' then lower(fq.incentive_type_name) end asc nulls last,
      case when normalized_sort_column = 'incentivo' and normalized_sort_direction = 'desc' then lower(fq.incentive_type_name) end desc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'asc' then lower(fq.selected_area_name) end asc nulls last,
      case when normalized_sort_column = 'contrato' and normalized_sort_direction = 'desc' then lower(fq.selected_area_name) end desc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'asc' then fq.service_date end asc nulls last,
      case when normalized_sort_column = 'fecha' and normalized_sort_direction = 'desc' then fq.service_date end desc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'asc' then fq.calculated_amount end asc nulls last,
      case when normalized_sort_column = 'monto' and normalized_sort_direction = 'desc' then fq.calculated_amount end desc nulls last,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto') then fq.step_order end asc,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto') then fq.service_date end asc,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto') then fq.created_at end asc,
      case when normalized_sort_column not in ('folio', 'trabajador', 'incentivo', 'contrato', 'fecha', 'monto') then fq.folio end asc,
      fq.approval_id asc
    offset resolved_offset
    limit resolved_limit
  )
  select *
  from ordered_queue;
end;
$function$;

create or replace function public.get_hr_incentives_analytics(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_type_ids uuid[] default null,
  p_statuses text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_contract_codes text[];
  normalized_type_ids uuid[];
  normalized_statuses text[];
  include_all_statuses boolean := false;
begin
  if not public.user_can_view_hr_incentive_analytics(current_user_id) then
    raise exception 'Sin permisos para ver el analisis de incentivos';
  end if;

  select coalesce(array_agg(distinct trimmed_value), '{}'::text[])
    into normalized_contract_codes
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_contract_codes, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_contracts;

  select coalesce(array_agg(distinct raw_value), '{}'::uuid[])
    into normalized_type_ids
  from unnest(coalesce(p_type_ids, '{}'::uuid[])) as raw_value
  where raw_value is not null;

  select coalesce(array_agg(distinct upper(trimmed_value)), '{}'::text[])
    into normalized_statuses
  from (
    select trim(raw_value) as trimmed_value
    from unnest(coalesce(p_statuses, '{}'::text[])) as raw_value
    where trim(coalesce(raw_value, '')) <> ''
  ) sanitized_statuses;

  include_all_statuses := 'A' = any(normalized_statuses);

  return (
    with base_requests as (
      select
        hir.id,
        hir.period_code,
        hir.selected_contract_code,
        hir.selected_area_name,
        hir.incentive_type_id,
        hir.incentive_type_name,
        hir.status,
        hir.calculated_amount,
        hir.employee_full_name,
        hir.declared_rest_day
      from public.hr_incentive_requests hir
    ),
    filtered_requests as (
      select *
      from base_requests br
      where
        (p_period_code is null or trim(p_period_code) = '' or br.period_code = trim(p_period_code))
        and (
          coalesce(array_length(normalized_contract_codes, 1), 0) = 0
          or br.selected_contract_code = any(normalized_contract_codes)
        )
        and (
          coalesce(array_length(normalized_type_ids, 1), 0) = 0
          or br.incentive_type_id = any(normalized_type_ids)
        )
        and (
          coalesce(array_length(normalized_statuses, 1), 0) = 0
          or include_all_statuses
          or br.status = any(normalized_statuses)
        )
    ),
    summary as (
      select
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as total_amount,
        count(*)::int as request_count,
        count(*) filter (where fr.status = 'F')::int as approved_count,
        count(*) filter (where fr.status = 'R')::int as rejected_count,
        count(*) filter (where fr.declared_rest_day is true)::int as declared_rest_day_count
      from filtered_requests fr
    ),
    amount_by_period as (
      select
        fr.period_code,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as total_amount,
        count(*)::int as request_count,
        coalesce(sum(fr.calculated_amount) filter (where fr.status = 'F'), 0)::numeric(14,2) as approved_amount,
        coalesce(sum(fr.calculated_amount) filter (where fr.status = 'R'), 0)::numeric(14,2) as rejected_amount
      from filtered_requests fr
      group by fr.period_code
      order by fr.period_code asc
    ),
    amount_by_type as (
      select
        fr.incentive_type_id,
        fr.incentive_type_name,
        count(*)::int as request_count,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as total_amount
      from filtered_requests fr
      group by fr.incentive_type_id, fr.incentive_type_name
      order by total_amount desc, fr.incentive_type_name asc
    ),
    amount_by_contract as (
      select
        fr.selected_contract_code as contract_code,
        max(fr.selected_area_name) as area_name,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as total_amount
      from filtered_requests fr
      group by fr.selected_contract_code
      order by total_amount desc, fr.selected_contract_code asc
    ),
    amount_by_worker_contracts as (
      select
        fr.employee_full_name as worker_name,
        fr.selected_contract_code as contract_code,
        max(fr.selected_area_name) as area_name,
        coalesce(sum(fr.calculated_amount), 0)::numeric(14,2) as amount
      from filtered_requests fr
      group by fr.employee_full_name, fr.selected_contract_code
    ),
    amount_by_worker as (
      select
        awc.worker_name,
        coalesce(sum(awc.amount), 0)::numeric(14,2) as total_amount,
        jsonb_agg(
          jsonb_build_object(
            'contract_code', awc.contract_code,
            'contract_label',
              coalesce(
                nullif(trim(awc.area_name), ''),
                nullif(trim(awc.contract_code), ''),
                'Sin contrato'
              ),
            'amount', awc.amount
          )
          order by awc.amount desc, awc.contract_code asc
        ) as contracts
      from amount_by_worker_contracts awc
      group by awc.worker_name
      order by total_amount desc, awc.worker_name asc
      limit 10
    )
    select jsonb_build_object(
      'summary_cards',
      jsonb_build_object(
        'total_amount', coalesce((select total_amount from summary), 0),
        'request_count', coalesce((select request_count from summary), 0),
        'approved_count', coalesce((select approved_count from summary), 0),
        'rejected_count', coalesce((select rejected_count from summary), 0),
        'approval_rate',
          case
            when coalesce((select request_count from summary), 0) = 0 then 0
            else round(
              ((select approved_count from summary)::numeric / (select request_count from summary)::numeric) * 100,
              2
            )
          end,
        'rejection_rate',
          case
            when coalesce((select request_count from summary), 0) = 0 then 0
            else round(
              ((select rejected_count from summary)::numeric / (select request_count from summary)::numeric) * 100,
              2
            )
          end,
        'declared_rest_day_count', coalesce((select declared_rest_day_count from summary), 0)
      ),
      'total_amount_by_period',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'period_code', abp.period_code,
            'total_amount', abp.total_amount,
            'request_count', abp.request_count,
            'approved_amount', abp.approved_amount,
            'rejected_amount', abp.rejected_amount
          )
          order by abp.period_code asc
        )
        from amount_by_period abp
      ), '[]'::jsonb),
      'count_by_incentive_type',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'incentive_type_id', abt.incentive_type_id,
            'incentive_type_name', abt.incentive_type_name,
            'request_count', abt.request_count,
            'total_amount', abt.total_amount
          )
          order by abt.total_amount desc, abt.incentive_type_name asc
        )
        from amount_by_type abt
      ), '[]'::jsonb),
      'amount_by_contract',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'contract_code', abc.contract_code,
            'area_name', abc.area_name,
            'total_amount', abc.total_amount
          )
          order by abc.total_amount desc, abc.contract_code asc
        )
        from amount_by_contract abc
      ), '[]'::jsonb),
      'amount_by_worker',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'worker_name', abw.worker_name,
            'total_amount', abw.total_amount,
            'contracts', abw.contracts
          )
          order by abw.total_amount desc, abw.worker_name asc
        )
        from amount_by_worker abw
      ), '[]'::jsonb),
      'filter_options',
      jsonb_build_object(
        'contracts',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'value', fr.selected_contract_code,
              'label', coalesce(fr.selected_area_name, fr.selected_contract_code) || ' · ' || fr.selected_contract_code
            )
            order by fr.selected_area_name asc, fr.selected_contract_code asc
          )
          from (
            select distinct
              br.selected_contract_code,
              br.selected_area_name
            from base_requests br
            where br.selected_contract_code is not null
              and br.selected_contract_code <> ''
          ) fr
        ), '[]'::jsonb),
        'types',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'value', fr.incentive_type_id,
              'label', fr.incentive_type_name
            )
            order by fr.incentive_type_name asc
          )
          from (
            select distinct
              br.incentive_type_id,
              br.incentive_type_name
            from base_requests br
          ) fr
        ), '[]'::jsonb),
        'statuses',
        jsonb_build_array(
          jsonb_build_object('value', 'A', 'label', 'Todos'),
          jsonb_build_object('value', 'P', 'label', 'Pendiente administrador contrato'),
          jsonb_build_object('value', 'E', 'label', 'Pendiente gerente de area'),
          jsonb_build_object('value', 'R', 'label', 'Rechazado'),
          jsonb_build_object('value', 'F', 'label', 'Aprobado'),
          jsonb_build_object('value', 'C', 'label', 'Anulado')
        )
      )
    )
  );
end;
$function$;

create or replace function public.get_hr_incentive_request_detail(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_view_request boolean := false;
  request_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_view_request :=
    public.user_can_manage_hr_incentives(current_user_id)
    or exists (
      select 1
      from public.hr_incentive_request_approvals hira
      where hira.incentive_request_id = p_request_id
        and hira.approver_user_id = current_user_id
    );

  if not can_view_request then
    raise exception 'Sin permisos para ver el detalle del incentivo';
  end if;

  select jsonb_build_object(
    'request',
    jsonb_build_object(
      'id', hir.id,
      'folio', hir.folio,
      'status', hir.status,
      'employee_buk_employee_id', hir.employee_buk_employee_id,
      'employee_document_type', hir.employee_document_type,
      'employee_document_number', hir.employee_document_number,
      'employee_full_name', hir.employee_full_name,
      'employee_job_title', hir.employee_job_title,
      'employee_union_name', hir.employee_union_name,
      'employee_union_status', hir.employee_union_status,
      'employee_union_joined_at', hir.employee_union_joined_at,
      'primary_contract_code', hir.primary_contract_code,
      'primary_area_name', hir.primary_area_name,
      'selected_contract_code', hir.selected_contract_code,
      'selected_area_name', hir.selected_area_name,
      'selected_area_code', hir.selected_area_code,
      'incentive_type_name', hir.incentive_type_name,
      'requires_replacement', hir.requires_replacement,
      'replacement_buk_employee_id', hir.replacement_buk_employee_id,
      'replacement_document_number', hir.replacement_document_number,
      'replacement_full_name', hir.replacement_full_name,
      'motive', hir.motive,
      'description', hir.description,
      'service_date', hir.service_date,
      'duration_hours', hir.duration_hours,
      'period_code', hir.period_code,
      'entry_lag_days', hir.entry_lag_days,
      'is_out_of_deadline', hir.is_out_of_deadline,
      'is_contract_mismatch', hir.is_contract_mismatch,
      'calculation_basis', hir.calculation_basis,
      'rate_rule_amount', hir.rate_rule_amount,
      'calculated_amount', hir.calculated_amount,
      'requester_name', coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible'),
      'requester_email', requester_profile.email,
      'current_step_code', current_approval.step_code,
      'current_step_name', current_approval.step_name,
      'current_approver_name', current_approval.approver_name,
      'cancelled_at', hir.cancelled_at,
      'cancellation_comment', hir.cancellation_comment,
      'created_at', hir.created_at,
      'updated_at', hir.updated_at,
      'declared_rest_day', hir.declared_rest_day
    ),
    'approvals',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hira.id,
          'step_code', hira.step_code,
          'step_name', hira.step_name,
          'step_order', hira.step_order,
          'approver_user_id', hira.approver_user_id,
          'approver_name', hira.approver_name,
          'approver_email', hira.approver_email,
          'status', hira.status,
          'decision_by', hira.decision_by,
          'decision_comment', hira.decision_comment,
          'decided_at', hira.decided_at,
          'created_at', hira.created_at
        )
        order by hira.step_order asc, hira.created_at asc, hira.id asc
      )
      from public.hr_incentive_request_approvals hira
      where hira.incentive_request_id = hir.id
    ), '[]'::jsonb),
    'history',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hih.id,
          'action_type', hih.action_type,
          'actor_user_id', hih.actor_user_id,
          'actor_name', coalesce(actor_profile.full_name, actor_profile.email, 'Sistema'),
          'comment', hih.comment,
          'metadata', hih.metadata,
          'created_at', hih.created_at
        )
        order by hih.created_at asc, hih.id asc
      )
      from public.hr_incentive_request_history hih
      left join public.profiles actor_profile
        on actor_profile.id = hih.actor_user_id
      where hih.incentive_request_id = hir.id
    ), '[]'::jsonb)
  )
  into request_payload
  from public.hr_incentive_requests hir
  left join public.profiles requester_profile
    on requester_profile.id = hir.created_by
  left join lateral (
    select
      hira.step_code,
      hira.step_name,
      hira.approver_name
    from public.hr_incentive_request_approvals hira
    where hira.incentive_request_id = hir.id
      and hira.status = 'pending'
    order by hira.step_order asc, hira.created_at asc
    limit 1
  ) current_approval on true
  where hir.id = p_request_id
  limit 1;

  if request_payload is null then
    raise exception 'No existe el incentivo solicitado';
  end if;

  return request_payload;
end;
$function$;

notify pgrst, 'reload schema';

commit;
