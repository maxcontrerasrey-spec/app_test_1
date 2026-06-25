begin;

create table if not exists public.buk_locations (
  location_id text primary key,
  location_name text not null,
  region_name text null,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_buk_locations_synced_at
  on public.buk_locations (synced_at desc);

drop trigger if exists trg_buk_locations_set_updated_at on public.buk_locations;
create trigger trg_buk_locations_set_updated_at
before update on public.buk_locations
for each row execute function public.set_updated_at();

alter table public.buk_locations enable row level security;

drop policy if exists buk_locations_no_direct_access on public.buk_locations;
create policy buk_locations_no_direct_access
on public.buk_locations
for all
to authenticated
using (false)
with check (false);

revoke all on public.buk_locations from public, anon, authenticated;
grant select, insert, update, delete on public.buk_locations to service_role;

create or replace function public.sync_recruitment_case_status(
  p_case_id uuid,
  p_actor_user_id uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  case_request_id uuid;
  case_record public.recruitment_cases%rowtype;
  request_record public.hiring_requests%rowtype;
  case_metrics record;
  next_status text;
  next_filled_vacancies integer;
  has_rejected_internal_mobility boolean := false;
  should_reopen_request boolean := false;
  now_utc timestamptz := timezone('utc', now());
begin
  select rc.hiring_request_id
    into case_request_id
    from public.recruitment_cases rc
   where rc.id = p_case_id;

  if case_request_id is null and not exists (
    select 1
      from public.recruitment_cases rc
     where rc.id = p_case_id
  ) then
    raise exception 'No existe el caso de reclutamiento';
  end if;

  if case_request_id is not null then
    select *
      into request_record
      from public.hiring_requests hr
     where hr.id = case_request_id
     for update;
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = p_case_id
   for update;

  if case_record.id is null then
    raise exception 'No existe el caso de reclutamiento';
  end if;

  if request_record.id is null and case_record.hiring_request_id is not null then
    select *
      into request_record
      from public.hiring_requests hr
     where hr.id = case_record.hiring_request_id
     for update;
  end if;

  select *
    into case_metrics
    from public.get_recruitment_case_effective_metrics(p_case_id)
    limit 1;

  select exists (
    select 1
      from public.internal_mobility_requests imr
     where imr.recruitment_case_id = p_case_id
       and imr.status = 'rejected'
  )
  into has_rejected_internal_mobility;

  next_filled_vacancies := coalesce(case_metrics.effective_filled_vacancies, 0);
  should_reopen_request :=
    request_record.id is not null
    and request_record.status = 'closed'
    and has_rejected_internal_mobility
    and coalesce(case_metrics.available_vacancies, 0) > 0
    and (
      case_record.status = 'cancelled'
      or case_record.close_reason is not null
      or case_record.closed_at is not null
    );

  next_status :=
    case
      when not should_reopen_request
        and case_record.close_reason is not null
        and case_record.closed_at is not null
        then case_record.status
      when next_filled_vacancies >= case_record.requested_vacancies then 'filled'
      when next_filled_vacancies > 0 then 'partially_filled'
      when coalesce(case_metrics.ready_candidate_count, 0) > 0 then 'ready_to_hire'
      when coalesce(case_metrics.effective_active_candidates, 0) > 0 then 'screening'
      else 'open'
    end;

  if should_reopen_request then
    update public.hiring_requests hr
       set status = 'approved',
           current_step_code = null,
           rejected_at = null,
           final_decided_by = null,
           updated_at = now_utc
     where hr.id = request_record.id;

    insert into public.hiring_request_audit_log (
      hiring_request_id,
      actor_user_id,
      action_type,
      metadata
    )
    values (
      request_record.id,
      coalesce(p_actor_user_id, case_record.opened_by),
      'approved',
      jsonb_build_object(
        'action', 'auto_reopened_due_to_rejected_internal_mobility',
        'previous_status', request_record.status,
        'status_changed_to', 'approved',
        'recruitment_case_id', case_record.id,
        'available_vacancies', coalesce(case_metrics.available_vacancies, 0),
        'effective_filled_vacancies', next_filled_vacancies
      )
    );
  end if;

  update public.recruitment_cases rc
     set filled_vacancies = next_filled_vacancies,
         status = next_status,
         close_reason = case when should_reopen_request then null else rc.close_reason end,
         closed_at = case when should_reopen_request then null else rc.closed_at end,
         closed_by = case when should_reopen_request then null else rc.closed_by end,
         target_close_date = case when should_reopen_request then null else rc.target_close_date end,
         updated_at = now_utc
   where rc.id = p_case_id;

  if case_record.status is distinct from next_status
     or case_record.filled_vacancies is distinct from next_filled_vacancies
     or should_reopen_request then
    insert into public.recruitment_case_audit_log (
      recruitment_case_id,
      actor_user_id,
      action_type,
      old_values,
      new_values,
      metadata
    )
    values (
      p_case_id,
      coalesce(p_actor_user_id, case_record.opened_by),
      'case_status_synced',
      jsonb_build_object(
        'status', case_record.status,
        'filled_vacancies', case_record.filled_vacancies,
        'close_reason', case_record.close_reason,
        'closed_at', case_record.closed_at,
        'closed_by', case_record.closed_by,
        'hiring_request_status', request_record.status
      ),
      jsonb_build_object(
        'status', next_status,
        'filled_vacancies', next_filled_vacancies,
        'close_reason', case when should_reopen_request then null else case_record.close_reason end,
        'closed_at', case when should_reopen_request then null else case_record.closed_at end,
        'closed_by', case when should_reopen_request then null else case_record.closed_by end,
        'hiring_request_status', case when should_reopen_request then 'approved' else request_record.status end
      ),
      jsonb_build_object(
        'ready_candidates', coalesce(case_metrics.ready_candidate_count, 0),
        'active_candidates', coalesce(case_metrics.active_candidate_count, 0),
        'pending_mobility_count', coalesce(case_metrics.pending_mobility_count, 0),
        'approved_mobility_count', coalesce(case_metrics.approved_mobility_count, 0),
        'effective_active_candidates', coalesce(case_metrics.effective_active_candidates, 0),
        'available_vacancies', coalesce(case_metrics.available_vacancies, 0),
        'has_rejected_internal_mobility', has_rejected_internal_mobility,
        'request_reopened', should_reopen_request
      )
    );
  end if;

  return next_status;
end;
$function$;

create or replace function public.transfer_candidate_to_case(
  p_case_candidate_id uuid,
  p_target_case_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  source_candidate_record public.recruitment_case_candidates%rowtype;
  target_case_record public.recruitment_cases%rowtype;
  normalized_comment text;
  doc_conflict_count integer;
  source_case_id uuid;
  first_sync_case_id uuid;
  second_sync_case_id uuid;
begin
  current_user_id := auth.uid();
  normalized_comment := nullif(trim(coalesce(p_comment, '')), '');

  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select *
    into source_candidate_record
    from public.recruitment_case_candidates
   where id = p_case_candidate_id
   for update;

  if source_candidate_record.id is null then
    raise exception 'No existe el candidato';
  end if;

  if source_candidate_record.recruitment_case_id = p_target_case_id then
    raise exception 'El candidato ya pertenece a este folio';
  end if;

  if source_candidate_record.stage_code in ('hired', 'rejected', 'withdrawn') then
    raise exception 'No se puede trasladar un candidato en etapa terminal (contratado, rechazado o desistido)';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, source_candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para gestionar el caso de origen';
  end if;

  select *
    into target_case_record
    from public.recruitment_cases
   where id = p_target_case_id
   for update;

  if target_case_record.id is null then
    raise exception 'No existe el folio destino';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, p_target_case_id) then
    raise exception 'Sin permisos para gestionar el folio destino';
  end if;

  if target_case_record.status in ('filled', 'closed_unfilled', 'cancelled') then
    raise exception 'El folio destino ya se encuentra cerrado o cancelado';
  end if;

  if exists (
    select 1
      from public.recruitment_case_candidates
     where recruitment_case_id = p_target_case_id
       and candidate_profile_id = source_candidate_record.candidate_profile_id
  ) then
    raise exception 'El candidato ya se encuentra postulando al folio destino';
  end if;

  select count(*)
    into doc_conflict_count
    from public.candidate_documents cd_src
   where cd_src.recruitment_case_id = source_candidate_record.recruitment_case_id
     and cd_src.candidate_profile_id = source_candidate_record.candidate_profile_id
     and exists (
       select 1
         from public.candidate_documents cd_dst
        where cd_dst.recruitment_case_id = p_target_case_id
          and cd_dst.candidate_profile_id = source_candidate_record.candidate_profile_id
          and cd_dst.document_type_id = cd_src.document_type_id
     );

  if doc_conflict_count > 0 then
    raise exception 'Existen % documento(s) con conflicto de unicidad en el folio destino. No se puede trasladar automáticamente.', doc_conflict_count;
  end if;

  source_case_id := source_candidate_record.recruitment_case_id;

  update public.candidate_documents
     set recruitment_case_id = p_target_case_id,
         updated_at = timezone('utc', now())
   where recruitment_case_id = source_case_id
     and candidate_profile_id = source_candidate_record.candidate_profile_id;

  update public.recruitment_case_candidates
     set recruitment_case_id = p_target_case_id,
         updated_at = timezone('utc', now())
   where id = p_case_candidate_id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  ) values (
    source_case_id,
    p_case_candidate_id,
    current_user_id,
    'candidate_transferred_out',
    jsonb_build_object(
      'target_case_id', p_target_case_id,
      'target_case_code', target_case_record.case_code,
      'comment', normalized_comment
    )
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  ) values (
    p_target_case_id,
    p_case_candidate_id,
    current_user_id,
    'candidate_transferred_in',
    jsonb_build_object(
      'source_case_id', source_case_id,
      'comment', normalized_comment
    )
  );

  if source_case_id::text <= p_target_case_id::text then
    first_sync_case_id := source_case_id;
    second_sync_case_id := p_target_case_id;
  else
    first_sync_case_id := p_target_case_id;
    second_sync_case_id := source_case_id;
  end if;

  perform public.sync_recruitment_case_status(first_sync_case_id, current_user_id);

  if second_sync_case_id is distinct from first_sync_case_id then
    perform public.sync_recruitment_case_status(second_sync_case_id, current_user_id);
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
