-- EEES-DB-005: approved
-- owner: Recruitment and HR Integrations
-- rollback: desactivar los RPC nuevos solo mediante una migracion forward-only; no eliminar reservas confirmadas.
begin;

alter table private.buk_employee_code_reservations
  add column if not exists predecessor_buk_employee_id text null,
  add column if not exists predecessor_employee_code text null;

create unique index if not exists uq_buk_employee_code_reservations_one_pending_identity
  on private.buk_employee_code_reservations(identity_key)
  where status = 'reserved';

create unique index if not exists uq_buk_employee_code_reservations_employee
  on private.buk_employee_code_reservations(buk_employee_id)
  where buk_employee_id is not null and status <> 'released';

create or replace function private.populate_buk_employee_code_predecessor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  predecessor record;
begin
  select
    employee.buk_employee_id,
    upper(trim(employee.raw_payload ->> 'code_sheet')) as employee_code
    into predecessor
    from public.employees employee
   where private.normalize_buk_employee_identity(
           coalesce(
             nullif(trim(employee.document_number), ''),
             nullif(trim(employee.raw_payload ->> 'document_number'), ''),
             nullif(trim(employee.raw_payload ->> 'rut'), '')
           )
         ) = new.identity_key
     and nullif(trim(employee.raw_payload ->> 'code_sheet'), '') ~ '^F[1-9][0-9]*$'
     and substring(
           trim(employee.raw_payload ->> 'code_sheet')
           from '^F([1-9][0-9]*)$'
         )::integer < new.sequence_number
   order by
     substring(
       trim(employee.raw_payload ->> 'code_sheet')
       from '^F([1-9][0-9]*)$'
     )::integer desc,
     employee.updated_at desc nulls last,
     employee.buk_employee_id desc
   limit 1;

  new.predecessor_buk_employee_id := predecessor.buk_employee_id;
  new.predecessor_employee_code := predecessor.employee_code;
  return new;
end;
$function$;

revoke all on function private.populate_buk_employee_code_predecessor()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_buk_employee_code_reservation_predecessor
  on private.buk_employee_code_reservations;
create trigger trg_buk_employee_code_reservation_predecessor
before insert or update of identity_key, sequence_number
on private.buk_employee_code_reservations
for each row
execute function private.populate_buk_employee_code_predecessor();

with ranked_predecessors as (
  select
    reservation.id as reservation_id,
    employee.buk_employee_id,
    upper(trim(employee.raw_payload ->> 'code_sheet')) as employee_code,
    row_number() over (
      partition by reservation.id
      order by
        substring(
          trim(employee.raw_payload ->> 'code_sheet')
          from '^F([1-9][0-9]*)$'
        )::integer desc,
        employee.updated_at desc nulls last,
        employee.buk_employee_id desc
    ) as priority
  from private.buk_employee_code_reservations reservation
  join public.employees employee
    on private.normalize_buk_employee_identity(
         coalesce(
           nullif(trim(employee.document_number), ''),
           nullif(trim(employee.raw_payload ->> 'document_number'), ''),
           nullif(trim(employee.raw_payload ->> 'rut'), '')
         )
       ) = reservation.identity_key
   and nullif(trim(employee.raw_payload ->> 'code_sheet'), '') ~ '^F[1-9][0-9]*$'
   and substring(
         trim(employee.raw_payload ->> 'code_sheet')
         from '^F([1-9][0-9]*)$'
       )::integer < reservation.sequence_number
)
update private.buk_employee_code_reservations reservation
   set predecessor_buk_employee_id = predecessor.buk_employee_id,
       predecessor_employee_code = predecessor.employee_code,
       updated_at = timezone('utc', now())
  from ranked_predecessors predecessor
 where predecessor.reservation_id = reservation.id
   and predecessor.priority = 1
   and (
     reservation.predecessor_buk_employee_id is distinct from predecessor.buk_employee_id
     or reservation.predecessor_employee_code is distinct from predecessor.employee_code
   );

