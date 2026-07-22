begin;

create or replace function public.claim_buk_sync_jobs(
  p_limit integer default 10,
  p_job_ids uuid[] default null
)
returns table (
  id uuid,
  recruitment_case_candidate_id uuid,
  status text,
  attempts integer,
  payload_snapshot jsonb,
  result_snapshot jsonb
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  stale_cutoff timestamptz := timezone('utc', now()) - interval '15 minutes';
begin
  return query
  with selected_jobs as (
    select bsj.id
      from public.buk_sync_jobs bsj
     where (
        p_job_ids is not null
        and bsj.id = any (p_job_ids)
        and (
          bsj.status in ('pending', 'error')
          or (
            bsj.status = 'processing'
            and bsj.finished_at is null
            and bsj.started_at is not null
            and bsj.started_at < stale_cutoff
          )
        )
      )
        or (
          p_job_ids is null
          and (
            bsj.status = 'pending'
            or (
              bsj.status = 'processing'
              and bsj.finished_at is null
              and bsj.started_at is not null
              and bsj.started_at < stale_cutoff
            )
          )
        )
     order by bsj.created_at asc
     for update skip locked
     limit normalized_limit
  ),
  updated_jobs as (
    update public.buk_sync_jobs bsj
       set status = 'processing',
           attempts = bsj.attempts + 1,
           started_at = timezone('utc', now()),
           error_message = null,
           result_snapshot = case
             when bsj.status = 'processing' then
               coalesce(bsj.result_snapshot, '{}'::jsonb)
               || jsonb_build_object(
                 'staleProcessingRecovery',
                 jsonb_build_object(
                   'reclaimedAt', timezone('utc', now()),
                   'previousStartedAt', bsj.started_at,
                   'previousAttempts', bsj.attempts,
                   'source', 'claim_buk_sync_jobs'
                 )
               )
             else bsj.result_snapshot
           end
      from selected_jobs sj
     where bsj.id = sj.id
     returning
       bsj.id,
       bsj.recruitment_case_candidate_id,
       bsj.status,
       bsj.attempts,
       bsj.payload_snapshot,
       bsj.result_snapshot
  )
  select
    updated_jobs.id,
    updated_jobs.recruitment_case_candidate_id,
    updated_jobs.status,
    updated_jobs.attempts,
    updated_jobs.payload_snapshot,
    updated_jobs.result_snapshot
  from updated_jobs;
end;
$function$;

revoke all on function public.claim_buk_sync_jobs(integer, uuid[]) from public, anon, authenticated;

create or replace function public.enqueue_buk_generation(
  p_candidate_ids uuid[]
)
returns table (
  job_id uuid,
  recruitment_case_candidate_id uuid,
  status text
)
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
  stale_cutoff timestamptz := timezone('utc', now()) - interval '15 minutes';
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_generate_buk_candidates(current_user_id) then
    raise exception 'Solo RRHH administrativo puede generar candidatos en BUK';
  end if;

  if not public.user_can_access_recruitment_personnel(current_user_id) then
    raise exception 'Sin permisos para operar Personal a Contratar';
  end if;

  for candidate_row in
    select distinct rcc.id, rcc.recruitment_case_id, rcc.candidate_profile_id
    from public.recruitment_case_candidates rcc
    join unnest(coalesce(p_candidate_ids, '{}'::uuid[])) as selected_candidate_id
      on selected_candidate_id = rcc.id
  loop
    if not (
      public.user_can_manage_recruitment_case(current_user_id, candidate_row.recruitment_case_id)
      or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_row.id)
    ) then
      raise exception 'Sin permisos para encolar el candidato %', candidate_row.id;
    end if;

    select *
      into existing_job
      from public.buk_sync_jobs bsj
     where bsj.recruitment_case_candidate_id = candidate_row.id
       and bsj.status in ('pending', 'processing')
     order by bsj.created_at desc
     limit 1
     for update;

    if existing_job.id is not null then
      if existing_job.status = 'processing'
         and existing_job.finished_at is null
         and existing_job.started_at is not null
         and existing_job.started_at < stale_cutoff then
        update public.buk_sync_jobs bsj
           set status = 'pending',
               error_message = null,
               result_snapshot = coalesce(bsj.result_snapshot, '{}'::jsonb)
                 || jsonb_build_object(
                   'staleProcessingRecovery',
                   jsonb_build_object(
                     'requeuedAt', timezone('utc', now()),
                     'previousStartedAt', bsj.started_at,
                     'previousAttempts', bsj.attempts,
                     'source', 'enqueue_buk_generation'
                   )
                 )
         where bsj.id = existing_job.id
         returning * into existing_job;
      end if;

      job_id := existing_job.id;
      recruitment_case_candidate_id := candidate_row.id;
      status := existing_job.status;
      return next;
      continue;
    end if;

    select *
      into existing_job
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

    payload_snapshot := public.get_candidate_buk_sync_payload(candidate_row.id);

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

revoke all on function public.enqueue_buk_generation(uuid[]) from public, anon;
grant execute on function public.enqueue_buk_generation(uuid[]) to authenticated;

notify pgrst, 'reload schema';

commit;
