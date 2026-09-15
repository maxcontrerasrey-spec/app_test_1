-- EEES-DB-005: approved
-- owner: Engineering and Human Resources
-- rollback: forward-only; restore the prior RPC definitions and grants through a later migration if required.

begin;

create or replace function private.assert_hr_incentive_feature_access(
  p_feature_codes text[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if jwt_role = 'service_role' then
    return;
  end if;

  if actor_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if public.user_is_admin(actor_id) then
    return;
  end if;

  if not exists (
    select 1
    from unnest(coalesce(p_feature_codes, '{}'::text[])) as feature_code(value)
    where public.user_can_access_feature(actor_id, feature_code.value)
  ) then
    raise exception 'Sin permisos para esta operación de incentivos';
  end if;
end;
$function$;

revoke all on function private.assert_hr_incentive_feature_access(text[]) from public, anon, authenticated;

alter function public.get_hr_incentive_setup_catalogs()
  rename to hr_incentive_setup_catalogs_impl;
alter function public.search_hr_incentive_eligible_workers(text, integer)
  rename to hr_incentive_worker_search_impl;
alter function public.get_hr_incentive_worker_context(text)
  rename to hr_incentive_worker_context_impl;
alter function public.get_hr_incentive_eligible_types(text, text, date)
  rename to hr_incentive_eligible_types_impl;
alter function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date, numeric)
  rename to hr_incentive_preview_impl;
alter function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric, uuid)
  rename to hr_incentive_create_request_impl;
alter function public.cancel_hr_incentive_request(uuid, text)
  rename to hr_incentive_cancel_request_impl;
alter function public.get_hr_incentive_requests(text, text[], text[], text, uuid[], date, integer, integer, text, text)
  rename to hr_incentive_requests_impl;
alter function public.get_hr_incentive_approval_queue(text, integer, integer, text, text)
  rename to hr_incentive_approval_queue_impl;
alter function public.get_hr_incentive_request_detail(uuid)
  rename to hr_incentive_request_detail_impl;
alter function public.decide_hr_incentive_request_approval(bigint, text, text)
  rename to hr_incentive_decide_approval_impl;
alter function public.bulk_decide_hr_incentive_request_approvals(bigint[], text, text)
  rename to hr_incentive_bulk_decide_impl;
alter function public.add_hr_incentive_allowed_job_title(text)
  rename to hr_incentive_add_job_title_impl;
alter function public.set_hr_incentive_allowed_job_title_status(uuid, boolean)
  rename to hr_incentive_set_job_title_status_impl;
alter function public.add_hr_incentive_type(text, text, text, boolean, boolean, text)
  rename to hr_incentive_add_type_impl;
alter function public.set_hr_incentive_type_status(uuid, boolean)
  rename to hr_incentive_set_type_status_impl;
alter function public.set_hr_incentive_type_roster_requirement(uuid, boolean)
  rename to hr_incentive_set_type_roster_impl;
alter function public.set_hr_incentive_type_manual_amount_option(uuid, boolean)
  rename to hr_incentive_set_type_manual_impl;
alter function public.set_hr_incentive_type_hour_rate_strategy(uuid, text)
  rename to hr_incentive_set_type_hour_rate_impl;
alter function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, text, text, integer, date, date, numeric, numeric, numeric)
  rename to hr_incentive_add_rate_rule_impl;
alter function public.set_hr_incentive_rate_rule_status(uuid, boolean)
  rename to hr_incentive_set_rate_rule_status_impl;

create function public.get_hr_incentive_setup_catalogs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array[
    'hr_incentives_register',
    'hr_incentives_history',
    'hr_incentives_configuration'
  ]);
  return public.hr_incentive_setup_catalogs_impl();
end;
$function$;

