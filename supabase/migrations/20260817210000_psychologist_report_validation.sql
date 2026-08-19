begin;

-- The report is a controlled document: only a validated interpretation with a
-- non-empty professional comment and a resolvable reviewer identity can be issued.
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
  output_hash text;
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

  output_hash := case
    when p_reviewed_output is null then null
    else encode(extensions.digest(p_reviewed_output::text, 'sha256'), 'hex')
  end;

  update private.psych_ai_interpretations
     set status = next_status,
         reviewed_output = coalesce(p_reviewed_output, reviewed_output, original_output),
         reviewed_output_hash = coalesce(output_hash, reviewed_output_hash),
         reviewer_comment = comment_value,
         reviewed_by = uid,
         reviewed_at = nowv,
         updated_at = nowv
   where id = rec.id;

  update private.psychometric_assessments
     set ai_status = next_status, ai_updated_at = nowv, updated_at = nowv
   where id = rec.assessment_id;

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

-- Service-role preflight used before the certificate claim. This prevents a
-- failed approval from leaving the assessment in certificate processing.
create or replace function public.assert_psychologist_report_approved(p_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  reviewer record;
  signature_hash text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Solo el servicio de certificados puede ejecutar esta validación';
  end if;

  select i.id, i.status, i.reviewer_comment, i.reviewed_by, i.reviewed_at
    into rec
    from private.psych_ai_interpretations i
   where i.assessment_id = p_assessment_id
     and i.status = 'VALIDATED'
   order by i.reviewed_at desc nulls last, i.created_at desc
   limit 1;

  if rec.id is null or nullif(trim(coalesce(rec.reviewer_comment, '')), '') is null then
    raise exception 'El informe requiere comentarios y validación de Psicólogo antes de generar el PDF';
  end if;

  select p.id, coalesce(nullif(trim(p.full_name), ''), p.email) as full_name,
         e.document_number, p.job_title
    into reviewer
    from public.profiles p
    left join public.employees_active_current e on lower(e.email) = lower(p.email)
   where p.id = rec.reviewed_by
     and p.status = 'active'
     and lower(coalesce(p.job_title, '')) like '%psic%'
   limit 1;

  if reviewer.id is null or nullif(trim(coalesce(reviewer.document_number, '')), '') is null then
    raise exception 'El psicólogo aprobador no tiene RUN vigente en la ficha ERP';
  end if;

  signature_hash := encode(
    extensions.digest(
      concat_ws('|', p_assessment_id::text, reviewer.id::text, rec.reviewed_at::text, rec.reviewer_comment),
      'sha256'
    ),
    'hex'
  );

  return jsonb_build_object(
    'interpretation_id', rec.id,
    'reviewer_id', reviewer.id,
    'reviewer_name', reviewer.full_name,
    'reviewer_document_number', reviewer.document_number,
    'reviewer_role', coalesce(nullif(trim(reviewer.job_title), ''), 'Psicólogo/a responsable'),
    'reviewer_comment', rec.reviewer_comment,
    'reviewed_at', rec.reviewed_at,
    'signature_hash', signature_hash
  );
end;
$$;

revoke all on function public.assert_psychologist_report_approved(uuid) from public, anon, authenticated;
grant execute on function public.assert_psychologist_report_approved(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
