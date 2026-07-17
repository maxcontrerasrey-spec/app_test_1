begin;

create or replace function public.user_can_edit_operations_contract(
  requested_user_id uuid,
  requested_contract_id bigint
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if requested_user_id is null or requested_contract_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> requested_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  if public.user_is_admin(requested_user_id) then
    return exists (
      select 1
      from public.contracts c
      where c.id = requested_contract_id
        and c.is_active = true
    );
  end if;

  if not (
    public.user_has_role(requested_user_id, 'operaciones_l_1')
    or public.user_has_role(requested_user_id, 'operaciones_l_2')
  ) then
    return false;
  end if;

  if not public.user_can_manage_operations(requested_user_id) then
    return false;
  end if;

  return exists (
    select 1
    from public.operations_contract_editors oce
    join public.contracts c
      on c.id = oce.contract_id
    where oce.user_id = requested_user_id
      and oce.contract_id = requested_contract_id
      and oce.is_active = true
      and c.is_active = true
  );
end;
$function$;

revoke all on function public.user_can_edit_operations_contract(uuid, bigint) from public, anon;
grant execute on function public.user_can_edit_operations_contract(uuid, bigint) to authenticated;

create or replace view public.operations_editable_contracts
with (security_invoker = true, security_barrier = true)
as
select
  (select auth.uid()) as user_id,
  c.id as contract_id,
  c.code,
  c.contract_name
from public.contracts c
where c.is_active = true
  and public.user_is_admin((select auth.uid()))

union

select
  oce.user_id,
  c.id as contract_id,
  c.code,
  c.contract_name
from public.operations_contract_editors oce
join public.contracts c
  on c.id = oce.contract_id
where oce.user_id = (select auth.uid())
  and oce.is_active = true
  and c.is_active = true
  and public.user_can_edit_operations_contract((select auth.uid()), c.id);

revoke all on public.operations_editable_contracts from public, anon;
grant select on public.operations_editable_contracts to authenticated;

notify pgrst, 'reload schema';

commit;
