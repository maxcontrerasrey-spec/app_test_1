-- EEES-DB-005: approved
-- owner: Business Intelligence
-- rollback: forward-only; restaurar el filtro mensual mediante una migracion posterior.
begin;

create or replace function public.get_bi_period_context(p_period_code text default null)
returns table (
  period_code text,
  month_start date,
  month_end date,
  is_current_period boolean,
  reference_date date
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  raw_period text := regexp_replace(trim(coalesce(p_period_code, '')), '\s', '', 'g');
  start_code text;
  end_code text;
  resolved_month_start date;
  resolved_month_end date;
  latest_snapshot_date date;
begin
  if raw_period = '' then
    start_code := to_char(current_date, 'YYYYMM');
    end_code := start_code;
  elsif raw_period ~ '^\d{6}(-\d{6})?$' then
    start_code := left(raw_period, 6);
    end_code := coalesce(nullif(substring(raw_period from 8 for 6), ''), start_code);
  else
    start_code := to_char(current_date, 'YYYYMM');
    end_code := start_code;
  end if;

  if substring(start_code from 5 for 2)::integer not between 1 and 12
     or substring(end_code from 5 for 2)::integer not between 1 and 12 then
    raise exception 'Periodo invalido';
  end if;

  resolved_month_start := to_date(start_code || '01', 'YYYYMMDD');
  resolved_month_end := (to_date(end_code || '01', 'YYYYMMDD') + interval '1 month - 1 day')::date;

  if resolved_month_end < resolved_month_start then
    raise exception 'El periodo inicial no puede ser posterior al periodo final';
  end if;

  select max(snapshot.snapshot_date)
    into latest_snapshot_date
  from public.buk_employees_daily_snapshot snapshot
  where snapshot.snapshot_date between resolved_month_start and resolved_month_end;

  return query
  select
    case when start_code = end_code then start_code else start_code || '-' || end_code end,
    resolved_month_start,
    resolved_month_end,
    start_code = end_code and start_code = to_char(current_date, 'YYYYMM'),
    coalesce(
      latest_snapshot_date,
      case when start_code = end_code and start_code = to_char(current_date, 'YYYYMM')
        then current_date
        else resolved_month_end
      end
    );
end;
$function$;

revoke all on function public.get_bi_period_context(text) from public, anon;
grant execute on function public.get_bi_period_context(text) to authenticated;

notify pgrst, 'reload schema';
commit;
