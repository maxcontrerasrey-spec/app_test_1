begin;

drop policy if exists "operations_service_entries_select" on public.service_entries;
create policy "operations_service_entries_select"
on public.service_entries
for select
to authenticated
using (
  public.user_can_manage_operations((select auth.uid()))
  and (
    created_by = (select auth.uid())
    or public.user_is_admin((select auth.uid()))
  )
);

notify pgrst, 'reload schema';

commit;
