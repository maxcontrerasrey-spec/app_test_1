begin;

create or replace function public.user_can_view_recruitment_case(
  target_user_id uuid,
  target_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.user_is_admin(target_user_id)
    or public.user_has_role(target_user_id, 'reclutamiento')
    or public.user_has_role(target_user_id, 'control_contratos')
    or exists (
      select 1
      from public.recruitment_case_assignments rca
      where rca.recruitment_case_id = target_case_id
        and rca.user_id = target_user_id
    );
$function$;

revoke all on function public.user_can_view_recruitment_case(uuid, uuid) from public, anon;
grant execute on function public.user_can_view_recruitment_case(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
