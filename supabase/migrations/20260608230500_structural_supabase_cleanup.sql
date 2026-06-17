-- Structural cleanup focused on objects with no active contract in the app runtime.
-- Safe scope only: legacy overloads, duplicated indexes, and extension placement.

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'unaccent'
  ) then
    execute 'alter extension unaccent set schema extensions';
  end if;
end
$$;

drop function if exists public.add_hr_incentive_rate_rule(
  uuid,
  numeric,
  text,
  text,
  integer,
  date,
  date
);

drop function if exists public.add_hr_incentive_rate_rule(
  uuid,
  numeric,
  text,
  text,
  text,
  integer,
  date,
  date
);

drop function if exists public.resolve_hr_incentive_rate_rule(
  uuid,
  text,
  text,
  date
);

drop function if exists public.resolve_hr_incentive_rate_rule(
  uuid,
  text,
  text,
  text,
  date
);

drop index if exists public.idx_profiles_email;
drop index if exists public.idx_candidate_profiles_national_id;
drop index if exists public.idx_job_positions_name;
drop index if exists public.idx_shifts_name;

analyze public.profiles;
analyze public.candidate_profiles;
analyze public.job_positions;
analyze public.shifts;
analyze public.hr_incentive_rate_rules;
analyze public.hr_incentive_requests;

notify pgrst, 'reload schema';
