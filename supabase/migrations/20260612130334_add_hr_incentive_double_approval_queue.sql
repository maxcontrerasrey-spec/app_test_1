begin;

create table if not exists public.hr_incentive_request_approvals (
  id bigint generated always as identity primary key,
  incentive_request_id uuid not null references public.hr_incentive_requests (id) on delete cascade,
  step_code text not null
    check (step_code in ('contract_admin', 'area_manager')),
  step_name text not null,
  step_order integer not null check (step_order > 0),
  approver_user_id uuid null references public.profiles (id) on delete restrict,
  approver_name text not null,
  approver_email text null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_by uuid null references public.profiles (id) on delete set null,
  decision_comment text null,
  decided_at timestamptz null,
  locked_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hr_incentive_request_approvals_request_step_unique
    unique (incentive_request_id, step_code)
);

create index if not exists idx_hr_incentive_request_approvals_pending
  on public.hr_incentive_request_approvals (approver_user_id, status, step_order, created_at desc);

create index if not exists idx_hr_incentive_request_approvals_request
  on public.hr_incentive_request_approvals (incentive_request_id, step_order, created_at desc);

drop trigger if exists trg_hr_incentive_request_approvals_set_updated_at on public.hr_incentive_request_approvals;
create trigger trg_hr_incentive_request_approvals_set_updated_at
before update on public.hr_incentive_request_approvals
for each row
execute function public.set_updated_at();

alter table public.hr_incentive_request_approvals enable row level security;

drop policy if exists hr_incentive_request_approvals_no_direct_access on public.hr_incentive_request_approvals;
create policy hr_incentive_request_approvals_no_direct_access
on public.hr_incentive_request_approvals
for all
to authenticated
using (false)
with check (false);

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

  select *
  into contract_admin_profile_row
  from public.profiles p
  where lower(trim(coalesce(p.full_name, ''))) =
        lower(trim(contract_admin_mapping_row.contract_admin_name))
    and p.status = 'active'
  order by p.updated_at desc, p.created_at desc
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
  p_replacement_buk_employee_id text default null
)
returns table (
  request_id uuid,
  folio bigint,
  status text,
  calculated_amount numeric
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
  resolved_service_at timestamptz := coalesce(p_service_date, timezone('utc', now()));
  resolved_period_code text := to_char(coalesce(p_service_date, timezone('utc', now())), 'YYYYMM');
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

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_data := worker_payload -> 'worker';
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

    replacement_payload := public.get_hr_incentive_worker_context(p_replacement_buk_employee_id) -> 'worker';
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
      'calculated_amount', (preview_payload ->> 'calculated_amount')::numeric
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
      'status', 'pending'
    )
  );

  return query
  select
    new_request_id,
    new_folio,
    'P'::text,
    (preview_payload ->> 'calculated_amount')::numeric;
end;
$function$;

create or replace function public.cancel_hr_incentive_request(
  p_request_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para anular incentivos';
  end if;

  update public.hr_incentive_requests hir
     set status = 'C',
         cancelled_at = timezone('utc', now()),
         cancelled_by = current_user_id,
         cancellation_comment = normalized_comment
   where hir.id = p_request_id
     and hir.status <> 'C';

  if not found then
    raise exception 'Incentivo no encontrado o ya anulado';
  end if;

  update public.hr_incentive_request_approvals hira
     set status = 'cancelled',
         decision_by = current_user_id,
         decision_comment = coalesce(normalized_comment, 'Incentivo anulado'),
         decided_at = timezone('utc', now()),
         locked_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where hira.incentive_request_id = p_request_id
     and hira.status = 'pending';

  insert into public.hr_incentive_request_history (
    incentive_request_id,
    action_type,
    actor_user_id,
    comment
  )
  values (
    p_request_id,
    'cancelled',
    current_user_id,
    normalized_comment
  );
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
  cancellation_comment text
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
    hir.cancellation_comment
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
       set status = 'R'
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
    select *
    into next_step_approver_row
    from public.resolve_hr_incentive_contract_approvers(request_row.selected_contract_code);

    if exists (
      select 1
      from public.hr_incentive_request_approvals hira_existing
      where hira_existing.incentive_request_id = request_row.id
        and hira_existing.step_code = 'area_manager'
    ) then
      raise exception 'La aprobacion de gerente de area ya existe para este incentivo';
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
      next_step_approver_row.area_manager_user_id,
      next_step_approver_row.area_manager_name,
      next_step_approver_row.area_manager_email,
      'pending',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id into next_approval_id;

    update public.hr_incentive_requests hir
       set status = 'E'
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
        'approver_user_id', next_step_approver_row.area_manager_user_id,
        'approver_name', next_step_approver_row.area_manager_name,
        'approver_email', next_step_approver_row.area_manager_email,
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
     set status = 'F'
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

create or replace function public.bulk_decide_hr_incentive_request_approvals(
  p_approval_ids bigint[],
  p_decision text,
  p_comment text default null
)
returns table (
  approval_id bigint,
  request_id uuid,
  success boolean,
  request_status text,
  error text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_approval_id bigint;
  decision_row record;
begin
  if coalesce(array_length(p_approval_ids, 1), 0) = 0 then
    raise exception 'Debe seleccionar al menos una aprobacion';
  end if;

  foreach current_approval_id in array p_approval_ids
  loop
    begin
      select *
      into decision_row
      from public.decide_hr_incentive_request_approval(
        current_approval_id,
        p_decision,
        p_comment
      );

      approval_id := current_approval_id;
      request_id := decision_row.request_id;
      success := true;
      request_status := decision_row.request_status;
      error := null;
      return next;
    exception
      when others then
        approval_id := current_approval_id;
        request_id := null;
        success := false;
        request_status := null;
        error := SQLERRM;
        return next;
    end;
  end loop;
end;
$function$;

revoke all on table public.hr_incentive_request_approvals from public, anon, authenticated;

revoke all on function public.resolve_hr_incentive_contract_approvers(text) from public, anon, authenticated;
grant execute on function public.resolve_hr_incentive_contract_approvers(text) to authenticated;

revoke all on function public.get_hr_incentive_approval_queue() from public, anon, authenticated;
grant execute on function public.get_hr_incentive_approval_queue() to authenticated;

revoke all on function public.get_hr_incentive_request_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_hr_incentive_request_detail(uuid) to authenticated;

revoke all on function public.decide_hr_incentive_request_approval(bigint, text, text) from public, anon, authenticated;
grant execute on function public.decide_hr_incentive_request_approval(bigint, text, text) to authenticated;

revoke all on function public.bulk_decide_hr_incentive_request_approvals(bigint[], text, text) from public, anon, authenticated;
grant execute on function public.bulk_decide_hr_incentive_request_approvals(bigint[], text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
