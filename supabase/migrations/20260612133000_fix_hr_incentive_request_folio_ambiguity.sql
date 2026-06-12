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

  return query
  select
    new_request_id,
    new_folio,
    'P'::text,
    (preview_payload ->> 'calculated_amount')::numeric;
end;
$function$;

revoke all on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text) to authenticated;

notify pgrst, 'reload schema';
