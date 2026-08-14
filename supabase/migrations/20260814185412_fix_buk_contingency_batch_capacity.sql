begin;

-- The capacity snapshot already includes pending jobs created in this
-- transaction. Do not subtract a second in-memory reservation counter.
create or replace function public.enqueue_buk_generation_contingency(
  p_candidate_ids uuid[],
  p_reason text
)
returns table (job_id uuid, recruitment_case_candidate_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_row record;
  existing_job public.buk_sync_jobs%rowtype;
  new_job_id uuid;
  payload_snapshot jsonb;
  capacity_record record;
begin
  if current_user_id is null then raise exception 'Usuario no autenticado'; end if;
  if not public.user_can_generate_buk_candidates(current_user_id) then
    raise exception 'Solo RRHH administrativo puede generar candidatos en BUK';
  end if;
  if not public.user_can_access_recruitment_personnel(current_user_id) then
    raise exception 'Sin permisos para operar Personal a Contratar';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 10 then
    raise exception 'La carga BUK en contingencia exige un motivo de al menos 10 caracteres';
  end if;

  for candidate_row in
    select distinct on (rcc.id)
      rcc.id,
      rcc.recruitment_case_id,
      rcc.stage_code,
      rc.case_code,
      input_candidate.input_order
    from unnest(coalesce(p_candidate_ids, '{}'::uuid[])) with ordinality
      as input_candidate(candidate_id, input_order)
    join public.recruitment_case_candidates rcc
      on rcc.id = input_candidate.candidate_id
    join public.recruitment_cases rc
      on rc.id = rcc.recruitment_case_id
    order by rcc.id, input_candidate.input_order
  loop
    if not (
      public.user_can_manage_recruitment_case(current_user_id, candidate_row.recruitment_case_id)
      or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_row.id)
    ) then
      raise exception 'Sin permisos para encolar el candidato %', candidate_row.id;
    end if;

    if candidate_row.stage_code in ('rejected', 'withdrawn', 'hired') then
      raise exception 'El candidato % no puede cargarse por contingencia en su estado actual', candidate_row.id;
    end if;

    select * into existing_job
    from public.buk_sync_jobs bsj
    where bsj.recruitment_case_candidate_id = candidate_row.id
      and bsj.status in ('pending', 'processing')
    order by bsj.created_at desc
    limit 1
    for update;

    if existing_job.id is not null then
      job_id := existing_job.id;
      recruitment_case_candidate_id := candidate_row.id;
      status := existing_job.status;
      return next;
      continue;
    end if;

    select * into existing_job
    from public.buk_sync_jobs bsj
    where bsj.recruitment_case_candidate_id = candidate_row.id
      and public.is_effective_buk_generation_success(
        bsj.status,
        bsj.buk_employee_id,
        bsj.result_snapshot
      )
    order by bsj.created_at desc
    limit 1;

    if existing_job.id is not null then
      raise exception 'El candidato % ya fue generado previamente en BUK', candidate_row.id;
    end if;

    perform 1
    from public.recruitment_cases rc
    where rc.id = candidate_row.recruitment_case_id
    for update;

    -- This snapshot sees pending rows inserted earlier in this same batch.
    select * into capacity_record
    from public.get_recruitment_case_buk_capacity_snapshot(
      candidate_row.recruitment_case_id,
      candidate_row.id,
      true
    );

    if capacity_record.requested_vacancies is null then
      raise exception 'No existe el caso de reclutamiento asociado al candidato %', candidate_row.id;
    end if;
    if capacity_record.available_vacancies <= 0 then
      raise exception
        'No hay cupos disponibles para generar en BUK en el caso %. Cupos solicitados: %, ocupados/reservados: %.',
        candidate_row.case_code,
        capacity_record.requested_vacancies,
        capacity_record.occupied_vacancies;
    end if;

    payload_snapshot := public.get_candidate_buk_sync_contingency_payload(candidate_row.id)
      || jsonb_build_object(
        'contingency',
        jsonb_build_object(
          'reason', trim(p_reason),
          'requested_by', current_user_id,
          'requested_at', timezone('utc', now())
        )
      );

    insert into public.buk_sync_jobs (
      recruitment_case_candidate_id,
      requested_by,
      status,
      payload_snapshot
    )
    values (
      candidate_row.id,
      current_user_id,
      'pending',
      payload_snapshot
    )
    returning id into new_job_id;

    job_id := new_job_id;
    recruitment_case_candidate_id := candidate_row.id;
    status := 'pending';
    return next;
  end loop;
end;
$function$;

revoke all on function public.enqueue_buk_generation_contingency(uuid[], text)
  from public, anon;
grant execute on function public.enqueue_buk_generation_contingency(uuid[], text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
