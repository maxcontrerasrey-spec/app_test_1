begin;

create or replace function public.resolve_hr_incentive_period_code(
  p_service_date timestamptz
)
returns text
language plpgsql
immutable
as $function$
declare
  local_service_date date;
  period_anchor_date date;
begin
  if p_service_date is null then
    return null;
  end if;

  local_service_date := timezone('America/Santiago', p_service_date)::date;
  period_anchor_date := case
    when extract(day from local_service_date) >= 21
      then (date_trunc('month', local_service_date::timestamp) + interval '1 month')::date
    else local_service_date
  end;

  return to_char(period_anchor_date, 'YYYYMM');
end;
$function$;

create or replace function public.resolve_hr_incentive_entry_lag_days(
  p_created_at timestamptz,
  p_service_date timestamptz
)
returns integer
language plpgsql
immutable
as $function$
declare
  created_local_date date;
  service_local_date date;
begin
  if p_created_at is null or p_service_date is null then
    return 0;
  end if;

  created_local_date := timezone('America/Santiago', p_created_at)::date;
  service_local_date := timezone('America/Santiago', p_service_date)::date;

  return greatest(created_local_date - service_local_date, 0);
end;
$function$;

create or replace function public.resolve_hr_incentive_contract_mismatch(
  p_primary_contract_code text,
  p_selected_contract_code text
)
returns boolean
language sql
immutable
as $function$
  select
    nullif(trim(coalesce(p_primary_contract_code, '')), '') is not null
    and trim(coalesce(p_selected_contract_code, '')) <> trim(coalesce(p_primary_contract_code, ''));
$function$;

alter table public.hr_incentive_requests
  add column if not exists entry_lag_days integer not null default 0;

alter table public.hr_incentive_requests
  add column if not exists is_out_of_deadline boolean not null default false;

alter table public.hr_incentive_requests
  add column if not exists is_contract_mismatch boolean not null default false;

alter table public.hr_incentive_requests
  drop constraint if exists hr_incentive_requests_entry_lag_days_check;

alter table public.hr_incentive_requests
  add constraint hr_incentive_requests_entry_lag_days_check
  check (entry_lag_days >= 0 and entry_lag_days <= 366);

update public.hr_incentive_requests hir
set
  period_code = public.resolve_hr_incentive_period_code(hir.service_date),
  entry_lag_days = public.resolve_hr_incentive_entry_lag_days(hir.created_at, hir.service_date),
  is_out_of_deadline =
    public.resolve_hr_incentive_entry_lag_days(hir.created_at, hir.service_date) > 2,
  is_contract_mismatch =
    public.resolve_hr_incentive_contract_mismatch(
      hir.primary_contract_code,
      hir.selected_contract_code
    );

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
  p_replacement_buk_employee_id text default null
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
  worker_payload jsonb;
  replacement_payload jsonb;
  worker_data jsonb;
  preview_payload jsonb;
  rule_data jsonb;
  approver_context_row record;
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

  if resolved_entry_lag_days > 7 then
    raise exception
      'No se pueden registrar incentivos con más de 7 días hacia atrás. Fecha mínima permitida: %',
      to_char(
        timezone('America/Santiago', resolved_now)::date - 7,
        'DD/MM/YYYY'
      );
  end if;

  resolved_is_out_of_deadline := resolved_entry_lag_days > 2;

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_data := worker_payload -> 'worker';
  resolved_is_contract_mismatch := public.resolve_hr_incentive_contract_mismatch(
    worker_data ->> 'primary_contract_code',
    trim(p_selected_contract_code)
  );

  preview_payload := public.calculate_hr_incentive_preview(
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_duration_hours,
    resolved_service_at::date
  );
  rule_data := preview_payload -> 'rule';
  select *
  into approver_context_row
  from public.resolve_hr_incentive_contract_approvers(trim(p_selected_contract_code));

  if coalesce((rule_data ->> 'requires_replacement')::boolean, false) then
    if nullif(trim(coalesce(p_replacement_buk_employee_id, '')), '') is null then
      raise exception 'El tipo de incentivo seleccionado exige trabajador reemplazado';
    end if;

    replacement_payload := public.get_hr_incentive_worker_context(
      p_replacement_buk_employee_id
    ) -> 'worker';
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
    nullif(trim(coalesce(replacement_payload ->> 'document_number', '')), ''),
    nullif(trim(coalesce(replacement_payload ->> 'full_name', '')), ''),
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
    'P',
    current_user_id
  )
  returning hir.id, hir.folio into new_request_id, new_folio;

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
      'is_contract_mismatch', resolved_is_contract_mismatch
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

