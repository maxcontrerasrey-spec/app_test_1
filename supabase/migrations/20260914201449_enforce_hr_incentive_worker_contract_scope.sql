-- EEES-DB-005: approved
-- owner: Engineering and Human Resources
-- rollback: forward-only; restore the prior RPC definitions through a later migration if required.

begin;

create or replace function private.hr_incentive_worker_has_contract(
  p_buk_employee_id text,
  p_contract_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with target_worker as (
    select
      coalesce(nullif(trim(e.document_type), ''), 'rut') as document_type,
      coalesce(
        nullif(regexp_replace(upper(coalesce(e.document_number, '')), '[^0-9K]', '', 'g'), ''),
        e.buk_employee_id
      ) as identity_value
    from public.employees_active_current e
    where e.buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    limit 1
  )
  select exists (
    select 1
    from target_worker tw
    join public.employees e
      on coalesce(nullif(trim(e.document_type), ''), 'rut') = tw.document_type
     and coalesce(
       nullif(regexp_replace(upper(coalesce(e.document_number, '')), '[^0-9K]', '', 'g'), ''),
       e.buk_employee_id
     ) = tw.identity_value
    join public.buk_contract_mappings bcm
      on bcm.buk_area_name_normalized = public.normalize_buk_area_name(e.area_name)
     and bcm.is_operational = true
     and bcm.is_one_to_one = true
     and bcm.contract_id is not null
    join public.contracts c
      on c.id = bcm.contract_id
     and c.is_active = true
    where c.code = trim(coalesce(p_contract_code, ''))
  );
$function$;

create or replace function private.assert_hr_incentive_worker_contract(
  p_buk_employee_id text,
  p_contract_code text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.hr_incentive_worker_has_contract(p_buk_employee_id, p_contract_code) then
    raise exception
      'El trabajador no tiene una asociación BUK con el contrato seleccionado. Corrige su mapeo contractual antes de registrar el incentivo.';
  end if;
end;
$function$;

revoke all on function private.hr_incentive_worker_has_contract(text, text) from public, anon, authenticated;
revoke all on function private.assert_hr_incentive_worker_contract(text, text) from public, anon, authenticated;

alter function public.hr_incentive_worker_context_impl(text)
  rename to hr_incentive_worker_context_unscoped_impl;
alter function public.hr_incentive_eligible_types_impl(text, text, date)
  rename to hr_incentive_eligible_types_unscoped_impl;
alter function public.hr_incentive_preview_impl(text, uuid, text, numeric, date, numeric)
  rename to hr_incentive_preview_unscoped_impl;
alter function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric)
  rename to hr_incentive_create_request_unscoped_contract_impl;

create function public.hr_incentive_worker_context_impl(p_buk_employee_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  context_payload jsonb;
  scoped_areas jsonb;
begin
  context_payload := public.hr_incentive_worker_context_unscoped_impl(p_buk_employee_id);

  select coalesce(jsonb_agg(area_option.value order by area_option.ordinality), '[]'::jsonb)
  into scoped_areas
  from jsonb_array_elements(coalesce(context_payload -> 'available_areas', '[]'::jsonb))
    with ordinality as area_option(value, ordinality)
  where private.hr_incentive_worker_has_contract(
    p_buk_employee_id,
    area_option.value ->> 'contract_code'
  );

  return jsonb_set(context_payload, '{available_areas}', scoped_areas, true);
end;
$function$;

create function public.hr_incentive_eligible_types_impl(
  p_buk_employee_id text,
  p_selected_contract_code text,
  p_service_date date
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
  perform private.assert_hr_incentive_worker_contract(p_buk_employee_id, p_selected_contract_code);
  return query
  select *
  from public.hr_incentive_eligible_types_unscoped_impl(
    p_buk_employee_id,
    p_selected_contract_code,
    p_service_date
  );
end;
$function$;

create function public.hr_incentive_preview_impl(
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_duration_hours numeric,
  p_service_date date,
  p_manual_amount numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform private.assert_hr_incentive_worker_contract(p_buk_employee_id, p_selected_contract_code);
  return public.hr_incentive_preview_unscoped_impl(
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
  p_selected_area_code text default null,
  p_service_date timestamptz default null,
  p_duration_hours numeric default null,
  p_motive text default null,
  p_description text default null,
  p_replacement_buk_employee_id text default null,
  p_declared_rest_day boolean default null,
  p_manual_amount numeric default null
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
  perform private.assert_hr_incentive_worker_contract(p_buk_employee_id, p_selected_contract_code);
  return query
  select *
  from public.hr_incentive_create_request_unscoped_contract_impl(
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
    p_manual_amount
  );
end;
$function$;

revoke all on function public.hr_incentive_worker_context_unscoped_impl(text) from public, anon, authenticated;
revoke all on function public.hr_incentive_eligible_types_unscoped_impl(text, text, date) from public, anon, authenticated;
revoke all on function public.hr_incentive_preview_unscoped_impl(text, uuid, text, numeric, date, numeric) from public, anon, authenticated;
revoke all on function public.hr_incentive_create_request_unscoped_contract_impl(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric) from public, anon, authenticated;

revoke all on function public.hr_incentive_worker_context_impl(text) from public, anon, authenticated;
revoke all on function public.hr_incentive_eligible_types_impl(text, text, date) from public, anon, authenticated;
revoke all on function public.hr_incentive_preview_impl(text, uuid, text, numeric, date, numeric) from public, anon, authenticated;
revoke all on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
