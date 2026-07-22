begin;

-- Audit-only data must never become a client-writable surface.
alter table public.buk_employee_snapshot_compaction_audit enable row level security;
revoke all on public.buk_employee_snapshot_compaction_audit from public, anon, authenticated;

-- Canonical workflow mutations are SECURITY DEFINER RPCs. Keep table reads under
-- RLS, but remove client write paths that can bypass state and audit invariants.
drop policy if exists "hiring_requests_insert_requester" on public.hiring_requests;
drop policy if exists "hiring_requests_update_operational" on public.hiring_requests;
revoke insert, update, delete, truncate, references, trigger
  on public.hiring_requests from anon, authenticated;

drop policy if exists "candidate_documents_insert_scoped" on public.candidate_documents;
drop policy if exists "candidate_documents_update_scoped" on public.candidate_documents;
revoke insert, update, delete, truncate, references, trigger
  on public.candidate_documents from anon, authenticated;

drop policy if exists "operational_onboarding_templates_insert" on public.onboarding_templates;
drop policy if exists "operational_onboarding_templates_update" on public.onboarding_templates;
drop policy if exists "operational_onboarding_templates_delete" on public.onboarding_templates;
drop policy if exists "operational_onboarding_template_tasks_insert" on public.onboarding_template_tasks;
drop policy if exists "operational_onboarding_template_tasks_update" on public.onboarding_template_tasks;
drop policy if exists "operational_onboarding_template_tasks_delete" on public.onboarding_template_tasks;
drop policy if exists "operational_onboarding_cases_insert" on public.employee_onboarding_cases;
drop policy if exists "operational_onboarding_cases_update" on public.employee_onboarding_cases;
drop policy if exists "operational_onboarding_cases_delete" on public.employee_onboarding_cases;
drop policy if exists "operational_onboarding_tasks_insert" on public.employee_onboarding_tasks;
drop policy if exists "operational_onboarding_tasks_update" on public.employee_onboarding_tasks;
drop policy if exists "operational_onboarding_tasks_delete" on public.employee_onboarding_tasks;
drop policy if exists "operational_onboarding_evidence_insert" on public.employee_onboarding_evidence;
drop policy if exists "operational_onboarding_evidence_update" on public.employee_onboarding_evidence;
drop policy if exists "operational_onboarding_evidence_delete" on public.employee_onboarding_evidence;
drop policy if exists "operational_onboarding_activity_log_insert" on public.employee_onboarding_activity_log;
drop policy if exists "operational_onboarding_activity_log_update" on public.employee_onboarding_activity_log;
drop policy if exists "operational_onboarding_activity_log_delete" on public.employee_onboarding_activity_log;
drop policy if exists "operational_onboarding_template_activity_log_insert" on public.onboarding_template_activity_log;

revoke insert, update, delete, truncate, references, trigger
  on public.onboarding_templates,
     public.onboarding_template_tasks,
     public.employee_onboarding_cases,
     public.employee_onboarding_tasks,
     public.employee_onboarding_evidence,
     public.employee_onboarding_activity_log,
     public.onboarding_template_activity_log
  from anon, authenticated;

-- A stable caller key turns transparent PostgREST retries into replay-safe calls.
alter table public.hiring_requests
  add column if not exists idempotency_key uuid;

create unique index if not exists hiring_requests_requester_idempotency_uidx
  on public.hiring_requests (requester_id, idempotency_key)
  where idempotency_key is not null;

alter table public.hr_incentive_requests
  add column if not exists idempotency_key uuid;

create unique index if not exists hr_incentive_requests_creator_idempotency_uidx
  on public.hr_incentive_requests (created_by, idempotency_key)
  where idempotency_key is not null;

