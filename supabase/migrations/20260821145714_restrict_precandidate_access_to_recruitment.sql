-- Los precandidatos son un flujo operativo exclusivo de Reclutamiento.
-- Se mantiene la comprobación del actor para impedir que otro usuario invoque
-- el helper con el UUID de una persona que sí tenga el rol.
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

  return public.user_has_role(actor_id, 'reclutamiento');
end;
$function$;

create or replace function public.assert_dsal_precandidate_review_access(actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if actor_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_review_dsal_precandidates(actor_id) then
    raise exception 'Sin permisos: los precandidatos solo están disponibles para Reclutamiento';
  end if;
end;
$function$;

revoke all on function public.user_can_review_dsal_precandidates(uuid) from public, anon, authenticated;
revoke all on function public.assert_dsal_precandidate_review_access(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
