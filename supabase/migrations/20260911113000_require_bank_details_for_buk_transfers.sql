-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; replace the validation functions and triggers with a corrective migration.

begin;

create or replace function public.buk_payment_method_requires_bank_account(p_payment_method text)
returns boolean
language sql
immutable
set search_path = public
as $function$
  select translate(lower(trim(coalesce(p_payment_method, ''))), 'áéíóú', 'aeiou')
    in ('transferencia', 'transferencia bancaria');
$function$;

create or replace function public.validate_candidate_worker_file_bank_account()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  missing_fields text[] := array[]::text[];
begin
  if not public.buk_payment_method_requires_bank_account(new.payment_method) then
    return new;
  end if;

  if nullif(trim(coalesce(new.bank_name, '')), '') is null then
    missing_fields := array_append(missing_fields, 'banco');
  end if;
  if nullif(trim(coalesce(new.bank_account_type, '')), '') is null then
    missing_fields := array_append(missing_fields, 'tipo de cuenta');
  end if;
  if nullif(trim(coalesce(new.bank_account_number, '')), '') is null then
    missing_fields := array_append(missing_fields, 'número de cuenta');
  end if;

  if cardinality(missing_fields) > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'La ficha BUK está incompleta: para Transferencia Bancaria debes completar %s.',
        array_to_string(missing_fields, ', ')
      );
  end if;

  new.bank_name := nullif(trim(new.bank_name), '');
  new.bank_account_type := nullif(trim(new.bank_account_type), '');
  new.bank_account_number := nullif(trim(new.bank_account_number), '');
  return new;
end;
$function$;

drop trigger if exists validate_candidate_worker_file_bank_account on public.candidate_worker_files;
create trigger validate_candidate_worker_file_bank_account
before insert or update of payment_method, bank_name, bank_account_type, bank_account_number
on public.candidate_worker_files
for each row
execute function public.validate_candidate_worker_file_bank_account();

create or replace function public.validate_buk_sync_job_bank_account_payload()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  worker_file jsonb := coalesce(new.payload_snapshot -> 'profile' -> 'worker_file', '{}'::jsonb);
  missing_fields text[] := array[]::text[];
begin
  if not public.buk_payment_method_requires_bank_account(worker_file ->> 'payment_method') then
    return new;
  end if;

  if nullif(trim(coalesce(worker_file ->> 'bank_name', '')), '') is null then
    missing_fields := array_append(missing_fields, 'banco');
  end if;
  if nullif(trim(coalesce(worker_file ->> 'bank_account_type', '')), '') is null then
    missing_fields := array_append(missing_fields, 'tipo de cuenta');
  end if;
  if nullif(trim(coalesce(worker_file ->> 'bank_account_number', '')), '') is null then
    missing_fields := array_append(missing_fields, 'número de cuenta');
  end if;

  if cardinality(missing_fields) > 0 then
    raise exception using
      errcode = '23514',
      message = format(
        'La ficha BUK está incompleta: para Transferencia Bancaria debes completar %s antes de sincronizar.',
        array_to_string(missing_fields, ', ')
      );
  end if;

  return new;
end;
$function$;

drop trigger if exists validate_buk_sync_job_bank_account_payload on public.buk_sync_jobs;
create trigger validate_buk_sync_job_bank_account_payload
before insert or update of payload_snapshot on public.buk_sync_jobs
for each row
execute function public.validate_buk_sync_job_bank_account_payload();

revoke all on function public.buk_payment_method_requires_bank_account(text)
  from public, anon, authenticated;
revoke all on function public.validate_candidate_worker_file_bank_account()
  from public, anon, authenticated;
revoke all on function public.validate_buk_sync_job_bank_account_payload()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
