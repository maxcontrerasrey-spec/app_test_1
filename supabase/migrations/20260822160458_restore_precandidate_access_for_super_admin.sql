-- Superadministradores conservan la vista y las acciones completas del módulo.
-- La restricción sigue aplicando a cualquier otro usuario sin Reclutamiento.
create or replace function public.user_can_review_dsal_precandidates(actor_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if actor_id is null or current_user_id is null or current_user_id <> actor_id then
    return false;
  end if;

  return exists (
    select 1
    from public.profiles profile
    where profile.id = actor_id
      and profile.is_super_admin = true
  )
  or public.user_has_role(actor_id, 'reclutamiento');
end;
$function$;

revoke all on function public.user_can_review_dsal_precandidates(uuid) from public, anon, authenticated;
revoke all on function public.assert_dsal_precandidate_review_access(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
