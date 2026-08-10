begin;

do $$
declare
  legacy_position_id bigint;
  canonical_position_id bigint;
  legacy_position_count integer;
  canonical_position_count integer;
  remaining_legacy_values integer;
  remaining_legacy_ids integer;
begin
  select count(*) into legacy_position_count
  from public.job_positions
  where upper(trim(name)) = 'CONDUCTOR BUS';

  select count(*) into canonical_position_count
  from public.job_positions
  where upper(trim(name)) = 'CONDUCTOR DE BUS' and is_active = true;

  if legacy_position_count <> 1 or canonical_position_count <> 1 then
    raise exception
      'No se puede normalizar Conductor de Bus: catalogo ambiguo (legacy %, canonical activo %)',
      legacy_position_count,
      canonical_position_count;
  end if;

  select id into legacy_position_id
  from public.job_positions
  where upper(trim(name)) = 'CONDUCTOR BUS';

  select id into canonical_position_id
  from public.job_positions
  where upper(trim(name)) = 'CONDUCTOR DE BUS' and is_active = true;

  -- Preserve the old code for auditability, but remove it from the active catalog.
  update public.job_positions
  set name = 'CONDUCTOR BUS (LEGACY - INACTIVO)',
      is_active = false
  where id = legacy_position_id;

  update public.hiring_requests
  set job_position_id = canonical_position_id
  where job_position_id = legacy_position_id;

  update public.hiring_requests
  set requested_position_id = canonical_position_id
  where requested_position_id = legacy_position_id;

  update public.hiring_requests
  set job_position_name = 'CONDUCTOR DE BUS'
  where upper(trim(job_position_name)) = 'CONDUCTOR BUS';

  update public.hiring_requests
  set requested_position_name = 'CONDUCTOR DE BUS'
  where upper(trim(requested_position_name)) = 'CONDUCTOR BUS';

  update public.recruitment_cases
  set job_position_id = canonical_position_id
  where job_position_id = legacy_position_id;

  update public.recruitment_cases
  set job_position_name = 'CONDUCTOR DE BUS'
  where upper(trim(job_position_name)) = 'CONDUCTOR BUS';

  update public.internal_mobility_requests
  set destination_job_title = 'CONDUCTOR DE BUS'
  where upper(trim(destination_job_title)) = 'CONDUCTOR BUS';

  select count(*) into remaining_legacy_values
  from (
    select job_position_name as value from public.hiring_requests
    union all select requested_position_name from public.hiring_requests
    union all select job_position_name from public.recruitment_cases
    union all select destination_job_title from public.internal_mobility_requests
  ) values_to_check
  where upper(trim(value)) = 'CONDUCTOR BUS';

  select count(*) into remaining_legacy_ids
  from (
    select job_position_id as value from public.hiring_requests
    union all select requested_position_id from public.hiring_requests
    union all select job_position_id from public.recruitment_cases
  ) ids_to_check
  where value = legacy_position_id;

  if remaining_legacy_values <> 0 or remaining_legacy_ids <> 0 then
    raise exception
      'Normalizacion incompleta: valores legacy %, referencias legacy %',
      remaining_legacy_values,
      remaining_legacy_ids;
  end if;
end;
$$;

alter table public.hiring_requests
  add constraint hiring_requests_job_position_name_no_legacy_conductor_bus
  check (upper(trim(job_position_name)) <> 'CONDUCTOR BUS');

alter table public.hiring_requests
  add constraint hiring_requests_requested_position_name_no_legacy_conductor_bus
  check (requested_position_name is null or upper(trim(requested_position_name)) <> 'CONDUCTOR BUS');

alter table public.recruitment_cases
  add constraint recruitment_cases_job_position_name_no_legacy_conductor_bus
  check (job_position_name is null or upper(trim(job_position_name)) <> 'CONDUCTOR BUS');

alter table public.internal_mobility_requests
  add constraint internal_mobility_destination_no_legacy_conductor_bus
  check (upper(trim(destination_job_title)) <> 'CONDUCTOR BUS');

commit;
