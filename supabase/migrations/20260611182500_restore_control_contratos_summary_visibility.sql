begin;

insert into public.role_module_access (role_code, module_code, can_view)
values ('control_contratos', 'control_contrataciones', true)
on conflict (role_code, module_code) do update
set can_view = true;

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
      public.user_is_admin(target_user_id)
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
      or (
        not public.user_has_role(target_user_id, 'gerencia')
        and requester_user_id = target_user_id
      )
    );
$function$;

create or replace function public.user_can_view_recruitment_process_summary(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.recruitment_cases rc
    join public.hiring_requests hr
      on hr.id = rc.hiring_request_id
    where rc.id = target_case_id
      and public.user_can_view_hiring_request_process_summary(
        target_user_id,
        hr.requester_id,
        hr.cost_center_code
      )
  );
$function$;

revoke all on function public.user_can_view_hiring_request_process_summary(uuid, uuid, text) from public, anon;
grant execute on function public.user_can_view_hiring_request_process_summary(uuid, uuid, text) to authenticated;

revoke all on function public.user_can_view_recruitment_process_summary(uuid, uuid) from public, anon;
grant execute on function public.user_can_view_recruitment_process_summary(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
