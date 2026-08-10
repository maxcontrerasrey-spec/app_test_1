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
  with candidate_pool as (
    select bsj.id, bsj.recruitment_case_candidate_id, rcc.recruitment_case_id, bsj.created_at
      from public.buk_sync_jobs bsj
      join public.recruitment_case_candidates rcc on rcc.id = bsj.recruitment_case_candidate_id
     where (rcc.stage_code = 'ready_for_hire' or bsj.payload_snapshot ? 'contingency')
       and (
         (p_job_ids is not null and bsj.id = any (p_job_ids) and (
           bsj.status in ('pending', 'error') or
           (bsj.status = 'processing' and bsj.finished_at is null and bsj.started_at is not null and bsj.started_at < stale_cutoff)
         ))
         or (p_job_ids is null and (
           bsj.status = 'pending' or
           (bsj.status = 'processing' and bsj.finished_at is null and bsj.started_at is not null and bsj.started_at < stale_cutoff)
         ))
       )
       and not exists (
         select 1 from public.buk_sync_jobs success_job
          where success_job.recruitment_case_candidate_id = bsj.recruitment_case_candidate_id
            and public.is_effective_buk_generation_success(success_job.status, success_job.buk_employee_id, success_job.result_snapshot)
       )
    for update of bsj skip locked
  ),
  case_capacity as (
    select cp.recruitment_case_id,
      greatest(rc.requested_vacancies - coalesce(candidate_occupancy.occupied_count, 0) - coalesce(mobility_occupancy.occupied_count, 0), 0)::integer as available_for_pool
      from (select distinct recruitment_case_id from candidate_pool) cp
      join public.recruitment_cases rc on rc.id = cp.recruitment_case_id
      left join lateral (
        select count(distinct rcc.id)::integer as occupied_count
          from public.recruitment_case_candidates rcc
         where rcc.recruitment_case_id = cp.recruitment_case_id
           and not exists (select 1 from candidate_pool pool where pool.recruitment_case_candidate_id = rcc.id)
           and (
             rcc.stage_code = 'hired'
             or exists (select 1 from public.buk_sync_jobs bsj where bsj.recruitment_case_candidate_id = rcc.id and public.is_effective_buk_generation_success(bsj.status, bsj.buk_employee_id, bsj.result_snapshot))
             or exists (select 1 from public.buk_sync_jobs bsj where bsj.recruitment_case_candidate_id = rcc.id and bsj.status in ('pending', 'processing'))
           )
      ) as candidate_occupancy on true
      left join lateral (
        select count(*)::integer as occupied_count
          from public.internal_mobility_requests imr
         where imr.recruitment_case_id = cp.recruitment_case_id
           and (imr.status in ('pending_area_manager', 'pending_contracts_control') or (imr.status = 'approved' and coalesce(imr.hr_execution_status, 'pending') in ('pending', 'executed')))
      ) as mobility_occupancy on true
  ),
  ranked_pool as (
    select cp.id, cp.recruitment_case_candidate_id, cp.recruitment_case_id, cc.available_for_pool,
      row_number() over (partition by cp.recruitment_case_id order by cp.created_at asc, cp.id asc)::integer as case_queue_position
      from candidate_pool cp join case_capacity cc on cc.recruitment_case_id = cp.recruitment_case_id
  ),
  blocked_jobs as (
    update public.buk_sync_jobs bsj
       set status = 'error', finished_at = timezone('utc', now()),
           error_message = 'No hay cupos disponibles para generar este candidato en BUK.',
           result_snapshot = coalesce(bsj.result_snapshot, '{}'::jsonb) || jsonb_build_object('vacancyGuard', jsonb_build_object('blockedAt', timezone('utc', now()), 'source', 'claim_buk_sync_jobs', 'availableForPool', ranked_pool.available_for_pool, 'caseQueuePosition', ranked_pool.case_queue_position))
      from ranked_pool
     where bsj.id = ranked_pool.id and ranked_pool.case_queue_position > ranked_pool.available_for_pool
    returning bsj.id
  ),
  selected_jobs as (
    select ranked_pool.id from ranked_pool
     where ranked_pool.case_queue_position <= ranked_pool.available_for_pool
     order by ranked_pool.recruitment_case_id, ranked_pool.case_queue_position, ranked_pool.id
     limit normalized_limit
  ),
  updated_jobs as (
    update public.buk_sync_jobs bsj
       set status = 'processing', attempts = bsj.attempts + 1, started_at = timezone('utc', now()), error_message = null,
           result_snapshot = case when bsj.status = 'processing' then coalesce(bsj.result_snapshot, '{}'::jsonb) || jsonb_build_object('staleProcessingRecovery', jsonb_build_object('reclaimedAt', timezone('utc', now()), 'previousStartedAt', bsj.started_at, 'previousAttempts', bsj.attempts, 'source', 'claim_buk_sync_jobs')) else bsj.result_snapshot end
      from selected_jobs sj where bsj.id = sj.id
    returning bsj.id, bsj.recruitment_case_candidate_id, bsj.status, bsj.attempts, bsj.payload_snapshot, bsj.result_snapshot
  )
  select updated_jobs.id, updated_jobs.recruitment_case_candidate_id, updated_jobs.status, updated_jobs.attempts, updated_jobs.payload_snapshot, updated_jobs.result_snapshot
    from updated_jobs;
end;
$function$;

notify pgrst, 'reload schema';
commit;
