begin;

drop view if exists public.operations_editable_contracts;

drop policy if exists "operations_base_services_select" on public.base_services;
drop policy if exists "operations_equipment_select" on public.equipment;
drop policy if exists "operations_service_entries_select" on public.service_entries;

drop function if exists public.user_can_edit_operations_contract(uuid, bigint);
drop function if exists public.user_can_manage_operations(uuid);
drop function if exists public.user_can_access_bi_analytics(uuid);

create or replace function public.user_can_manage_operations(requested_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if requested_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> requested_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(requested_user_id)
      or public.user_has_role(requested_user_id, 'operaciones_l_1')
      or public.user_has_role(requested_user_id, 'operaciones_l_2');
end;
$function$;

revoke all on function public.user_can_manage_operations(uuid) from public, anon;
grant execute on function public.user_can_manage_operations(uuid) to authenticated;

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
  oce.user_id,
  c.id as contract_id,
  c.code,
  c.contract_name
from public.operations_contract_editors oce
join public.contracts c
  on c.id = oce.contract_id
where oce.user_id = auth.uid()
  and oce.is_active = true
  and c.is_active = true
  and public.user_can_edit_operations_contract(auth.uid(), c.id);

revoke all on public.operations_editable_contracts from public, anon;
grant select on public.operations_editable_contracts to authenticated;

create policy "operations_base_services_select"
on public.base_services
for select
to authenticated
using (public.user_can_access_module((select auth.uid()), 'operaciones'));

create policy "operations_equipment_select"
on public.equipment
for select
to authenticated
using (public.user_can_access_module((select auth.uid()), 'operaciones'));

create policy "operations_service_entries_select"
on public.service_entries
for select
to authenticated
using (public.user_can_access_module((select auth.uid()), 'operaciones'));

create or replace function public.user_can_access_bi_analytics(requested_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if requested_user_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> requested_user_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(requested_user_id)
      or public.user_can_access_feature(requested_user_id, 'bi_dotacion')
      or public.user_can_access_feature(requested_user_id, 'bi_incentivos')
      or public.user_can_access_feature(requested_user_id, 'bi_reclutamiento');
end;
$function$;

revoke all on function public.user_can_access_bi_analytics(uuid) from public, anon;
grant execute on function public.user_can_access_bi_analytics(uuid) to authenticated;

drop policy if exists "orion_knowledge_admin_upload" on storage.objects;
drop policy if exists "orion_knowledge_admin_read" on storage.objects;
drop policy if exists "orion_knowledge_admin_delete" on storage.objects;

create policy "orion_knowledge_admin_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'orion_knowledge'
  and (name like 'knowledge/%' or name not like '%/%')
  and public.user_is_admin((select auth.uid()))
);

create policy "orion_knowledge_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'orion_knowledge'
  and (name like 'knowledge/%' or name not like '%/%')
  and public.user_is_admin((select auth.uid()))
);

create policy "orion_knowledge_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'orion_knowledge'
  and (name like 'knowledge/%' or name not like '%/%')
  and public.user_is_admin((select auth.uid()))
);

revoke all on public.orion_sessions from public, anon;
revoke all on public.orion_messages from public, anon;
revoke all on public.orion_sessions from authenticated;
revoke all on public.orion_messages from authenticated;

grant select on public.orion_sessions to authenticated;
grant insert on public.orion_sessions to authenticated;
grant update on public.orion_sessions to authenticated;
grant delete on public.orion_sessions to authenticated;
grant select on public.orion_messages to authenticated;
grant insert on public.orion_messages to authenticated;

notify pgrst, 'reload schema';

commit;
