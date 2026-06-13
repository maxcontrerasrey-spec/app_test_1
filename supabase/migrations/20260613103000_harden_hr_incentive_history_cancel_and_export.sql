drop function if exists public.get_hr_incentive_requests(
  text,
  text,
  text,
  text,
  uuid,
  date
);

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
  can_cancel boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  can_cancel := public.user_is_admin(current_user_id)
    or public.user_has_role(current_user_id, 'control_contratos');

  if not can_cancel then
    raise exception 'Sin permisos para anular incentivos';
  end if;

  update public.hr_incentive_requests hir
     set status = 'C',
         cancelled_at = timezone('utc', now()),
         cancelled_by = current_user_id,
         cancellation_comment = normalized_comment,
         updated_at = timezone('utc', now())
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

revoke all on function public.cancel_hr_incentive_request(uuid, text) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_requests(text, text, text, text, uuid, date) from public, anon, authenticated;

grant execute on function public.cancel_hr_incentive_request(uuid, text) to authenticated;
grant execute on function public.get_hr_incentive_requests(text, text, text, text, uuid, date) to authenticated;

notify pgrst, 'reload schema';
