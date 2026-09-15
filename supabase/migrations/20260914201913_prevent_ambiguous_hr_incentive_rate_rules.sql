-- EEES-DB-005: approved
-- owner: Engineering and Human Resources
-- rollback: forward-only; drop the trigger through a later migration if rule overlap becomes intentional.

begin;

with redundant_rules as (
  select rr.id
  from public.hr_incentive_rate_rules rr
  where rr.is_active = true
    and exists (
      select 1
      from public.hr_incentive_rate_rules preferred
      where preferred.id <> rr.id
        and preferred.is_active = true
        and preferred.incentive_type_id = rr.incentive_type_id
        and preferred.contract_code is not distinct from rr.contract_code
        and preferred.job_title is not distinct from rr.job_title
        and preferred.union_name is not distinct from rr.union_name
        and preferred.union_status is not distinct from rr.union_status
        and preferred.priority = rr.priority
        and preferred.amount is not distinct from rr.amount
        and preferred.fallback_base_salary is not distinct from rr.fallback_base_salary
        and preferred.fallback_weekly_hours is not distinct from rr.fallback_weekly_hours
        and preferred.overtime_multiplier is not distinct from rr.overtime_multiplier
        and coalesce(preferred.valid_from, '-infinity'::date) <= coalesce(rr.valid_to, 'infinity'::date)
        and coalesce(rr.valid_from, '-infinity'::date) <= coalesce(preferred.valid_to, 'infinity'::date)
        and (
          coalesce(preferred.valid_to, 'infinity'::date),
          preferred.created_at,
          preferred.id
        ) > (
          coalesce(rr.valid_to, 'infinity'::date),
          rr.created_at,
          rr.id
        )
    )
)
update public.hr_incentive_rate_rules rr
set
  is_active = false,
  updated_at = timezone('utc', now())
from redundant_rules rd
where rd.id = rr.id
  and rr.is_active = true;

create or replace function private.prevent_ambiguous_hr_incentive_rate_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.is_active and exists (
    select 1
    from public.hr_incentive_rate_rules existing
    where existing.id <> new.id
      and existing.is_active = true
      and existing.incentive_type_id = new.incentive_type_id
      and existing.contract_code is not distinct from new.contract_code
      and existing.job_title is not distinct from new.job_title
      and existing.union_name is not distinct from new.union_name
      and existing.union_status is not distinct from new.union_status
      and existing.priority = new.priority
      and coalesce(existing.valid_from, '-infinity'::date) <= coalesce(new.valid_to, 'infinity'::date)
      and coalesce(new.valid_from, '-infinity'::date) <= coalesce(existing.valid_to, 'infinity'::date)
  ) then
    raise exception
      'Ya existe una regla activa con el mismo alcance, prioridad y vigencia superpuesta. Cierra o desactiva la regla anterior antes de continuar.';
  end if;

  return new;
end;
$function$;

revoke all on function private.prevent_ambiguous_hr_incentive_rate_rule() from public, anon, authenticated;

drop trigger if exists trg_prevent_ambiguous_hr_incentive_rate_rule
  on public.hr_incentive_rate_rules;

create trigger trg_prevent_ambiguous_hr_incentive_rate_rule
before insert or update of
  incentive_type_id,
  contract_code,
  job_title,
  union_name,
  union_status,
  priority,
  valid_from,
  valid_to,
  is_active
on public.hr_incentive_rate_rules
for each row
execute function private.prevent_ambiguous_hr_incentive_rate_rule();

commit;
