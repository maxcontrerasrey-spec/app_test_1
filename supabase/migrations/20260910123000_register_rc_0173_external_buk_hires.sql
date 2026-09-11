-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; external hiring occupancy is historical ERP evidence and must not be deleted.
begin;

create table if not exists public.recruitment_case_external_hires (
  id uuid primary key default gen_random_uuid(),
  recruitment_case_id uuid not null references public.recruitment_cases(id) on delete restrict,
  employee_buk_employee_id text not null,
  employee_document_number text,
  employee_full_name text not null,
  source text not null default 'manual_buk_external_hire',
  hired_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (recruitment_case_id, employee_buk_employee_id)
);

alter table public.recruitment_case_external_hires enable row level security;
revoke all on public.recruitment_case_external_hires from public, anon, authenticated;

do $$
declare
  v_case_id uuid;
begin
  select id into v_case_id
  from public.recruitment_cases
  where case_code = 'RC-0173'
  for update;

  if v_case_id is null then
    raise exception 'No se encontró RC-0173';
  end if;

  insert into public.recruitment_case_external_hires (
    recruitment_case_id, employee_buk_employee_id, employee_document_number, employee_full_name, notes
  ) values
    (v_case_id, '43883', '9.572.271-7', 'Juan Antonio Arroyo Castro', 'Contratación externa ejecutada manualmente en BUK.'),
    (v_case_id, '43916', '14.089.777-9', 'Elías Daniel Bravo Pastén', 'Contratación externa ejecutada manualmente en BUK.'),
    (v_case_id, '43754', '26.212.139-9', 'José Antonio Castellano Angola', 'Contratación externa ejecutada manualmente en BUK.'),
    (v_case_id, '43950', '15.612.051-0', 'Gustavo Adolfo Cortés León', 'Contratación externa ejecutada manualmente en BUK.'),
    (v_case_id, '43884', '13.005.953-8', 'Claudio Patricio García Gallardo', 'Contratación externa ejecutada manualmente en BUK.'),
    (v_case_id, '43753', '17.819.956-0', 'Aliro Andrés Monrroy Monrroy', 'Contratación externa ejecutada manualmente en BUK; nombre de BUK difiere de la lista recibida.'),
    (v_case_id, '43982', '13.065.685-4', 'Carlos Roberto Nuñez Nilo', 'Contratación externa ejecutada manualmente en BUK.'),
    (v_case_id, '43949', '13.827.001-7', 'José Alejandro Rojas Rojas', 'Contratación externa ejecutada manualmente en BUK.'),
    (v_case_id, '43817', '11.636.020-9', 'José Alberto Sandoval Ruiz', 'Contratación externa ejecutada manualmente en BUK.'),
    (v_case_id, '43785', '12.939.420-K', 'Luis Alberto Tapia Soto', 'Contratación externa ejecutada manualmente en BUK.')
  on conflict (recruitment_case_id, employee_buk_employee_id) do update
    set employee_document_number = excluded.employee_document_number,
        employee_full_name = excluded.employee_full_name,
        source = excluded.source,
        notes = excluded.notes,
        updated_at = timezone('utc', now());
end;
$$;

