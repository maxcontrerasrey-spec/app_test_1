-- Evaluate auth.uid() once per statement instead of once per candidate row.
-- This is a performance-only rewrite: policy names, roles and predicates remain unchanged.

alter policy accreditation_audit_log_select_authenticated
  on public.accreditation_audit_log
  using (public.user_can_manage_accreditation((select auth.uid())));

alter policy accreditation_matrix_select_authenticated
  on public.accreditation_matrix
  using (public.user_can_manage_accreditation((select auth.uid())));

alter policy accreditation_requirements_select_authenticated
  on public.accreditation_requirements
  using (public.user_can_manage_accreditation((select auth.uid())));

alter policy accreditation_sites_select_authenticated
  on public.accreditation_sites
  using (public.user_can_manage_accreditation((select auth.uid())));

alter policy buk_employee_snapshot_select_authenticated
  on public.buk_employees_daily_snapshot
  using (
    public.user_can_access_module((select auth.uid()), 'bi_analytics')
    or public.user_is_admin((select auth.uid()))
  );

alter policy hiring_approval_configs_manage_admin
  on public.hiring_approval_configs
  using (public.user_is_admin((select auth.uid())))
  with check (public.user_is_admin((select auth.uid())));

alter policy hiring_approval_configs_select_operational
  on public.hiring_approval_configs
  using (
    public.user_is_admin((select auth.uid()))
    or public.user_has_role((select auth.uid()), 'reclutamiento')
    or public.user_has_role((select auth.uid()), 'control_contratos')
  );

alter policy hiring_request_approvals_select_visible
  on public.hiring_request_approvals
  using (
    exists (
      select 1
      from public.hiring_requests hr
      where hr.id = hiring_request_approvals.hiring_request_id
        and (
          hr.requester_id = (select auth.uid())
          or public.user_is_admin((select auth.uid()))
          or public.user_has_role((select auth.uid()), 'reclutamiento')
          or public.user_has_role((select auth.uid()), 'control_contratos')
          or hiring_request_approvals.approver_user_id = (select auth.uid())
        )
    )
  );

alter policy hiring_requests_select_owned_or_operational
  on public.hiring_requests
  using (
    requester_id = (select auth.uid())
    or public.user_is_admin((select auth.uid()))
    or public.user_has_role((select auth.uid()), 'reclutamiento')
    or public.user_has_role((select auth.uid()), 'control_contratos')
  );

alter policy orion_messages_insert_owned_session
  on public.orion_messages
  with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.orion_sessions session_row
      where session_row.id = orion_messages.session_id
        and session_row.created_by = (select auth.uid())
    )
  );

alter policy orion_messages_select_owned_session
  on public.orion_messages
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.orion_sessions session_row
      where session_row.id = orion_messages.session_id
        and session_row.created_by = (select auth.uid())
    )
  );

alter policy orion_sessions_delete_own
  on public.orion_sessions
  using ((select auth.uid()) is not null and created_by = (select auth.uid()));

alter policy orion_sessions_insert_own
  on public.orion_sessions
  with check ((select auth.uid()) is not null and created_by = (select auth.uid()));

alter policy orion_sessions_select_own
  on public.orion_sessions
  using ((select auth.uid()) is not null and created_by = (select auth.uid()));

alter policy orion_sessions_update_own
  on public.orion_sessions
  using ((select auth.uid()) is not null and created_by = (select auth.uid()))
  with check ((select auth.uid()) is not null and created_by = (select auth.uid()));

alter policy profiles_select_self_or_admin
  on public.profiles
  using ((select auth.uid()) = id or public.user_is_admin((select auth.uid())));

alter policy profiles_update_self_or_admin
  on public.profiles
  using (
    public.user_is_admin((select auth.uid()))
    or ((select auth.uid()) = id and must_reset_password = false)
  )
  with check (
    public.user_is_admin((select auth.uid()))
    or ((select auth.uid()) = id and must_reset_password = false)
  );

alter policy security_audit_logs_select_admin
  on public.security_audit_logs
  using (public.user_is_admin((select auth.uid())));

alter policy user_roles_manage_admin_only
  on public.user_roles
  using (public.user_is_admin((select auth.uid())))
  with check (public.user_is_admin((select auth.uid())));

alter policy user_roles_select_self_or_admin
  on public.user_roles
  using ((select auth.uid()) = user_id or public.user_is_admin((select auth.uid())));

alter policy worker_accreditations_select_authenticated
  on public.worker_accreditations
  using (public.user_can_manage_accreditation((select auth.uid())));

alter policy worker_document_tracking_select_authenticated
  on public.worker_document_tracking
  using (public.user_can_manage_accreditation((select auth.uid())));

notify pgrst, 'reload schema';
