begin;

create or replace function public.build_hr_incentive_preview_from_worker_data(
  p_worker_data jsonb,
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_duration_hours numeric default null,
  p_service_date date default null,
  p_manual_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  resolved_service_date date := coalesce(p_service_date, current_date);
  worker_job_title text;
  worker_union_name text;
  worker_union_status text;
  type_row record;
  rule_row record;
  roster_day_row record;
  conflicting_rest_day_request_row record;
  calculated_amount numeric(12,2);
  resolved_schedule_label text;
  resolved_absence_label text;
  resolved_rest_day_conflict_contract_label text;
  resolved_block_reason text;
  resolved_amount_source text := 'rule';
  resolved_manual_amount numeric(12,2) := null;
  resolved_requires_replacement boolean := false;
  resolved_requires_rest_day boolean := false;
  resolved_calculation_basis text := 'fixed';
  resolved_incentive_type_name text := '';
  resolved_allows_manual_amount boolean := false;
  resolved_rate_rule_id uuid := null;
  resolved_rate_rule_amount numeric(12,2) := 0;
  resolved_matched_contract_code text := null;
  resolved_matched_job_title text := null;
  resolved_matched_union_name text := null;
  resolved_matched_union_status text := null;
  resolved_matched_priority integer := 0;
begin
  if coalesce(jsonb_typeof(p_worker_data), 'null') <> 'object'
     or nullif(trim(coalesce(p_worker_data ->> 'buk_employee_id', '')), '') is null then
    raise exception 'No fue posible resolver el contexto base del trabajador para calcular el incentivo';
  end if;

  worker_job_title := p_worker_data ->> 'job_title';
  worker_union_name := p_worker_data ->> 'union_name';
  worker_union_status := p_worker_data ->> 'union_status';

  select
    it.id,
    it.name,
    it.calculation_basis,
    it.requires_replacement,
    it.requires_rest_day,
    it.allows_manual_amount
  into type_row
  from public.hr_incentive_types it
  where it.id = p_incentive_type_id
    and it.is_active = true;

  if not found then
    raise exception 'No existe un tipo de incentivo activo para la solicitud seleccionada';
  end if;

  resolved_requires_replacement := coalesce(type_row.requires_replacement, false);
  resolved_requires_rest_day := coalesce(type_row.requires_rest_day, false);
  resolved_calculation_basis := coalesce(type_row.calculation_basis, 'fixed');
  resolved_incentive_type_name := coalesce(type_row.name, '');
  resolved_allows_manual_amount := coalesce(type_row.allows_manual_amount, false);

  if p_manual_amount is not null and p_manual_amount < 0 then
    raise exception 'El monto manual no puede ser negativo';
  end if;

  if p_manual_amount is not null and not resolved_allows_manual_amount then
    raise exception 'El tipo de incentivo seleccionado no permite ingresar monto manual';
  end if;

  select *
    into rule_row
  from public.resolve_hr_incentive_rate_rule(
    p_incentive_type_id,
    worker_job_title,
    p_selected_contract_code,
    worker_union_name,
    worker_union_status,
    resolved_service_date
  );

  if rule_row.incentive_type_id is not null then
    resolved_rate_rule_id := rule_row.rate_rule_id;
    resolved_rate_rule_amount := coalesce(rule_row.rate_rule_amount, 0);
    resolved_matched_contract_code := rule_row.matched_contract_code;
    resolved_matched_job_title := rule_row.matched_job_title;
    resolved_matched_union_name := rule_row.matched_union_name;
    resolved_matched_union_status := rule_row.matched_union_status;
    resolved_matched_priority := coalesce(rule_row.matched_priority, 0);
  end if;

  select *
    into roster_day_row
  from public.resolve_hr_roster_day_status(p_buk_employee_id, resolved_service_date);

  if not found then
    raise exception 'No fue posible resolver la pauta operativa del trabajador';
  end if;

  resolved_schedule_label := coalesce(
    roster_day_row.exception_label,
    case roster_day_row.base_status
      when 'resting' then 'Descanso'
      when 'working' then 'Turno'
      when 'unassigned' then 'Sin pauta'
      else null
    end
  );

  if roster_day_row.effective_status in ('vacation', 'medical_leave') then
    resolved_absence_label := coalesce(
      roster_day_row.exception_label,
      case roster_day_row.effective_status
        when 'vacation' then 'Vacaciones'
        when 'medical_leave' then 'Licencia médica'
        else 'Vacaciones o licencia médica'
      end
    );

    raise exception
      'No se puede registrar este incentivo porque el trabajador figura con % para la fecha %. Este estado bloquea el registro.',
      resolved_absence_label,
      to_char(resolved_service_date, 'DD/MM/YYYY');
  end if;

  if resolved_requires_rest_day then
    if roster_day_row.base_status = 'working' then
      raise exception
        'No puedes usar a este trabajador como reemplazo el % porque su pauta lo marca en turno. Este incentivo solo se permite cuando el trabajador está en descanso.',
        to_char(resolved_service_date, 'DD/MM/YYYY');
    elsif roster_day_row.base_status = 'unassigned' then
      raise exception
        'No puedes usar a este trabajador como reemplazo el % porque no tiene una pauta operativa asignada para esa fecha. Este incentivo solo se permite cuando el trabajador está en descanso.',
        to_char(resolved_service_date, 'DD/MM/YYYY');
    elsif roster_day_row.base_status is distinct from 'resting' then
      raise exception
        'No puedes usar a este trabajador como reemplazo el % porque su pauta vigente no lo deja en descanso.',
        to_char(resolved_service_date, 'DD/MM/YYYY');
    end if;
  end if;

  select
    hir.id,
    hir.folio,
    hir.selected_contract_code,
    hir.selected_area_name,
    hir.incentive_type_name
  into conflicting_rest_day_request_row
  from public.hr_incentive_requests hir
  join public.hr_incentive_types hit
    on hit.id = hir.incentive_type_id
   and hit.requires_rest_day = true
  where hir.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and hir.service_date::date = resolved_service_date
    and hir.status in ('P', 'E', 'F')
  order by hir.created_at desc, hir.id desc
  limit 1;

  if p_manual_amount is not null then
    resolved_amount_source := 'manual';
    resolved_manual_amount := round(p_manual_amount::numeric, 2);
    calculated_amount := resolved_manual_amount;
  else
    if resolved_rate_rule_id is null then
      if resolved_allows_manual_amount then
        raise exception
          'Debes ingresar un monto manual o configurar una regla de monto activa para la combinación seleccionada';
      end if;

      raise exception 'No existe una regla de monto activa para la combinación seleccionada';
    end if;

    if resolved_calculation_basis = 'per_hour' then
      if p_duration_hours is null or p_duration_hours <= 0 then
        raise exception 'Debe indicar una duración válida para calcular el incentivo';
      end if;

      calculated_amount := round((resolved_rate_rule_amount * p_duration_hours)::numeric, 2);
    else
      calculated_amount := round(resolved_rate_rule_amount::numeric, 2);
    end if;
  end if;

  resolved_rest_day_conflict_contract_label := null;
  resolved_block_reason := null;

  if conflicting_rest_day_request_row.id is not null then
    resolved_rest_day_conflict_contract_label := coalesce(
      nullif(trim(coalesce(conflicting_rest_day_request_row.selected_area_name, '')), ''),
      nullif(trim(coalesce(conflicting_rest_day_request_row.selected_contract_code, '')), ''),
      'otro contrato'
    );

    resolved_block_reason := format(
      'No se puede registrar otro incentivo el %s porque el trabajador ya registra un incentivo con descanso para %s.',
      to_char(resolved_service_date, 'DD/MM/YYYY'),
      resolved_rest_day_conflict_contract_label
    );
  end if;

  return jsonb_build_object(
    'worker', p_worker_data - 'mapping_id',
    'rule', jsonb_build_object(
      'rate_rule_id', resolved_rate_rule_id,
      'incentive_type_id', p_incentive_type_id,
      'incentive_type_name', resolved_incentive_type_name,
      'calculation_basis', resolved_calculation_basis,
      'requires_replacement', resolved_requires_replacement,
      'requires_rest_day', resolved_requires_rest_day,
      'allows_manual_amount', resolved_allows_manual_amount,
      'rate_rule_amount', resolved_rate_rule_amount,
      'matched_contract_code', resolved_matched_contract_code,
      'matched_job_title', resolved_matched_job_title,
      'matched_union_name', resolved_matched_union_name,
      'matched_union_status', resolved_matched_union_status,
      'priority', resolved_matched_priority
    ),
    'roster_validation', jsonb_build_object(
      'requires_rest_day', resolved_requires_rest_day,
      'base_status', roster_day_row.base_status,
      'effective_status', roster_day_row.effective_status,
      'exception_type', roster_day_row.exception_type,
      'exception_label', roster_day_row.exception_label,
      'pattern_name', roster_day_row.pattern_name,
      'is_rest_day', roster_day_row.base_status = 'resting',
      'blocked_by_absence', roster_day_row.effective_status in ('vacation', 'medical_leave'),
      'blocked_by_existing_rest_day_incentive', conflicting_rest_day_request_row.id is not null,
      'existing_rest_day_request_id', conflicting_rest_day_request_row.id,
      'existing_rest_day_folio', conflicting_rest_day_request_row.folio,
      'existing_rest_day_contract_code', conflicting_rest_day_request_row.selected_contract_code,
      'existing_rest_day_contract_name', conflicting_rest_day_request_row.selected_area_name,
      'existing_rest_day_incentive_type_name', conflicting_rest_day_request_row.incentive_type_name,
      'block_reason',
        case
          when roster_day_row.effective_status in ('vacation', 'medical_leave') then format(
            'No se puede registrar este incentivo porque el trabajador figura con %s para la fecha %s. Este estado bloquea el registro.',
            coalesce(roster_day_row.exception_label, 'Vacaciones o licencia médica'),
            to_char(resolved_service_date, 'DD/MM/YYYY')
          )
          when conflicting_rest_day_request_row.id is not null then resolved_block_reason
          else null
        end,
      'schedule_status', roster_day_row.effective_status,
      'schedule_label', resolved_schedule_label,
      'matched_date', resolved_service_date
    ),
    'duration_hours', p_duration_hours,
    'service_date', resolved_service_date,
    'selected_contract_code', p_selected_contract_code,
    'amount_source', resolved_amount_source,
    'manual_amount', resolved_manual_amount,
    'calculated_amount', calculated_amount
  );
end;
$function$;

notify pgrst, 'reload schema';

commit;
