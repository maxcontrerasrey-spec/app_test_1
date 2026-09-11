-- EEES-DB-005: approved
-- owner: Human Resources / Operations
-- rollback: forward-only; restore the prior incentive eligibility behavior through a new migration if the approved business rule changes.

begin;

create or replace function public.assert_hr_incentive_roster_assignment(
  p_buk_employee_id text,
  p_service_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  roster_day_row record;
begin
  select *
    into roster_day_row
  from public.resolve_hr_roster_day_status(
    trim(coalesce(p_buk_employee_id, '')),
    coalesce(p_service_date, current_date)
  );

  if roster_day_row.assignment_id is null then
    raise exception
      'No se puede registrar ni pagar un incentivo extraordinario porque el trabajador no tiene una jornada ERP registrada para la fecha %.',
      to_char(coalesce(p_service_date, current_date), 'DD/MM/YYYY');
  end if;
end;
$function$;

create or replace function public.trg_block_hr_incentive_without_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT'
     or (new.status = 'F' and old.status is distinct from 'F') then
    perform public.assert_hr_incentive_roster_assignment(
      new.employee_buk_employee_id,
      new.service_date::date
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_block_hr_incentive_without_roster
  on public.hr_incentive_requests;
create trigger trg_block_hr_incentive_without_roster
before insert or update of status on public.hr_incentive_requests
for each row
execute function public.trg_block_hr_incentive_without_roster();

revoke all on function public.assert_hr_incentive_roster_assignment(text, date) from public, anon, authenticated;
revoke all on function public.trg_block_hr_incentive_without_roster() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
