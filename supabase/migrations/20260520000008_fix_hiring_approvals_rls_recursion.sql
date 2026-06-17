begin;

drop policy if exists "hiring_request_approvals_select_scoped" on public.hiring_request_approvals;

create policy "hiring_request_approvals_select_scoped"
on public.hiring_request_approvals
for select
to authenticated
using (
  approver_user_id = auth.uid()
  or public.user_is_admin(auth.uid())
);

notify pgrst, 'reload schema';

commit;
