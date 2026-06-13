create index if not exists idx_hr_roster_exceptions_created_by
  on public.hr_roster_exceptions (created_by);

create index if not exists idx_hr_roster_exceptions_superseded_created_by
  on public.hr_roster_exceptions (superseded_created_by)
  where superseded_created_by is not null;
