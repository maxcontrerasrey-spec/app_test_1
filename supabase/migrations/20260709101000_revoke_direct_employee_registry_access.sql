begin;

revoke select on public.employees from authenticated;
revoke select on public.employees_active_current from authenticated;

notify pgrst, 'reload schema';

commit;
