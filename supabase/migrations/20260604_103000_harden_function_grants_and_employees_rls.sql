begin;

alter function public.set_updated_at() set search_path = public;
alter function public.normalize_candidate_who_causes(jsonb) set search_path = public;

do $$
declare
  fn record;
begin
  for fn in
    select
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format(
      'revoke all on function public.%I(%s) from public, anon;',
      fn.function_name,
      fn.identity_args
    );
  end loop;
end
$$;

revoke all on function public.set_updated_at() from authenticated;
revoke all on function public.normalize_candidate_who_causes(jsonb) from authenticated;
revoke all on function public.handle_new_auth_user() from authenticated;
revoke all on function public.sync_auth_user_profile() from authenticated;
revoke all on function public.protect_profiles_sensitive_columns() from authenticated;
revoke all on function public.find_active_candidate_contract_lock(uuid, uuid) from authenticated;
revoke all on function public.open_recruitment_case_from_hiring_request(uuid, uuid) from authenticated;
revoke all on function public.sync_recruitment_case_status(uuid, uuid) from authenticated;

revoke all on table public.employees from anon;
revoke insert, update, delete, truncate, references, trigger on table public.employees from authenticated;

drop policy if exists employees_authenticated_select on public.employees;
create policy employees_authenticated_select
on public.employees
for select
to authenticated
using (
  public.user_is_admin(auth.uid())
  or public.user_can_access_module(auth.uid(), 'operaciones')
  or public.user_can_access_module(auth.uid(), 'control_contrataciones')
  or public.user_can_access_module(auth.uid(), 'solicitud_contrataciones')
  or public.user_can_access_module(auth.uid(), 'certificados')
  or public.user_can_access_module(auth.uid(), 'seguimiento_certificados')
);

notify pgrst, 'reload schema';

commit;
