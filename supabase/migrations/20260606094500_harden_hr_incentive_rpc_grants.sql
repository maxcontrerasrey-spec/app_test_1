begin;

revoke all on function public.user_can_manage_hr_incentives(uuid) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_setup_catalogs() from public, anon, authenticated;
revoke all on function public.add_hr_incentive_allowed_job_title(text) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_allowed_job_title_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.add_hr_incentive_type(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_type_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, integer, date, date) from public, anon, authenticated;
revoke all on function public.set_hr_incentive_rate_rule_status(uuid, boolean) from public, anon, authenticated;
revoke all on function public.search_hr_incentive_eligible_workers(text, integer) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_worker_context(text) from public, anon, authenticated;
revoke all on function public.resolve_hr_incentive_rate_rule(uuid, text, text, date) from public, anon, authenticated;
revoke all on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date) from public, anon, authenticated;
revoke all on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_hr_incentive_request(uuid, text) from public, anon, authenticated;
revoke all on function public.get_hr_incentive_requests(text, text, text, text, uuid, date) from public, anon, authenticated;

grant execute on function public.user_can_manage_hr_incentives(uuid) to authenticated;
grant execute on function public.get_hr_incentive_setup_catalogs() to authenticated;
grant execute on function public.add_hr_incentive_allowed_job_title(text) to authenticated;
grant execute on function public.set_hr_incentive_allowed_job_title_status(uuid, boolean) to authenticated;
grant execute on function public.add_hr_incentive_type(text, text, text, boolean) to authenticated;
grant execute on function public.set_hr_incentive_type_status(uuid, boolean) to authenticated;
grant execute on function public.add_hr_incentive_rate_rule(uuid, numeric, text, text, integer, date, date) to authenticated;
grant execute on function public.set_hr_incentive_rate_rule_status(uuid, boolean) to authenticated;
grant execute on function public.search_hr_incentive_eligible_workers(text, integer) to authenticated;
grant execute on function public.get_hr_incentive_worker_context(text) to authenticated;
grant execute on function public.resolve_hr_incentive_rate_rule(uuid, text, text, date) to authenticated;
grant execute on function public.calculate_hr_incentive_preview(text, uuid, text, numeric, date) to authenticated;
grant execute on function public.create_hr_incentive_request(text, uuid, text, text, text, timestamptz, numeric, text, text, text) to authenticated;
grant execute on function public.cancel_hr_incentive_request(uuid, text) to authenticated;
grant execute on function public.get_hr_incentive_requests(text, text, text, text, uuid, date) to authenticated;

notify pgrst, 'reload schema';

commit;