create or replace function public.submit_hiring_request(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_vacancies integer,
  p_requested_entry_date date,
  p_start_date date,
  p_end_date date,
  p_campamento boolean,
  p_pasajes boolean,
  p_other_benefits text,
  p_salary_offer numeric,
  p_shift_id bigint,
  p_requester_signed boolean,
  p_idempotency_key uuid
)
returns table (request_id uuid, folio text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  created_row record;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;
  if p_idempotency_key is null then
    raise exception 'La solicitud requiere una clave de idempotencia';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('hiring-request:' || current_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  return query
  select hr.id, hr.folio
  from public.hiring_requests hr
  where hr.requester_id = current_user_id
    and hr.idempotency_key = p_idempotency_key;
  if found then
    return;
  end if;

  select * into created_row
  from public.submit_hiring_request(
    p_contract_id, p_job_position_id, p_vacancies, p_requested_entry_date,
    p_start_date, p_end_date, p_campamento, p_pasajes, p_other_benefits,
    p_salary_offer, p_shift_id, p_requester_signed
  );

  update public.hiring_requests
  set idempotency_key = p_idempotency_key
  where id = created_row.request_id;

  return query select created_row.request_id::uuid, created_row.folio::text;
end;
$function$;

revoke all on function public.submit_hiring_request(
  bigint, bigint, integer, date, date, date, boolean, boolean, text, numeric, bigint, boolean
) from public, anon, authenticated;
revoke all on function public.submit_hiring_request(
  bigint, bigint, integer, date, date, date, boolean, boolean, text, numeric, bigint, boolean, uuid
) from public, anon;
grant execute on function public.submit_hiring_request(
  bigint, bigint, integer, date, date, date, boolean, boolean, text, numeric, bigint, boolean, uuid
) to authenticated, service_role;

create or replace function public.create_hr_incentive_request(
  p_buk_employee_id text,
  p_incentive_type_id uuid,
  p_selected_contract_code text,
  p_selected_area_name text,
  p_selected_area_code text,
  p_service_date timestamptz,
  p_duration_hours numeric,
  p_motive text,
  p_description text,
  p_replacement_buk_employee_id text,
  p_declared_rest_day boolean,
  p_manual_amount numeric,
  p_idempotency_key uuid
)
returns table(
  request_id uuid,
  folio bigint,
  status text,
  calculated_amount numeric,
  period_code text,
  entry_lag_days integer,
  is_out_of_deadline boolean,
  is_contract_mismatch boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  created_row record;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;
  if p_idempotency_key is null then
    raise exception 'El incentivo requiere una clave de idempotencia';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('hr-incentive:' || current_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  return query
  select hir.id, hir.folio, hir.status, hir.calculated_amount, hir.period_code,
         hir.entry_lag_days, hir.is_out_of_deadline, hir.is_contract_mismatch
  from public.hr_incentive_requests hir
  where hir.created_by = current_user_id
    and hir.idempotency_key = p_idempotency_key;
  if found then
    return;
  end if;

  select * into created_row
  from public.create_hr_incentive_request(
    p_buk_employee_id, p_incentive_type_id, p_selected_contract_code,
    p_selected_area_name, p_selected_area_code, p_service_date, p_duration_hours,
    p_motive, p_description, p_replacement_buk_employee_id,
    p_declared_rest_day, p_manual_amount
  );

  update public.hr_incentive_requests
  set idempotency_key = p_idempotency_key
  where id = created_row.request_id;

  return query
  select created_row.request_id::uuid, created_row.folio::bigint, created_row.status::text,
         created_row.calculated_amount::numeric, created_row.period_code::text,
         created_row.entry_lag_days::integer, created_row.is_out_of_deadline::boolean,
         created_row.is_contract_mismatch::boolean;
end;
$function$;

revoke all on function public.create_hr_incentive_request(
  text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean
) from public, anon, authenticated;
revoke all on function public.create_hr_incentive_request(
  text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric
) from public, anon, authenticated;
revoke all on function public.create_hr_incentive_request(
  text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric, uuid
) from public, anon;
grant execute on function public.create_hr_incentive_request(
  text, uuid, text, text, text, timestamptz, numeric, text, text, text, boolean, numeric, uuid
) to authenticated, service_role;

-- The legacy assignment function performs the business mutation. This guarded
-- entry point serializes the read/close/check/insert sequence per worker.
create or replace function public.assign_hr_worker_roster_v2(
  p_buk_employee_id text,
  p_pattern_id uuid,
  p_start_date date,
  p_end_date date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
begin
  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    raise exception 'Debe indicar el trabajador BUK';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('hr-worker-roster:' || trim(p_buk_employee_id), 0)
  );

  return public.assign_hr_worker_roster(
    p_buk_employee_id, p_pattern_id, p_start_date, p_end_date, p_notes
  );
end;
$function$;

revoke all on function public.assign_hr_worker_roster(text, uuid, date, date, text)
  from public, anon, authenticated;
revoke all on function public.assign_hr_worker_roster_v2(text, uuid, date, date, text)
  from public, anon;
grant execute on function public.assign_hr_worker_roster_v2(text, uuid, date, date, text)
  to authenticated, service_role;

-- Closed-period BUK snapshots are append-once. A replay returns zero and cannot
-- rewrite historical rows from the current employee state.
create or replace function public.capture_buk_employee_monthly_snapshot(
  p_snapshot_date date default ((date_trunc('month', current_date)::date - interval '1 day')::date)
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_snapshot_date date := coalesce(
    p_snapshot_date,
    (date_trunc('month', current_date)::date - interval '1 day')::date
  );
  inserted_count integer := 0;
begin
  if not public.current_request_has_service_role() then
    raise exception 'Solo el servicio interno puede capturar snapshots mensuales BUK';
  end if;
  if target_snapshot_date >= date_trunc('month', current_date)::date then
    raise exception 'Solo se pueden capturar periodos BUK cerrados';
  end if;
  if exists (
    select 1 from public.buk_employees_daily_snapshot
    where snapshot_date = target_snapshot_date
  ) then
    return 0;
  end if;

  insert into public.buk_employees_daily_snapshot (
    snapshot_date, buk_employee_id, full_name, email, job_title, contract_code,
    area_name, area_code, document_number, document_type, birth_date, hire_date,
    city_name, region_name, status, is_active
  )
  select
    target_snapshot_date, e.buk_employee_id, e.full_name, e.email,
    coalesce(
      nullif(trim(e.job_title), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'role' ->> 'name'), ''),
      nullif(trim(e.raw_payload -> 'current_job' -> 'custom_attributes' ->> 'Nuevo cargo'), ''),
      nullif(trim(e.raw_payload ->> 'job_title'), '')
    ),
    nullif(trim(e.contract_code), ''), nullif(trim(e.area_name), ''),
    nullif(trim(e.area_code), ''), nullif(trim(e.document_number), ''),
    coalesce(nullif(trim(e.document_type), ''), 'rut'), e.birth_date,
    public.extract_buk_employee_hire_date(e.raw_payload),
    public.extract_buk_employee_city_name(e.raw_payload),
    public.extract_buk_employee_region_name(e.raw_payload), e.status, e.is_active
  from public.employees e
  on conflict (snapshot_date, buk_employee_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

revoke all on function public.capture_buk_employee_monthly_snapshot(date)
  from public, anon, authenticated;
grant execute on function public.capture_buk_employee_monthly_snapshot(date) to service_role;

-- Repair legacy state metadata with the row's own persisted timestamp and an
-- explicit legacy marker, then promote the invariants to database checks.
update public.hiring_requests
set approved_at = updated_at
where status = 'approved' and approved_at is null;

insert into public.recruitment_case_candidate_stage_history (
  recruitment_case_candidate_id, from_stage, to_stage, changed_by, reason_code, comment
)
select id, 'rejected', 'rejected', null, 'legacy_missing_reason',
       'Integridad CORE: el flujo legacy no registró el motivo original.'
from public.recruitment_case_candidates
where stage_code = 'rejected'
  and nullif(trim(coalesce(rejection_reason, '')), '') is null;

update public.recruitment_case_candidates
set rejection_reason = 'Motivo no registrado en flujo legacy',
    updated_at = timezone('utc', now())
where stage_code = 'rejected'
  and nullif(trim(coalesce(rejection_reason, '')), '') is null;

alter table public.hiring_requests
  drop constraint if exists hiring_requests_state_metadata_integrity;
alter table public.hiring_requests
  add constraint hiring_requests_state_metadata_integrity check (
    (status = 'pending_area_manager' and current_step_code = 'area_manager')
    or (status = 'pending_contracts_control' and current_step_code = 'contracts_control')
    or (status = 'approved' and current_step_code is null and approved_at is not null)
    or (status = 'rejected' and current_step_code is null and rejected_at is not null)
    or (status = 'closed' and current_step_code is null)
  );

alter table public.recruitment_case_candidates
  drop constraint if exists recruitment_candidate_terminal_reason_integrity;
alter table public.recruitment_case_candidates
  add constraint recruitment_candidate_terminal_reason_integrity check (
    (stage_code <> 'rejected' or nullif(trim(coalesce(rejection_reason, '')), '') is not null)
    and (stage_code <> 'withdrawn' or nullif(trim(coalesce(withdrawal_reason, '')), '') is not null)
  );

commit;