create or replace function public.get_recruitment_case_effective_metrics(p_case_id uuid)
returns table (
  requested_vacancies integer,
  hired_candidate_count integer,
  ready_candidate_count integer,
  active_candidate_count integer,
  pending_mobility_count integer,
  approved_mobility_count integer,
  effective_filled_vacancies integer,
  effective_active_candidates integer,
  available_vacancies integer
)
language sql stable security definer set search_path = public
as $function$
  select
    rc.requested_vacancies,
    coalesce(candidate_stats.hired_candidate_count, 0)::integer,
    coalesce(candidate_stats.ready_candidate_count, 0)::integer,
    coalesce(candidate_stats.active_candidate_count, 0)::integer,
    coalesce(mobility_stats.pending_mobility_count, 0)::integer,
    coalesce(mobility_stats.approved_mobility_count, 0)::integer,
    (
      coalesce(candidate_stats.hired_candidate_count, 0)
      + coalesce(mobility_stats.approved_mobility_count, 0)
      + coalesce(external_stats.external_hire_count, 0)
    )::integer,
    (
      coalesce(candidate_stats.active_candidate_count, 0)
      + coalesce(mobility_stats.pending_mobility_count, 0)
    )::integer,
    greatest(
      rc.requested_vacancies - (
        coalesce(candidate_stats.hired_candidate_count, 0)
        + coalesce(mobility_stats.pending_mobility_count, 0)
        + coalesce(mobility_stats.approved_mobility_count, 0)
        + coalesce(external_stats.external_hire_count, 0)
      ),
      0
    )::integer
  from public.recruitment_cases rc
  left join lateral (
    select
      count(*) filter (where rcc.stage_code = 'hired') as hired_candidate_count,
      count(*) filter (where rcc.stage_code = 'ready_for_hire') as ready_candidate_count,
      count(*) filter (where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')) as active_candidate_count
    from public.recruitment_case_candidates rcc
    where rcc.recruitment_case_id = rc.id
  ) candidate_stats on true
  left join lateral (
    select
      count(*) filter (where imr.status in ('pending_area_manager', 'pending_contracts_control')) as pending_mobility_count,
      count(*) filter (where imr.status = 'approved') as approved_mobility_count
    from public.internal_mobility_requests imr
    where imr.recruitment_case_id = rc.id
  ) mobility_stats on true
  left join lateral (
    select count(*) as external_hire_count
    from public.recruitment_case_external_hires eche
    where eche.recruitment_case_id = rc.id
  ) external_stats on true
  where rc.id = p_case_id;
$function$;

create or replace function public.get_recruitment_case_buk_capacity_snapshot(
  p_case_id uuid,
  p_excluded_candidate_id uuid default null,
  p_include_pending_jobs boolean default true
)
returns table (
  requested_vacancies integer,
  occupied_vacancies integer,
  available_vacancies integer,
  candidate_occupied_vacancies integer,
  mobility_reserved_vacancies integer
)
language sql stable security definer set search_path = public
as $function$
  with target_case as (
    select rc.id, rc.requested_vacancies
    from public.recruitment_cases rc
    where rc.id = p_case_id
  ),
  candidate_occupancy as (
    select count(distinct rcc.id)::integer as occupied_count
    from public.recruitment_case_candidates rcc
    where rcc.recruitment_case_id = p_case_id
      and (p_excluded_candidate_id is null or rcc.id <> p_excluded_candidate_id)
      and (
        rcc.stage_code = 'hired'
        or exists (
          select 1
          from public.buk_sync_jobs bsj
          where bsj.recruitment_case_candidate_id = rcc.id
            and public.is_effective_buk_generation_success(bsj.status, bsj.buk_employee_id, bsj.result_snapshot)
        )
        or exists (
          select 1
          from public.buk_sync_jobs bsj
          where bsj.recruitment_case_candidate_id = rcc.id
            and (bsj.status = 'processing' or (p_include_pending_jobs and bsj.status = 'pending'))
        )
      )
  ),
  external_occupancy as (
    select count(*)::integer as occupied_count
    from public.recruitment_case_external_hires eche
    where eche.recruitment_case_id = p_case_id
  ),
  mobility_occupancy as (
    select count(*)::integer as occupied_count
    from public.internal_mobility_requests imr
    where imr.recruitment_case_id = p_case_id
      and (
        imr.status in ('pending_area_manager', 'pending_contracts_control')
        or (
          imr.status = 'approved'
          and coalesce(imr.hr_execution_status, 'pending') in ('pending', 'executed')
        )
      )
  )
  select
    tc.requested_vacancies,
    (coalesce(co.occupied_count, 0) + coalesce(eo.occupied_count, 0) + coalesce(mo.occupied_count, 0))::integer,
    greatest(tc.requested_vacancies - (coalesce(co.occupied_count, 0) + coalesce(eo.occupied_count, 0) + coalesce(mo.occupied_count, 0)), 0)::integer,
    (coalesce(co.occupied_count, 0) + coalesce(eo.occupied_count, 0))::integer,
    coalesce(mo.occupied_count, 0)::integer
  from target_case tc
  cross join candidate_occupancy co
  cross join external_occupancy eo
  cross join mobility_occupancy mo;
$function$;

select public.sync_recruitment_case_status(
  'dd9c250f-46e1-4fe3-9619-4a20b7e091fa',
  null
);

notify pgrst, 'reload schema';

commit;