create or replace function public.get_hr_incentive_requests(
  p_period_code text default null,
  p_status text default 'A',
  p_contract_code text default null,
  p_worker_search text default null,
  p_type_id uuid default null,
  p_service_date_until date default null
)
returns table (
  id uuid,
  folio bigint,
  employee_full_name text,
  employee_document_number text,
  employee_job_title text,
  replacement_full_name text,
  replacement_document_number text,
  motive text,
  description text,
  incentive_type_name text,
  calculated_amount numeric,
  period_code text,
  selected_area_name text,
  selected_contract_code text,
  created_at timestamptz,
  service_date timestamptz,
  duration_hours numeric,
  requester_name text,
  status text,
  current_flow_user text,
  cancellation_comment text,
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
  normalized_search text := lower(trim(coalesce(p_worker_search, '')));
  normalized_status text := upper(trim(coalesce(p_status, 'A')));
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para ver incentivos';
  end if;

  return query
  select
    hir.id,
    hir.folio,
    hir.employee_full_name,
    hir.employee_document_number,
    hir.employee_job_title,
    hir.replacement_full_name,
    hir.replacement_document_number,
    hir.motive,
    hir.description,
    hir.incentive_type_name,
    hir.calculated_amount,
    hir.period_code,
    hir.selected_area_name,
    hir.selected_contract_code,
    hir.created_at,
    hir.service_date,
    hir.duration_hours,
    coalesce(requester_profile.full_name, requester_profile.email, 'Usuario no disponible') as requester_name,
    hir.status,
    pending_approval.approver_name as current_flow_user,
    hir.cancellation_comment,
    hir.entry_lag_days,
    hir.is_out_of_deadline,
    hir.is_contract_mismatch
  from public.hr_incentive_requests hir
  left join public.profiles requester_profile
    on requester_profile.id = hir.created_by
  left join lateral (
    select
      hira.approver_name
    from public.hr_incentive_request_approvals hira
    where hira.incentive_request_id = hir.id
      and hira.status = 'pending'
    order by hira.step_order asc, hira.created_at asc
    limit 1
  ) pending_approval on true
  where
    (p_period_code is null or trim(p_period_code) = '' or hir.period_code = trim(p_period_code))
    and (normalized_status = 'A' or hir.status = normalized_status)
    and (p_contract_code is null or trim(p_contract_code) = '' or hir.selected_contract_code = trim(p_contract_code))
    and (p_type_id is null or hir.incentive_type_id = p_type_id)
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
  order by hir.created_at desc, hir.folio desc;
end;
$function$;

create or replace function public.get_hr_incentive_approval_queue()
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
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  can_view_all boolean := false;
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
  select
    hira.id,
    hir.id,
    hir.folio,
    hira.step_code,
    hira.step_name,
    hira.step_order,
    hira.status,
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
  order by hira.step_order asc, hir.service_date asc, hir.created_at asc, hir.folio asc;
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
      'current_step_code', pending_approval.step_code,
      'current_step_name', pending_approval.step_name,
      'current_approver_name', pending_approval.approver_name,
      'cancelled_at', hir.cancelled_at,
      'cancellation_comment', hir.cancellation_comment,
      'created_at', hir.created_at,
      'updated_at', hir.updated_at
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
        order by hira.step_order asc, hira.created_at asc
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
          'actor_name', coalesce(actor_profile.full_name, actor_profile.email, 'Usuario no disponible'),
          'comment', hih.comment,
          'metadata', hih.metadata,
          'created_at', hih.created_at
        )
        order by hih.created_at desc, hih.id desc
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
  ) pending_approval on true
  where hir.id = p_request_id;

  if request_payload is null then
    raise exception 'No existe el incentivo solicitado';
  end if;

  return request_payload;
end;
$function$;

revoke all on function public.resolve_hr_incentive_period_code(timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_hr_incentive_period_code(timestamptz) to authenticated;

revoke all on function public.resolve_hr_incentive_entry_lag_days(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_hr_incentive_entry_lag_days(timestamptz, timestamptz) to authenticated;

revoke all on function public.resolve_hr_incentive_contract_mismatch(text, text) from public, anon, authenticated;
grant execute on function public.resolve_hr_incentive_contract_mismatch(text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
