begin;

create or replace function public.authorize_buk_sync_jobs(
  p_actor_user_id uuid,
  p_job_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  with normalized_job_ids as (
    select distinct job_id
    from unnest(coalesce(p_job_ids, '{}'::uuid[])) as job_id
    where job_id is not null
  ),
  visible_jobs as (
    select nj.job_id
    from normalized_job_ids nj
    join public.buk_sync_jobs bsj
      on bsj.id = nj.job_id
    join public.recruitment_case_candidates rcc
      on rcc.id = bsj.recruitment_case_candidate_id
    where public.user_can_manage_recruitment_case(p_actor_user_id, rcc.recruitment_case_id)
  )
  select
    p_actor_user_id is not null
    and exists (select 1 from normalized_job_ids)
    and (select count(*) from normalized_job_ids) = (select count(*) from visible_jobs);
$function$;

revoke all on function public.authorize_buk_sync_jobs(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.authorize_candidate_document_cleanup_targets(
  p_actor_user_id uuid,
  p_case_candidate_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  with normalized_candidate_ids as (
    select distinct case_candidate_id
    from unnest(coalesce(p_case_candidate_ids, '{}'::uuid[])) as case_candidate_id
    where case_candidate_id is not null
  ),
  visible_candidates as (
    select nci.case_candidate_id
    from normalized_candidate_ids nci
    join public.recruitment_case_candidates rcc
      on rcc.id = nci.case_candidate_id
    where public.user_can_manage_recruitment_case(p_actor_user_id, rcc.recruitment_case_id)
  )
  select
    p_actor_user_id is not null
    and exists (select 1 from normalized_candidate_ids)
    and (select count(*) from normalized_candidate_ids) = (select count(*) from visible_candidates);
$function$;

revoke all on function public.authorize_candidate_document_cleanup_targets(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.search_accreditation_workers(
  p_search text default null,
  p_site_id uuid default null,
  p_status text default null,
  p_limit integer default 50
)
returns table (
  worker_accreditation_id uuid,
  buk_employee_id text,
  full_name text,
  document_number text,
  document_type text,
  job_title text,
  contract_code text,
  area_name text,
  site_id uuid,
  site_name text,
  accreditation_status text,
  accreditation_expiry_date date,
  required_documents_total integer,
  approved_documents_total integer,
  pending_documents_total integer,
  expired_documents_total integer,
  roster_pattern_name text,
  roster_start_date date
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_digits text := public.build_employee_document_digits(p_search, '{}'::jsonb);
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.user_can_manage_accreditation(current_user_id) then
    raise exception 'Sin permisos para consultar trabajadores acreditados';
  end if;

  if p_site_id is null and length(normalized_search) < 2 and length(normalized_digits) < 4 then
    return;
  end if;

  return query
  with target_site as (
    select s.id, s.name
    from public.accreditation_sites s
    where s.id = p_site_id
  ),
  active_workers as (
    select
      e.buk_employee_id,
      e.full_name,
      coalesce(
        nullif(trim(coalesce(e.document_number, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_number', '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'rut', '')), '')
      ) as document_number,
      coalesce(
        nullif(trim(coalesce(e.document_type, '')), ''),
        nullif(trim(coalesce(e.raw_payload ->> 'document_type', '')), ''),
        'rut'
      ) as document_type,
      public.resolve_active_employee_job_title(e.raw_payload, e.job_title) as resolved_job_title,
      nullif(trim(e.contract_code), '') as contract_code,
      nullif(trim(e.area_name), '') as area_name,
      public.build_buk_employee_name_search_key(e.full_name, e.raw_payload) as name_search_key,
      public.build_employee_document_digits(e.document_number, e.raw_payload) as document_digits,
      row_number() over (
        partition by public.build_active_employee_identity_key(
          e.document_type,
          e.document_number,
          e.buk_employee_id,
          e.raw_payload
        )
        order by e.updated_at desc nulls last, e.created_at desc nulls last, e.buk_employee_id desc
      ) as identity_rank
    from public.employees e
    where e.is_active = true
      and (
        p_site_id is not null
        or (
          normalized_search <> ''
          and public.build_active_employee_search_text(
            e.full_name,
            e.document_number,
            e.job_title,
            e.contract_code,
            e.area_name,
            e.raw_payload
          ) like '%' || normalized_search || '%'
        )
        or (
          normalized_digits <> ''
          and public.build_employee_document_digits(e.document_number, e.raw_payload)
            like '%' || normalized_digits || '%'
        )
      )
  ),
  deduplicated_workers as (
    select
      aw.buk_employee_id,
      aw.full_name,
      aw.document_number,
      aw.document_type,
      aw.resolved_job_title,
      aw.contract_code,
      aw.area_name,
      aw.name_search_key,
      aw.document_digits
    from active_workers aw
    where aw.identity_rank = 1
  ),
  roster_active as (
    select distinct on (wr.employee_buk_employee_id)
      wr.employee_buk_employee_id,
      sp.name as pattern_name,
      wr.start_date
    from public.hr_worker_rosters wr
    join public.hr_shift_patterns sp
      on sp.id = wr.pattern_id
    where wr.start_date <= current_date
      and (wr.end_date is null or wr.end_date >= current_date)
    order by wr.employee_buk_employee_id, wr.start_date desc, wr.created_at desc
  )
  select
    wa.id,
    dw.buk_employee_id,
    dw.full_name,
    dw.document_number,
    dw.document_type,
    dw.resolved_job_title as job_title,
    dw.contract_code,
    dw.area_name,
    coalesce(wa.site_id, ts.id),
    coalesce(s.name, ts.name),
    coalesce(wa.accreditation_status, 'pending'),
    wa.accreditation_expiry_date,
    coalesce(wa.required_documents_total, 0),
    coalesce(wa.approved_documents_total, 0),
    coalesce(wa.pending_documents_total, 0),
    coalesce(wa.expired_documents_total, 0),
    ra.pattern_name,
    ra.start_date
  from deduplicated_workers dw
  left join target_site ts
    on true
  left join public.worker_accreditations wa
    on wa.employee_buk_employee_id = dw.buk_employee_id
   and (p_site_id is null or wa.site_id = p_site_id)
  left join public.accreditation_sites s
    on s.id = wa.site_id
  left join roster_active ra
    on ra.employee_buk_employee_id = dw.buk_employee_id
  where (p_site_id is not null or wa.id is not null)
    and (p_status is null or trim(p_status) = '' or coalesce(wa.accreditation_status, 'pending') = trim(p_status))
  order by
    case
      when normalized_search <> '' and dw.name_search_key like normalized_search || '%' then 0
      when normalized_search <> '' and lower(dw.full_name) like normalized_search || '%' then 1
      when normalized_digits <> '' and dw.document_digits like normalized_digits || '%' then 2
      else 3
    end,
    case coalesce(wa.accreditation_status, 'pending')
      when 'expired' then 0
      when 'pending' then 1
      when 'expiring_soon' then 2
      else 3
    end,
    wa.accreditation_expiry_date nulls last,
    dw.full_name asc
  limit safe_limit;
end;
$function$;

notify pgrst, 'reload schema';

commit;
