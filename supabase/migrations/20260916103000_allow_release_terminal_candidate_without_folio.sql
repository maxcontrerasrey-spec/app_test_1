/*
-- EEES-DB-005: approved
-- owner: Codex / Control de Contrataciones
-- rollback: restaurar la función release_candidate_without_folio de la migración 20260821170000

Permite liberar a Sin Folio un candidato rechazado o retirado que no fue contratado.
La evidencia del rechazo se conserva en stage_history y audit_log; no se elimina ningún registro.
*/

begin;

create or replace function public.prevent_stage_change_without_new_folio()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  current_case_status text;
  is_release_transition boolean := new.released_without_folio_at is not null
    and old.released_without_folio_at is null;
begin
  if new.stage_code is distinct from old.stage_code and not is_release_transition then
    select rc.status into current_case_status
      from public.recruitment_cases rc
     where rc.id = new.recruitment_case_id;
    if current_case_status in ('filled', 'closed_unfilled') then
      raise exception 'El candidato debe asignarse a un folio nuevo antes de moverlo de etapa';
    end if;
  end if;
  return new;
end;
$function$;

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
  v_previous_stage text;
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

  if not public.user_can_manage_recruitment_case(v_actor_id, v_candidate.recruitment_case_id) then
    raise exception 'Sin permisos para gestionar el folio del candidato';
  end if;

  if v_candidate.stage_code = 'hired' then
    raise exception 'No se puede dejar sin folio un candidato contratado';
  end if;

  -- La acción es idempotente para que un doble clic no genere auditoría duplicada.
  if v_candidate.released_without_folio_at is not null then
    return;
  end if;

  v_previous_stage := v_candidate.stage_code;

  update public.recruitment_case_candidates as rcc
     set stage_code = case
           when rcc.stage_code in ('rejected', 'withdrawn') then 'lead'
           else rcc.stage_code
         end,
         stage_entered_at = case
           when rcc.stage_code in ('rejected', 'withdrawn') then timezone('utc', now())
           else rcc.stage_entered_at
         end,
         is_selected = false,
         suitability_status = case
           when rcc.stage_code in ('rejected', 'withdrawn') then 'unknown'
           else rcc.suitability_status
         end,
         rejection_reason = case
           when rcc.stage_code = 'rejected' then rcc.rejection_reason
           else rcc.rejection_reason
         end,
         released_without_folio_at = timezone('utc', now()),
         released_without_folio_by = v_actor_id,
         released_without_folio_reason = v_comment,
         updated_at = timezone('utc', now())
   where rcc.id = v_candidate.id;

  if v_previous_stage in ('rejected', 'withdrawn') then
    insert into public.recruitment_case_candidate_stage_history (
      recruitment_case_candidate_id,
      from_stage,
      to_stage,
      changed_by,
      reason_code,
      comment
    ) values (
      v_candidate.id,
      v_previous_stage,
      'lead',
      v_actor_id,
      'candidate_released_without_folio',
      v_comment
    );
  end if;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  ) values (
    v_candidate.recruitment_case_id,
    v_candidate.id,
    v_actor_id,
    'candidate_released_without_folio',
    jsonb_build_object(
      'stage_code', v_previous_stage,
      'rejection_reason', v_candidate.rejection_reason,
      'released_without_folio_at', v_candidate.released_without_folio_at
    ),
    jsonb_build_object(
      'stage_code', case when v_previous_stage in ('rejected', 'withdrawn') then 'lead' else v_previous_stage end,
      'released_without_folio', true
    ),
    jsonb_build_object(
      'comment', v_comment,
      'source_case_id', v_candidate.recruitment_case_id,
      'preserved_candidate_profile_id', v_candidate.candidate_profile_id,
      'preserved_terminal_stage', v_previous_stage,
      'preserved_rejection_reason', v_candidate.rejection_reason
    )
  );

  perform public.sync_recruitment_case_status(v_candidate.recruitment_case_id, v_actor_id);
end;
$function$;

revoke all on function public.release_candidate_without_folio(uuid, text) from public, anon;
grant execute on function public.release_candidate_without_folio(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
