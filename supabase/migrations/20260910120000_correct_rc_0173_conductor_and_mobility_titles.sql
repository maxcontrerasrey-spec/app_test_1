begin;

do $$
declare
  v_case_id uuid;
  v_hiring_request_id uuid;
  v_mobility_count integer;
begin
  select rc.id, rc.hiring_request_id
    into v_case_id, v_hiring_request_id
  from public.recruitment_cases rc
  where rc.case_code = 'RC-0173'
  for update;

  if v_case_id is null or v_hiring_request_id is null then
    raise exception 'No se encontró RC-0173 o su solicitud de contratación';
  end if;

  if not exists (
    select 1
    from public.job_positions jp
    where jp.id = 278
      and jp.is_active = true
      and upper(trim(jp.name)) = 'CONDUCTOR'
  ) then
    raise exception 'No existe el cargo canónico activo CONDUCTOR (ID 278)';
  end if;

  select count(*)
    into v_mobility_count
  from public.internal_mobility_requests imr
  where imr.recruitment_case_id = v_case_id
    and imr.source_folio = '0173';

  if v_mobility_count <> 3 then
    raise exception 'Se esperaban 3 movilidades para RC-0173, se encontraron %', v_mobility_count;
  end if;

  update public.hiring_requests hr
  set job_position_id = 278,
      job_position_name = 'CONDUCTOR'
  where hr.id = v_hiring_request_id;

  update public.recruitment_cases rc
  set job_position_id = 278,
      job_position_name = 'CONDUCTOR',
      title = 'CONDUCTOR · ' || rc.contract_name
  where rc.id = v_case_id;

  update public.internal_mobility_requests imr
  set destination_job_title = 'CONDUCTOR'
  where imr.recruitment_case_id = v_case_id
    and imr.source_folio = '0173';
end;
$$;

commit;
