begin;

create or replace function public.extract_hr_incentive_worker_base_salary(
  p_raw_payload jsonb
)
returns numeric
language plpgsql
immutable
as $function$
declare
  candidate_value numeric;
begin
  candidate_value := public.extract_hr_incentive_numeric_value(p_raw_payload ->> 'base_salary');

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(p_raw_payload ->> 'base_wage');
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'contract' ->> 'base_salary'
    );
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'contract' ->> 'base_wage'
    );
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'current_job' ->> 'base_salary'
    );
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'current_job' ->> 'base_wage'
    );
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'current_job' -> 'compensation' ->> 'base_salary'
    );
  end if;

  if candidate_value is null then
    candidate_value := public.extract_hr_incentive_numeric_value(
      p_raw_payload -> 'current_job' -> 'compensation' ->> 'base_wage'
    );
  end if;

  if candidate_value is not null and candidate_value > 0 then
    return round(candidate_value::numeric, 2);
  end if;

  return null;
end;
$function$;

notify pgrst, 'reload schema';

commit;