create or replace function public.get_buk_employee_code_reservation_context(
  p_job_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  reservation private.buk_employee_code_reservations%rowtype;
begin
  select code_reservation.*
    into reservation
    from public.buk_sync_jobs job
    join private.buk_employee_code_reservations code_reservation
      on code_reservation.recruitment_case_candidate_id = job.recruitment_case_candidate_id
   where job.id = p_job_id
     and code_reservation.status <> 'released';

  if reservation.id is null then
    raise exception 'No existe una reserva BUK vigente para el job';
  end if;

  return jsonb_build_object(
    'reservation_id', reservation.id,
    'employee_code', reservation.employee_code,
    'status', reservation.status,
    'buk_employee_id', reservation.buk_employee_id,
    'predecessor_buk_employee_id', reservation.predecessor_buk_employee_id,
    'predecessor_employee_code', reservation.predecessor_employee_code,
    'created_at', reservation.created_at
  );
end;
$function$;

revoke all on function public.get_buk_employee_code_reservation_context(uuid)
  from public, anon, authenticated;
grant execute on function public.get_buk_employee_code_reservation_context(uuid)
  to service_role;

create or replace function public.checkpoint_buk_employee_code_reservation(
  p_job_id uuid,
  p_buk_employee_id text,
  p_expected_employee_code text,
  p_resolution text,
  p_predecessor_buk_employee_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  job public.buk_sync_jobs%rowtype;
  reservation private.buk_employee_code_reservations%rowtype;
  reservation_snapshot jsonb;
  now_utc timestamptz := timezone('utc', now());
begin
  select sync_job.*
    into job
    from public.buk_sync_jobs sync_job
   where sync_job.id = p_job_id
   for update;

  if job.id is null or job.status <> 'processing' then
    raise exception 'El job BUK no esta en procesamiento para registrar su ficha';
  end if;

  if nullif(trim(coalesce(p_buk_employee_id, '')), '') is null then
    raise exception 'BUK no retorno un identificador de ficha para registrar';
  end if;

  select code_reservation.*
    into reservation
    from private.buk_employee_code_reservations code_reservation
   where code_reservation.recruitment_case_candidate_id = job.recruitment_case_candidate_id
     and code_reservation.status <> 'released'
   for update;

  if reservation.id is null
     or reservation.employee_code <> trim(coalesce(p_expected_employee_code, '')) then
    raise exception 'La ficha BUK no coincide con el correlativo reservado';
  end if;

  if reservation.buk_employee_id is not null
     and reservation.buk_employee_id <> trim(p_buk_employee_id) then
    raise exception 'La reserva BUK ya esta asociada a otra ficha';
  end if;

  if exists (
    select 1
    from private.buk_employee_code_reservations other_reservation
    where other_reservation.buk_employee_id = trim(p_buk_employee_id)
      and other_reservation.status <> 'released'
      and other_reservation.id <> reservation.id
  ) then
    raise exception 'La ficha BUK ya esta asociada a otra reserva';
  end if;

  update private.buk_employee_code_reservations code_reservation
     set buk_employee_id = trim(p_buk_employee_id),
         source = 'buk_employee_checkpoint',
         evidence = coalesce(code_reservation.evidence, '{}'::jsonb)
           || jsonb_build_object(
             'checkpointed_at', now_utc,
             'buk_employee_id', trim(p_buk_employee_id),
             'employee_code', reservation.employee_code,
             'resolution', coalesce(nullif(trim(p_resolution), ''), 'unknown'),
             'predecessor_buk_employee_id',
               nullif(trim(coalesce(p_predecessor_buk_employee_id, '')), '')
           ),
         updated_at = now_utc
   where code_reservation.id = reservation.id
   returning * into reservation;

  reservation_snapshot := jsonb_build_object(
    'reservation_id', reservation.id,
    'employee_code', reservation.employee_code,
    'status', reservation.status,
    'buk_employee_id', reservation.buk_employee_id,
    'predecessor_buk_employee_id', reservation.predecessor_buk_employee_id,
    'predecessor_employee_code', reservation.predecessor_employee_code,
    'created_at', reservation.created_at
  );

  update public.buk_sync_jobs sync_job
     set buk_employee_id = reservation.buk_employee_id,
         payload_snapshot = jsonb_set(
           coalesce(sync_job.payload_snapshot, '{}'::jsonb),
           '{employee_code_reservation}',
           reservation_snapshot,
           true
         ),
         result_snapshot = jsonb_set(
           coalesce(sync_job.result_snapshot, '{}'::jsonb),
           '{employeeCheckpoint}',
           jsonb_build_object(
             'checkpointedAt', now_utc,
             'bukEmployeeId', reservation.buk_employee_id,
             'employeeCode', reservation.employee_code,
             'resolution', coalesce(nullif(trim(p_resolution), ''), 'unknown'),
             'predecessorBukEmployeeId',
               nullif(trim(coalesce(p_predecessor_buk_employee_id, '')), '')
           ),
           true
         ),
         updated_at = now_utc
   where sync_job.id = job.id;

  return reservation_snapshot;
end;
$function$;

revoke all on function public.checkpoint_buk_employee_code_reservation(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.checkpoint_buk_employee_code_reservation(uuid, text, text, text, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
