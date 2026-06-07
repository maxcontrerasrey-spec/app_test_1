begin;

create index if not exists idx_candidate_profiles_created_by
  on public.candidate_profiles(created_by);

create index if not exists idx_hiring_request_audit_log_approval_id
  on public.hiring_request_audit_log(approval_id);

create index if not exists idx_hiring_request_snapshots_created_by
  on public.hiring_request_snapshots(created_by);

create index if not exists idx_hiring_requests_final_decided_by
  on public.hiring_requests(final_decided_by);

create index if not exists idx_role_module_access_module_code
  on public.role_module_access(module_code);

create index if not exists idx_user_roles_assigned_by
  on public.user_roles(assigned_by);

create index if not exists idx_workflow_approvers_approver_user_id
  on public.workflow_approvers(approver_user_id);

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or public.user_is_admin((select auth.uid()))
);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
  (select auth.uid()) = id
  or public.user_is_admin((select auth.uid()))
)
with check (
  (select auth.uid()) = id
  or public.user_is_admin((select auth.uid()))
);

drop policy if exists "user_roles_select_self_or_admin" on public.user_roles;
create policy "user_roles_select_self_or_admin"
on public.user_roles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.user_is_admin((select auth.uid()))
);

drop policy if exists "user_roles_manage_admin_only" on public.user_roles;

create policy "user_roles_insert_admin_only"
on public.user_roles
for insert
to authenticated
with check (public.user_is_admin((select auth.uid())));

create policy "user_roles_update_admin_only"
on public.user_roles
for update
to authenticated
using (public.user_is_admin((select auth.uid())))
with check (public.user_is_admin((select auth.uid())));

create policy "user_roles_delete_admin_only"
on public.user_roles
for delete
to authenticated
using (public.user_is_admin((select auth.uid())));

drop policy if exists "document_types_admin_all" on public.document_types;

create policy "document_types_admin_insert"
on public.document_types
for insert
to authenticated
with check (public.user_is_admin((select auth.uid())));

create policy "document_types_admin_update"
on public.document_types
for update
to authenticated
using (public.user_is_admin((select auth.uid())))
with check (public.user_is_admin((select auth.uid())));

create policy "document_types_admin_delete"
on public.document_types
for delete
to authenticated
using (public.user_is_admin((select auth.uid())));

drop policy if exists "cost_center_approvers_admin_only" on public.cost_center_approvers;
create policy "cost_center_approvers_admin_only"
on public.cost_center_approvers
for select
to authenticated
using (public.user_is_admin((select auth.uid())));

drop policy if exists "workflow_approvers_admin_only" on public.workflow_approvers;
create policy "workflow_approvers_admin_only"
on public.workflow_approvers
for select
to authenticated
using (public.user_is_admin((select auth.uid())));

notify pgrst, 'reload schema';

commit;
