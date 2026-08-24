begin;

create or replace function public.validate_buk_sync_job_pension_payload()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  worker_file jsonb := coalesce(new.payload_snapshot -> 'profile' -> 'worker_file', '{}'::jsonb);
  pension_regime text := lower(trim(coalesce(worker_file ->> 'pension_regime', '')));
  contribution_fund text := trim(coalesce(worker_file ->> 'contribution_fund', ''));
  afp_collection_entity text := trim(coalesce(worker_file ->> 'afp_collection_entity', ''));
begin
  if pension_regime = 'afp'
     and contribution_fund = ''
     and afp_collection_entity = '' then
    raise exception using
      errcode = '23514',
      message = 'La ficha BUK está incompleta: para el régimen AFP debes seleccionar un fondo de cotización antes de sincronizar.';
  end if;

  return new;
end;
$function$;

drop trigger if exists validate_buk_sync_job_pension_payload on public.buk_sync_jobs;
create trigger validate_buk_sync_job_pension_payload
before insert or update of payload_snapshot on public.buk_sync_jobs
for each row
execute function public.validate_buk_sync_job_pension_payload();

revoke all on function public.validate_buk_sync_job_pension_payload() from public, anon, authenticated;

commit;
