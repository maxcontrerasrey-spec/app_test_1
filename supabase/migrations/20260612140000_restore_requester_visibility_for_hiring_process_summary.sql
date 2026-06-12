create or replace function public.user_can_view_hiring_request_process_summary(
  target_user_id uuid,
  requester_user_id uuid,
  request_cost_center_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    target_user_id is not null
    and (
      requester_user_id = target_user_id
      or public.user_is_admin(target_user_id)
      or public.user_has_role(target_user_id, 'reclutamiento')
      or public.user_has_role(target_user_id, 'control_contratos')
      or public.user_has_role(target_user_id, 'director_eje')
      or public.user_has_role(target_user_id, 'gerente_general')
      or public.user_has_role(target_user_id, 'director_op')
      or (
        public.user_has_role(target_user_id, 'gerencia')
        and exists (
          select 1
          from public.cost_center_approvers cca
          where cca.cost_center_code = request_cost_center_code
            and cca.approver_user_id = target_user_id
            and cca.is_active = true
        )
      )
    );
$function$;

revoke all on function public.user_can_view_hiring_request_process_summary(uuid, uuid, text) from public, anon;
grant execute on function public.user_can_view_hiring_request_process_summary(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
