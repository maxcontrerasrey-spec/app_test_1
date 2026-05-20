begin;

update public.hiring_approval_configs
set step_code = 'area_manager',
    step_name = 'Gerente de area',
    updated_at = timezone('utc', now())
where step_code = 'operational_approval';

update public.hiring_request_approvals
set step_code = 'area_manager',
    step_name = 'Gerente de area',
    updated_at = timezone('utc', now())
where step_code = 'operational_approval';

alter table public.hiring_approval_configs
  drop constraint if exists hiring_approval_configs_step_code_check;

alter table public.hiring_approval_configs
  add constraint hiring_approval_configs_step_code_check
  check (step_code in ('area_manager', 'contracts_control'));

alter table public.hiring_request_approvals
  drop constraint if exists hiring_request_approvals_step_code_check;

alter table public.hiring_request_approvals
  add constraint hiring_request_approvals_step_code_check
  check (step_code in ('requester_signature', 'area_manager', 'contracts_control'));

create or replace function public.refresh_hiring_request_status(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  has_rejection boolean;
  has_area_manager_step boolean;
  has_contracts_step boolean;
  has_pending boolean;
  all_required_approved boolean;
begin
  select exists (
    select 1
    from public.hiring_request_approvals
    where hiring_request_id = target_request_id
      and status = 'rejected'
  ) into has_rejection;

  if has_rejection then
    update public.hiring_requests
    set status = 'rechazada',
        updated_at = timezone('utc', now())
    where id = target_request_id;
    return;
  end if;

  select exists (
    select 1
    from public.hiring_request_approvals
    where hiring_request_id = target_request_id
      and step_code = 'area_manager'
  ) into has_area_manager_step;

  select exists (
    select 1
    from public.hiring_request_approvals
    where hiring_request_id = target_request_id
      and step_code = 'contracts_control'
  ) into has_contracts_step;

  select exists (
    select 1
    from public.hiring_request_approvals
    where hiring_request_id = target_request_id
      and step_code in ('area_manager', 'contracts_control')
      and status = 'pending'
  ) into has_pending;

  select coalesce(bool_and(status = 'approved'), false)
    from public.hiring_request_approvals
   where hiring_request_id = target_request_id
     and step_code in ('requester_signature', 'area_manager', 'contracts_control')
  into all_required_approved;

  if not has_area_manager_step or not has_contracts_step or has_pending or not all_required_approved then
    update public.hiring_requests
    set status = 'pendiente',
        updated_at = timezone('utc', now())
    where id = target_request_id;
    return;
  end if;

  update public.hiring_requests
  set status = 'aprobada',
      updated_at = timezone('utc', now())
  where id = target_request_id;
end;
$$;

create or replace function public.create_hiring_request_v2(
  p_campamento boolean,
  p_contract_id bigint,
  p_contract_name text,
  p_contract_number text,
  p_cost_center_code text,
  p_cost_center_name text,
  p_cost_unit text,
  p_cost_unit_name text,
  p_end_date date,
  p_job_position_id bigint,
  p_job_position_name text,
  p_other_benefits text,
  p_pasajes boolean,
  p_requested_entry_date date,
  p_requester_signed boolean,
  p_salary_offer numeric,
  p_shift_id bigint,
  p_shift_name text,
  p_start_date date,
  p_vacancies integer
)
returns table(request_id uuid, folio text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  next_folio text;
  created_request_id uuid;
  user_email text;
  user_name text;
  user_position text;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_module(current_user_id, 'solicitud_contrataciones') then
    raise exception 'Sin permisos para crear solicitudes';
  end if;

  select
    u.email,
    coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'display_name',
      split_part(u.email, '@', 1)
    ),
    coalesce(
      u.raw_user_meta_data->>'job_title',
      u.raw_user_meta_data->>'position'
    )
  into user_email, user_name, user_position
  from auth.users u
  where u.id = current_user_id;

  if user_email is null then
    raise exception 'No se pudo resolver correo del usuario';
  end if;

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
    created_at,
    updated_at,
    requester_position,
    requested_position_id,
    requested_position_name,
    cost_unit_code,
    needs_camp,
    needs_tickets,
    exclusive_hr_notes,
    requester_signed_at
  )
  values (
    next_folio,
    current_user_id,
    user_name,
    user_position,
    user_email,
    p_requested_entry_date,
    p_job_position_id,
    p_job_position_name,
    p_vacancies,
    p_contract_id,
    p_contract_name,
    p_contract_number,
    p_cost_unit,
    p_cost_unit_name,
    p_cost_center_code,
    p_cost_center_name,
    p_start_date,
    p_end_date,
    p_campamento,
    p_pasajes,
    p_other_benefits,
    p_salary_offer,
    p_shift_id,
    p_shift_name,
    p_requester_signed,
    'pendiente',
    now(),
    now(),
    user_position,
    p_job_position_id,
    p_job_position_name,
    p_cost_unit,
    p_campamento,
    p_pasajes,
    p_other_benefits,
    case when p_requester_signed then now() else null end
  )
  returning id into created_request_id;

  insert into public.hiring_request_approvals (
    hiring_request_id,
    step_code,
    step_name,
    step_order,
    approver_user_id,
    status,
    decided_at,
    created_at,
    updated_at
  )
  values (
    created_request_id,
    'requester_signature',
    'Firma solicitante',
    1,
    current_user_id,
    case when p_requester_signed then 'approved' else 'pending' end,
    case when p_requester_signed then now() else null end,
    now(),
    now()
  )
  on conflict (hiring_request_id, step_code) do nothing;

  insert into public.hiring_request_approvals (
    hiring_request_id,
    step_code,
    step_name,
    step_order,
    approver_user_id,
    status,
    created_at,
    updated_at
  )
  select
    created_request_id,
    c.step_code,
    c.step_name,
    c.step_order,
    c.approver_user_id,
    'pending',
    now(),
    now()
  from public.hiring_approval_configs c
  where c.is_active = true
    and c.step_code in ('area_manager', 'contracts_control')
  on conflict (hiring_request_id, step_code) do nothing;

  return query
  select created_request_id, next_folio;
end;
$$;

grant execute on function public.create_hiring_request_v2(
  boolean,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  bigint,
  text,
  text,
  boolean,
  date,
  boolean,
  numeric,
  bigint,
  text,
  date,
  integer
) to authenticated;

commit;
