begin;

create or replace function public.release_candidate_without_folio(
  p_case_candidate_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_candidate public.recruitment_case_candidates%rowtype;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if v_actor_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(v_actor_id);

  select *
    into v_candidate
    from public.recruitment_case_candidates as rcc
   where rcc.id = p_case_candidate_id
   for update;

  if v_candidate.id is null then
    raise exception 'No existe el candidato';
  end if;

  if v_candidate.stage_code in ('hired', 'rejected', 'withdrawn') then
    raise exception 'No se puede dejar sin folio un candidato en etapa terminal';
  end if;

  if not public.user_can_manage_recruitment_case(v_actor_id, v_candidate.recruitment_case_id) then
    raise exception 'Sin permisos para gestionar el folio del candidato';
  end if;

  -- La acción es idempotente para que un doble clic no genere auditoría duplicada.
  if v_candidate.released_without_folio_at is not null then
    return;
  end if;

  update public.recruitment_case_candidates as rcc
     set released_without_folio_at = timezone('utc', now()),
         released_without_folio_by = v_actor_id,
         released_without_folio_reason = v_comment,
         updated_at = timezone('utc', now())
   where rcc.id = v_candidate.id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  ) values (
    v_candidate.recruitment_case_id,
    v_candidate.id,
    v_actor_id,
    'candidate_released_without_folio',
    jsonb_build_object(
      'comment', v_comment,
      'source_case_id', v_candidate.recruitment_case_id,
      'preserved_candidate_profile_id', v_candidate.candidate_profile_id
    )
  );

  perform public.sync_recruitment_case_status(v_candidate.recruitment_case_id, v_actor_id);
end;
$function$;

revoke all on function public.release_candidate_without_folio(uuid, text) from public, anon;
grant execute on function public.release_candidate_without_folio(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
