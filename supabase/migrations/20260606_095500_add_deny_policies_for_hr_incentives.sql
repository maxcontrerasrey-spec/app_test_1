begin;

drop policy if exists hr_incentive_allowed_job_titles_no_direct_access on public.hr_incentive_allowed_job_titles;
create policy hr_incentive_allowed_job_titles_no_direct_access
on public.hr_incentive_allowed_job_titles
for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_incentive_types_no_direct_access on public.hr_incentive_types;
create policy hr_incentive_types_no_direct_access
on public.hr_incentive_types
for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_incentive_rate_rules_no_direct_access on public.hr_incentive_rate_rules;
create policy hr_incentive_rate_rules_no_direct_access
on public.hr_incentive_rate_rules
for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_incentive_requests_no_direct_access on public.hr_incentive_requests;
create policy hr_incentive_requests_no_direct_access
on public.hr_incentive_requests
for all
to authenticated
using (false)
with check (false);

drop policy if exists hr_incentive_request_history_no_direct_access on public.hr_incentive_request_history;
create policy hr_incentive_request_history_no_direct_access
on public.hr_incentive_request_history
for all
to authenticated
using (false)
with check (false);

commit;
