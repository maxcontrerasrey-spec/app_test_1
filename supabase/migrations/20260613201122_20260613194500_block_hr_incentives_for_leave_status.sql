create or replace function public.resolve_hr_roster_day_status(
  p_buk_employee_id text,
  p_target_date date
)
returns table (
  assignment_id uuid,
  pattern_id uuid,
  pattern_name text,
  working_days integer,
  resting_days integer,
  cycle_length integer,
  assignment_start_date date,
  assignment_end_date date,
  cycle_day integer,
  base_status text,
  effective_status text,
  exception_type text,
  exception_label text,
  exception_notes text,
  is_working_day boolean,
  is_rest_day boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  assignment_row record;
  exception_row record;
  cycle_index integer;
  resolved_base_status text;
  resolved_effective_status text;
begin
  select
    hre.exception_type,
    hre.notes
  into exception_row
  from public.hr_roster_exceptions hre
  where hre.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and hre.exception_date = p_target_date
    and hre.is_active = true
  limit 1;

  select
    wr.id as assignment_id,
    hp.id as pattern_id,
    hp.name as pattern_name,
    hp.working_days,
    hp.resting_days,
    hp.cycle_length,
    wr.start_date,
    wr.end_date
  into assignment_row
  from public.hr_worker_rosters wr
  join public.hr_shift_patterns hp
    on hp.id = wr.pattern_id
  where wr.employee_buk_employee_id = trim(coalesce(p_buk_employee_id, ''))
    and wr.start_date <= p_target_date
    and coalesce(wr.end_date, 'infinity'::date) >= p_target_date
  order by wr.start_date desc, wr.created_at desc
  limit 1;

  if assignment_row.assignment_id is null then
    resolved_effective_status := case
      when exception_row.exception_type is null then 'unassigned'
      when exception_row.exception_type = 'extra_shift' then 'extra_shift'
      when exception_row.exception_type = 'training' then 'training'
      else exception_row.exception_type
    end;

    return query
    select
      null::uuid,
      null::uuid,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::date,
      null::date,
      null::integer,
      'unassigned'::text,
      resolved_effective_status,
      exception_row.exception_type,
      case
        when exception_row.exception_type is null then null
        else public.get_hr_roster_exception_type_label(exception_row.exception_type)
      end,
      exception_row.notes,
      false,
      false;
    return;
  end if;

  cycle_index := mod((p_target_date - assignment_row.start_date), assignment_row.cycle_length);
  resolved_base_status := case
    when cycle_index < assignment_row.working_days then 'working'
    else 'resting'
  end;

  resolved_effective_status := case
    when exception_row.exception_type is null then resolved_base_status
    when exception_row.exception_type = 'extra_shift' then 'extra_shift'
    when exception_row.exception_type = 'training' then 'training'
    else exception_row.exception_type
  end;

  return query
  select
    assignment_row.assignment_id,
    assignment_row.pattern_id,
    assignment_row.pattern_name,
    assignment_row.working_days,
    assignment_row.resting_days,
    assignment_row.cycle_length,
    assignment_row.start_date,
    assignment_row.end_date,
    cycle_index + 1,
    resolved_base_status,
    resolved_effective_status,
    exception_row.exception_type,
    case
      when exception_row.exception_type is null then null
      else public.get_hr_roster_exception_type_label(exception_row.exception_type)
    end,
    exception_row.notes,
    resolved_base_status = 'working',
    resolved_base_status = 'resting';
end;
$function$;

create or replace function public.calculate_hr_incentive_preview(
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_duration_hours numeric default null,
  p_service_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  worker_payload jsonb;
  worker_job_title text;
  worker_union_name text;
  worker_union_status text;
  resolved_service_date date := coalesce(p_service_date, current_date);
  rule_row record;
  calculated_amount numeric(12,2);
  roster_day_row record;
  resolved_schedule_label text;
  resolved_absence_label text;
begin
  if not public.user_can_manage_hr_incentives(current_user_id) then
    raise exception 'Sin permisos para calcular incentivos';
  end if;

  worker_payload := public.get_hr_incentive_worker_context(p_buk_employee_id);
  worker_job_title := worker_payload -> 'worker' ->> 'job_title';
  worker_union_name := worker_payload -> 'worker' ->> 'union_name';
  worker_union_status := worker_payload -> 'worker' ->> 'union_status';

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

  if rule_row.incentive_type_id is null then
    raise exception 'No existe una regla de monto activa para la combinación seleccionada';
  end if;

  select *
    into roster_day_row
  from public.resolve_hr_roster_day_status(p_buk_employee_id, resolved_service_date);

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

  if rule_row.requires_rest_day then
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

  if rule_row.calculation_basis = 'per_hour' then
    if p_duration_hours is null or p_duration_hours <= 0 then
      raise exception 'Debe indicar una duración válida para calcular el incentivo';
    end if;

    calculated_amount := round((rule_row.rate_rule_amount * p_duration_hours)::numeric, 2);
  else
    calculated_amount := round(rule_row.rate_rule_amount::numeric, 2);
  end if;

  return jsonb_build_object(
    'worker', worker_payload -> 'worker',
    'rule', jsonb_build_object(
      'rate_rule_id', rule_row.rate_rule_id,
      'incentive_type_id', rule_row.incentive_type_id,
      'incentive_type_name', rule_row.incentive_type_name,
      'calculation_basis', rule_row.calculation_basis,
      'requires_replacement', rule_row.requires_replacement,
      'requires_rest_day', rule_row.requires_rest_day,
      'rate_rule_amount', rule_row.rate_rule_amount,
      'matched_contract_code', rule_row.matched_contract_code,
      'matched_job_title', rule_row.matched_job_title,
      'matched_union_name', rule_row.matched_union_name,
      'matched_union_status', rule_row.matched_union_status,
      'priority', rule_row.matched_priority
    ),
    'roster_validation', jsonb_build_object(
      'requires_rest_day', rule_row.requires_rest_day,
      'base_status', roster_day_row.base_status,
      'effective_status', roster_day_row.effective_status,
      'exception_type', roster_day_row.exception_type,
      'exception_label', roster_day_row.exception_label,
      'pattern_name', roster_day_row.pattern_name,
      'is_rest_day', roster_day_row.base_status = 'resting',
      'blocked_by_absence', roster_day_row.effective_status in ('vacation', 'medical_leave'),
      'block_reason',
        case
          when roster_day_row.effective_status in ('vacation', 'medical_leave') then format(
            'No se puede registrar este incentivo porque el trabajador figura con %s para la fecha %s. Este estado bloquea el registro.',
            coalesce(roster_day_row.exception_label, 'Vacaciones o licencia médica'),
            to_char(resolved_service_date, 'DD/MM/YYYY')
          )
          else null
        end,
      'schedule_status', roster_day_row.effective_status,
      'schedule_label', resolved_schedule_label,
      'matched_date', resolved_service_date
    ),
    'duration_hours', p_duration_hours,
    'service_date', resolved_service_date,
    'selected_contract_code', p_selected_contract_code,
    'calculated_amount', calculated_amount
  );
end;
$function$;

grant execute on function public.resolve_hr_roster_day_status(text, date) to authenticated;
grant execute on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date) to authenticated;

notify pgrst, 'reload schema';
