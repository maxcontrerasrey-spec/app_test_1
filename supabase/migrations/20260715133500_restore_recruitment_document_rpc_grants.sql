begin;

revoke all on function public.get_recruitment_case_detail(uuid) from public, anon;
revoke all on function public.get_candidate_checklist(uuid) from public, anon;

grant execute on function public.get_recruitment_case_detail(uuid) to authenticated, service_role;
grant execute on function public.get_candidate_checklist(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
