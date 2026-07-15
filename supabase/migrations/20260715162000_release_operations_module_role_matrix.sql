begin;

insert into public.role_module_access (role_code, module_code, can_view)
select ar.code, 'operaciones', true
from public.app_roles ar
join public.app_modules am
  on am.code = 'operaciones'
where ar.is_active = true
on conflict (role_code, module_code) do update
set can_view = true;

create or replace function public.user_can_manage_operations(target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if target_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> target_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(target_user_id)
      or public.user_has_role(target_user_id, 'operaciones_l_1')
      or public.user_has_role(target_user_id, 'operaciones_l_2');
end;
$function$;

revoke all on function public.user_can_manage_operations(uuid) from public, anon;
grant execute on function public.user_can_manage_operations(uuid) to authenticated;

drop policy if exists "operations_service_entries_select" on public.service_entries;
create policy "operations_service_entries_select"
on public.service_entries
for select
to authenticated
using (public.user_can_access_module((select auth.uid()), 'operaciones'));

notify pgrst, 'reload schema';

commit;
