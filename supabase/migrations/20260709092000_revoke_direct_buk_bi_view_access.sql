begin;

revoke all on public.buk_bi_headcount_by_contract from public, anon, authenticated;
revoke all on public.buk_bi_headcount_by_job_title from public, anon, authenticated;
revoke all on public.buk_bi_age_distribution from public, anon, authenticated;
revoke all on public.buk_bi_exceptions_today from public, anon, authenticated;
revoke all on public.buk_bi_presence_summary_today from public, anon, authenticated;
revoke all on public.buk_bi_exceptions_monthly from public, anon, authenticated;
revoke all on public.buk_bi_vacation_forecast from public, anon, authenticated;
revoke all on public.buk_bi_medical_leave_by_area from public, anon, authenticated;
revoke all on public.buk_bi_recruitment_pipeline from public, anon, authenticated;
revoke all on public.buk_bi_hiring_velocity from public, anon, authenticated;
revoke all on public.buk_bi_workforce_overview from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