create function public.search_hr_incentive_eligible_workers(
  p_search text default null,
  p_limit integer default 20
)
returns table (
  buk_employee_id text,
  full_name text,
  document_number text,
  job_title text,
  contract_code text,
  area_name text,
  display_label text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_register']);
  return query
  select * from public.hr_incentive_worker_search_impl(p_search, p_limit);
end;
$function$;

create function public.get_hr_incentive_worker_context(p_buk_employee_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_register']);
  return public.hr_incentive_worker_context_impl(p_buk_employee_id);
end;
$function$;

create function public.get_hr_incentive_eligible_types(
  p_buk_employee_id text,
  p_selected_contract_code text,
  p_service_date date default null
)
returns table (
  id uuid,
  code text,
  name text,
  calculation_basis text,
  hour_rate_strategy text,
  requires_replacement boolean,
  requires_rest_day boolean,
  allows_manual_amount boolean,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_register']);
  return query
  select *
  from public.hr_incentive_eligible_types_impl(
    p_buk_employee_id,
    p_selected_contract_code,
    p_service_date
  );
end;
$function$;

create function public.calculate_hr_incentive_preview(
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_duration_hours numeric default null,
  p_service_date date default null,
  p_manual_amount numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_register']);
  return public.hr_incentive_preview_impl(
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_duration_hours,
    p_service_date,
    p_manual_amount
  );
end;
$function$;

create function public.create_hr_incentive_request(
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_selected_area_name text,
  p_selected_area_code text,
  p_service_date timestamptz,
  p_duration_hours numeric,
  p_motive text,
  p_description text,
  p_replacement_buk_employee_id text,
  p_declared_rest_day boolean,
  p_manual_amount numeric,
  p_idempotency_key uuid
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
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_register']);
  return query
  select *
  from public.hr_incentive_create_request_impl(
    p_buk_employee_id,
    p_incentive_type_id,
    p_selected_contract_code,
    p_selected_area_name,
    p_selected_area_code,
    p_service_date,
    p_duration_hours,
    p_motive,
    p_description,
    p_replacement_buk_employee_id,
    p_declared_rest_day,
    p_manual_amount,
    p_idempotency_key
  );
end;
$function$;

create function public.cancel_hr_incentive_request(
  p_request_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_history']);
  perform public.hr_incentive_cancel_request_impl(p_request_id, p_comment);
end;
$function$;

create function public.get_hr_incentive_requests(
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
  amount_source text,
  manual_amount numeric,
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
stable
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_history']);
  return query
  select *
  from public.hr_incentive_requests_impl(
    p_period_code,
    p_statuses,
    p_contract_codes,
    p_worker_search,
    p_type_ids,
    p_service_date_until,
    p_limit,
    p_offset,
    p_sort_column,
    p_sort_direction
  );
end;
$function$;

create function public.get_hr_incentive_approval_queue(
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
stable
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_approvals']);
  return query
  select *
  from public.hr_incentive_approval_queue_impl(
    p_search,
    p_limit,
    p_offset,
    p_sort_column,
    p_sort_direction
  );
end;
$function$;

create function public.get_hr_incentive_request_detail(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array[
    'hr_incentives_history',
    'hr_incentives_approvals'
  ]);
  return public.hr_incentive_request_detail_impl(p_request_id);
end;
$function$;

create function public.decide_hr_incentive_request_approval(
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
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_approvals']);
  return query
  select *
  from public.hr_incentive_decide_approval_impl(p_approval_id, p_decision, p_comment);
end;
$function$;

create function public.bulk_decide_hr_incentive_request_approvals(
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
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_approvals']);
  return query
  select *
  from public.hr_incentive_bulk_decide_impl(p_approval_ids, p_decision, p_comment);
end;
$function$;

create function public.add_hr_incentive_allowed_job_title(p_job_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_configuration']);
  return public.hr_incentive_add_job_title_impl(p_job_title);
end;
$function$;

create function public.set_hr_incentive_allowed_job_title_status(
  p_job_title_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_configuration']);
  perform public.hr_incentive_set_job_title_status_impl(p_job_title_id, p_is_active);
end;
$function$;

create function public.add_hr_incentive_type(
  p_code text,
  p_name text,
  p_calculation_basis text,
  p_requires_replacement boolean default false,
  p_allows_manual_amount boolean default false,
  p_hour_rate_strategy text default 'rule_amount'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_configuration']);
  return public.hr_incentive_add_type_impl(
    p_code,
    p_name,
    p_calculation_basis,
    p_requires_replacement,
    p_allows_manual_amount,
    p_hour_rate_strategy
  );
end;
$function$;

create function public.set_hr_incentive_type_status(
  p_type_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_configuration']);
  perform public.hr_incentive_set_type_status_impl(p_type_id, p_is_active);
end;
$function$;

create function public.set_hr_incentive_type_roster_requirement(
  p_type_id uuid,
  p_requires_rest_day boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_configuration']);
  perform public.hr_incentive_set_type_roster_impl(p_type_id, p_requires_rest_day);
end;
$function$;

create function public.set_hr_incentive_type_manual_amount_option(
  p_type_id uuid,
  p_allows_manual_amount boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_configuration']);
  perform public.hr_incentive_set_type_manual_impl(p_type_id, p_allows_manual_amount);
end;
$function$;

create function public.set_hr_incentive_type_hour_rate_strategy(
  p_type_id uuid,
  p_hour_rate_strategy text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_configuration']);
  perform public.hr_incentive_set_type_hour_rate_impl(p_type_id, p_hour_rate_strategy);
end;
$function$;

create function public.add_hr_incentive_rate_rule(
  p_incentive_type_id uuid,
  p_amount numeric,
  p_contract_code text default null,
  p_job_title text default null,
  p_union_name text default null,
  p_union_status text default null,
  p_priority integer default 100,
  p_valid_from date default null,
  p_valid_to date default null,
  p_fallback_base_salary numeric default null,
  p_fallback_weekly_hours numeric default null,
  p_overtime_multiplier numeric default 1.5
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_configuration']);
  return public.hr_incentive_add_rate_rule_impl(
    p_incentive_type_id,
    p_amount,
    p_contract_code,
    p_job_title,
    p_union_name,
    p_union_status,
    p_priority,
    p_valid_from,
    p_valid_to,
    p_fallback_base_salary,
    p_fallback_weekly_hours,
    p_overtime_multiplier
  );
end;
$function$;

create function public.set_hr_incentive_rate_rule_status(
  p_rule_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_feature_access(array['hr_incentives_configuration']);
  perform public.hr_incentive_set_rate_rule_status_impl(p_rule_id, p_is_active);
end;
$function$;

revoke all on function public.get_hr_incentive_setup_catalogs() from public, anon, authenticated;
revoke all on function public.search_hr_incentive_eligible_workers(text, integer) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_worker_context(text) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_eligible_types(text, text, date) from public, anon, authenticated;
revoke all on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date, numeric) from public, anon, authenticated;
revoke all on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric, uuid) from public, anon, authenticated;
revoke all on function public.cancel_hr_incentive_request(uuid, text) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_requests(text, text[], text[], text, uuid[], date, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_approval_queue(text, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_request_detail(uuid) from public, anon, authenticated;
revoke all on function public.decide_hr_incentive_request_approval(bigint, text, text) from public, anon, authenticated;
revoke all on function public.bulk_decide_hr_incentive_request_approvals(bigint[], text, text) from public, anon, authenticated;
revoke all on function public.add_hr_incentive_allowed_job_title(text) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_allowed_job_title_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.add_hr_incentive_type(text, text, text, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_type_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_type_roster_requirement(uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_type_manual_amount_option(uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_type_hour_rate_strategy(uuid, text) from public, anon, authenticated;
revoke all on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, text, text, integer, date, date, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_rate_rule_status(uuid, boolean) from public, anon, authenticated;

grant execute on function public.get_hr_incentive_setup_catalogs() to authenticated, service_role;
grant execute on function public.search_hr_incentive_eligible_workers(text, integer) to authenticated, service_role;
grant execute on function public.get_hr_incentive_worker_context(text) to authenticated, service_role;
grant execute on function public.get_hr_incentive_eligible_types(text, text, date) to authenticated, service_role;
grant execute on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date, numeric) to authenticated, service_role;
grant execute on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric, uuid) to authenticated, service_role;
grant execute on function public.cancel_hr_incentive_request(uuid, text) to authenticated, service_role;
grant execute on function public.get_hr_incentive_requests(text, text[], text[], text, uuid[], date, integer, integer, text, text) to authenticated, service_role;
grant execute on function public.get_hr_incentive_approval_queue(text, integer, integer, text, text) to authenticated, service_role;
grant execute on function public.get_hr_incentive_request_detail(uuid) to authenticated, service_role;
grant execute on function public.decide_hr_incentive_request_approval(bigint, text, text) to authenticated, service_role;
grant execute on function public.bulk_decide_hr_incentive_request_approvals(bigint[], text, text) to authenticated, service_role;
grant execute on function public.add_hr_incentive_allowed_job_title(text) to authenticated, service_role;
grant execute on function public.set_hr_incentive_allowed_job_title_status(uuid, boolean) to authenticated, service_role;
grant execute on function public.add_hr_incentive_type(text, text, text, boolean, boolean, text) to authenticated, service_role;
grant execute on function public.set_hr_incentive_type_status(uuid, boolean) to authenticated, service_role;
grant execute on function public.set_hr_incentive_type_roster_requirement(uuid, boolean) to authenticated, service_role;
grant execute on function public.set_hr_incentive_type_manual_amount_option(uuid, boolean) to authenticated, service_role;
grant execute on function public.set_hr_incentive_type_hour_rate_strategy(uuid, text) to authenticated, service_role;
grant execute on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, text, text, integer, date, date, numeric, numeric, numeric) to authenticated, service_role;
grant execute on function public.set_hr_incentive_rate_rule_status(uuid, boolean) to authenticated, service_role;

revoke all on function public.hr_incentive_setup_catalogs_impl() from public, anon, authenticated;
revoke all on function public.hr_incentive_worker_search_impl(text, integer) from public, anon, authenticated;
revoke all on function public.hr_incentive_worker_context_impl(text) from public, anon, authenticated;
revoke all on function public.hr_incentive_eligible_types_impl(text, text, date) from public, anon, authenticated;
revoke all on function public.hr_incentive_preview_impl(text, uuid, text, numeric, date, numeric) from public, anon, authenticated;
revoke all on function public.hr_incentive_create_request_impl(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric, uuid) from public, anon, authenticated;
revoke all on function public.hr_incentive_cancel_request_impl(uuid, text) from public, anon, authenticated;
revoke all on function public.hr_incentive_requests_impl(text, text[], text[], text, uuid[], date, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.hr_incentive_approval_queue_impl(text, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.hr_incentive_request_detail_impl(uuid) from public, anon, authenticated;
revoke all on function public.hr_incentive_decide_approval_impl(bigint, text, text) from public, anon, authenticated;
revoke all on function public.hr_incentive_bulk_decide_impl(bigint[], text, text) from public, anon, authenticated;
revoke all on function public.hr_incentive_add_job_title_impl(text) from public, anon, authenticated;
revoke all on function public.hr_incentive_set_job_title_status_impl(uuid, boolean) from public, anon, authenticated;
revoke all on function public.hr_incentive_add_type_impl(text, text, text, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.hr_incentive_set_type_status_impl(uuid, boolean) from public, anon, authenticated;
revoke all on function public.hr_incentive_set_type_roster_impl(uuid, boolean) from public, anon, authenticated;
revoke all on function public.hr_incentive_set_type_manual_impl(uuid, boolean) from public, anon, authenticated;
revoke all on function public.hr_incentive_set_type_hour_rate_impl(uuid, text) from public, anon, authenticated;
revoke all on function public.hr_incentive_add_rate_rule_impl(uuid, numeric, text, text, text, text, integer, date, date, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.hr_incentive_set_rate_rule_status_impl(uuid, boolean) from public, anon, authenticated;

revoke all on function public.assert_hr_incentive_period_folio_integrity(text) from public, anon, authenticated;
revoke all on function public.audit_hr_incentive_period_folio_integrity(text) from public, anon, authenticated;
revoke all on function public.build_hr_incentive_preview_from_worker_data(jsonb, text, uuid, text, numeric, date) from public, anon, authenticated;
revoke all on function public.build_hr_incentive_preview_from_worker_data(jsonb, text, uuid, text, numeric, date, numeric) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_worker_core(text) from public, anon, authenticated;
revoke all on function public.resolve_hr_incentive_contract_approvers(text) from public, anon, authenticated;
revoke all on function public.resolve_hr_incentive_hour_rate(text, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.resolve_hr_incentive_rate_rule(uuid, text, text, text, text, date) from public, anon, authenticated;
revoke all on function public.run_hr_incentive_period_folio_integrity_audit() from public, anon, authenticated;
revoke all on function public.sync_hr_incentive_request_current_approver(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
