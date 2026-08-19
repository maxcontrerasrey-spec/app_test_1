begin;

-- Fixes the validation path for psychologist-reviewed reports. The previous
-- implementation used a local PL/pgSQL variable named output_hash, which became
-- ambiguous against private.psych_ai_interpretations.output_hash during UPDATE.
create or replace function public.review_psych_ai_interpretation(
  p_interpretation_id uuid,
  p_action text,
  p_reviewed_output jsonb default null,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rec record;
  next_status text;
  v_reviewed_output_hash text;
  comment_value text := nullif(trim(coalesce(p_comment, '')), '');
  nowv timestamptz := timezone('utc', now());
begin
  if uid is null or not public.user_can_access_psycholaboral(uid) then
    raise exception 'Sin permisos para Gestión Psicolaboral';
  end if;

  if p_action not in ('save_review','validate','observe') then
    raise exception 'Acción de revisión inválida';
  end if;

  select i.id, i.assessment_id, i.original_output, i.reviewed_output
    into rec
    from private.psych_ai_interpretations i
   where i.id = p_interpretation_id
     and i.status in ('PENDING_REVIEW','REVIEWED','VALIDATED','OBSERVED')
   for update;

  if rec.id is null then
    raise exception 'Interpretación no disponible para revisión';
  end if;

  if p_action in ('validate', 'observe') and comment_value is null then
    raise exception 'Debes indicar el comentario profesional antes de aprobar';
  end if;

  next_status := case
    when p_action = 'validate' then 'VALIDATED'
    when p_action = 'observe' then 'OBSERVED'
    else 'REVIEWED'
  end;

  if p_reviewed_output is not null and jsonb_typeof(p_reviewed_output) <> 'object' then
    raise exception 'La revisión debe ser un objeto JSON';
  end if;

  v_reviewed_output_hash := case
    when p_reviewed_output is null then null
    else encode(extensions.digest(p_reviewed_output::text, 'sha256'), 'hex')
  end;

  update private.psych_ai_interpretations i
     set status = next_status,
         reviewed_output = coalesce(p_reviewed_output, i.reviewed_output, i.original_output),
         reviewed_output_hash = coalesce(v_reviewed_output_hash, i.reviewed_output_hash),
         reviewer_comment = comment_value,
         reviewed_by = uid,
         reviewed_at = nowv,
         updated_at = nowv
   where i.id = rec.id;

  update private.psychometric_assessments a
     set ai_status = next_status, ai_updated_at = nowv, updated_at = nowv
   where a.id = rec.assessment_id;

  insert into private.psychometric_audit_log(assessment_id, event_type, actor_user_id, metadata)
  values (
    rec.assessment_id,
    'psych_ai_' || lower(next_status),
    uid,
    jsonb_build_object('interpretation_id', rec.id, 'comment_present', comment_value is not null)
  );

  return public.get_psych_ai_review_detail(rec.assessment_id);
end;
$$;

revoke all on function public.review_psych_ai_interpretation(uuid,text,jsonb,text) from public, anon;
grant execute on function public.review_psych_ai_interpretation(uuid,text,jsonb,text) to authenticated;

notify pgrst, 'reload schema';

commit;
