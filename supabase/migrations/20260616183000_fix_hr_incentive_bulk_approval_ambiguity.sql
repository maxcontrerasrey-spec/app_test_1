begin;

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
  normalized_approval_ids bigint[];
  current_approval_id bigint;
  decision_row record;
  locked_approval_row record;
  locked_request_ids uuid[] := '{}'::uuid[];
  locked_approval_count integer := 0;
  expected_approval_count integer := 0;
begin
  normalized_approval_ids := array(
    select distinct selected_approval_id
    from unnest(coalesce(p_approval_ids, '{}'::bigint[])) as selected_ids(selected_approval_id)
    where selected_approval_id is not null
    order by selected_approval_id
  );

  expected_approval_count := coalesce(array_length(normalized_approval_ids, 1), 0);

  if expected_approval_count = 0 then
    raise exception 'Debe seleccionar al menos una aprobacion';
  end if;

  for locked_approval_row in
    select hira.id, hira.incentive_request_id
    from public.hr_incentive_request_approvals hira
    where hira.id = any(normalized_approval_ids)
    order by hira.id
    for update
  loop
    locked_approval_count := locked_approval_count + 1;

    if locked_approval_row.incentive_request_id is not null
       and not (locked_approval_row.incentive_request_id = any(locked_request_ids)) then
      locked_request_ids := array_append(locked_request_ids, locked_approval_row.incentive_request_id);
    end if;
  end loop;

  if locked_approval_count <> expected_approval_count then
    raise exception 'Una o más aprobaciones seleccionadas ya no existen o no están disponibles para procesamiento masivo';
  end if;

  perform 1
  from public.hr_incentive_requests hir
  where hir.id = any(locked_request_ids)
  order by hir.id
  for update;

  foreach current_approval_id in array normalized_approval_ids
  loop
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
  end loop;
end;
$function$;

grant execute on function public.bulk_decide_hr_incentive_request_approvals(bigint[], text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
