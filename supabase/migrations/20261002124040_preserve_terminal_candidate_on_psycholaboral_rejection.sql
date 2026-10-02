-- EEES-DB-005: approved
-- owner: Human Resources and Recruitment
-- rollback: forward-only; restore the prior decision behavior in a later migration if required.
-- A psychological rejection is an assessment decision, not a second recruitment
-- transition when the candidate is already terminal (hired/rejected/withdrawn).
-- Active candidates keep the existing atomic recruitment rejection workflow.
begin;

do $migration$
declare
  function_definition text;
  old_declaration constant text := $old$  rejection_comment text;
begin$old$;
  new_declaration constant text := $new$  rejection_comment text;
  candidate_stage text;
  candidate_case_id uuid;
begin$new$;
  old_rejection_block constant text := $old$  if p_decision = 'rejected' then
    rejection_comment := 'Rechazo de evaluación psicolaboral: ' || commentv;
    perform public.advance_recruitment_candidate_stage(
      assessment_record.recruitment_case_candidate_id,
      'rejected',
      rejection_comment
    );
  end if;

  update private.psychometric_assessments$old$;
  new_rejection_block constant text := $new$  select rcc.stage_code, rcc.recruitment_case_id
    into candidate_stage, candidate_case_id
    from public.recruitment_case_candidates rcc
   where rcc.id = assessment_record.recruitment_case_candidate_id
   for update;

  if candidate_case_id is null then
    raise exception 'No existe el candidato asociado a la evaluación';
  end if;

  if p_decision = 'rejected' then
    rejection_comment := 'Rechazo de evaluación psicolaboral: ' || commentv;
    if candidate_stage in ('hired', 'rejected', 'withdrawn') then
      if not public.user_can_manage_recruitment_case(uid, candidate_case_id) then
        raise exception 'Sin permisos para registrar el resultado psicolaboral de este candidato';
      end if;
      -- Preserve recruitment stage/reasons and do not enqueue document cleanup.
    else
      perform public.advance_recruitment_candidate_stage(
        assessment_record.recruitment_case_candidate_id,
        'rejected',
        rejection_comment
      );
    end if;
  end if;

  update private.psychometric_assessments$new$;
  old_audit_fragment constant text := $old$      'source', 'gestion_psicolaboral'
    )$old$;
  new_audit_fragment constant text := $new$      'source', 'gestion_psicolaboral',
      'candidate_stage_before', candidate_stage,
      'candidate_stage_changed', p_decision = 'rejected'
        and candidate_stage not in ('hired', 'rejected', 'withdrawn'),
      'candidate_stage_preserved', p_decision = 'rejected'
        and candidate_stage in ('hired', 'rejected', 'withdrawn')
    )$new$;
  old_page_fragment constant text := $old$      when stage_code='hired' then 'hired'
      when assessment_id is null then 'not_sent'$old$;
  new_page_fragment constant text := $new$      when decision='rejected' then 'rejected'
      when stage_code='hired' then 'hired'
      when assessment_id is null then 'not_sent'$new$;
  old_summary_fragment constant text := $old$      when rcc.stage_code='hired' then 'hired'
      when a.id is null then 'not_sent'$old$;
  new_summary_fragment constant text := $new$      when a.decision='rejected' then 'rejected'
      when rcc.stage_code='hired' then 'hired'
      when a.id is null then 'not_sent'$new$;
  changed integer := 0;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'decide_psycholaboral_assessment'
     and pg_get_function_identity_arguments(p.oid) = 'p_assessment_id uuid, p_decision text, p_comment text';

  if function_definition is null
     or position(old_declaration in function_definition) = 0
     or position(old_rejection_block in function_definition) = 0
     or position(old_audit_fragment in function_definition) = 0 then
    raise exception 'La RPC psicolaboral productiva no coincide con los fragmentos auditados';
  end if;

  function_definition := replace(function_definition, old_declaration, new_declaration);
  function_definition := replace(function_definition, old_rejection_block, new_rejection_block);
  function_definition := replace(function_definition, old_audit_fragment, new_audit_fragment);
  execute function_definition;
  changed := changed + 1;

  for function_definition in
    select pg_get_functiondef(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('get_psycholaboral_candidates_page', 'get_psycholaboral_status_summary')
  loop
    if function_definition like '%get_psycholaboral_candidates_page%' then
      if position(old_page_fragment in function_definition) = 0 then
        raise exception 'No se encontró el fragmento de estado esperado en listado Psicolaboral';
      end if;
      execute replace(function_definition, old_page_fragment, new_page_fragment);
    else
      if position(old_summary_fragment in function_definition) = 0 then
        raise exception 'No se encontró el fragmento de estado esperado en resumen Psicolaboral';
      end if;
      execute replace(function_definition, old_summary_fragment, new_summary_fragment);
    end if;
    changed := changed + 1;
  end loop;

  if changed <> 3 then
    raise exception 'Se esperaban actualizar 3 RPCs psicolaborales y se actualizaron %', changed;
  end if;
end;
$migration$;

revoke all on function public.decide_psycholaboral_assessment(uuid, text, text) from public, anon;
grant execute on function public.decide_psycholaboral_assessment(uuid, text, text) to authenticated;
revoke all on function public.get_psycholaboral_candidates_page(text, text, integer, integer) from public, anon;
grant execute on function public.get_psycholaboral_candidates_page(text, text, integer, integer) to authenticated;
revoke all on function public.get_psycholaboral_status_summary(text) from public, anon;
grant execute on function public.get_psycholaboral_status_summary(text) to authenticated;

notify pgrst, 'reload schema';
commit;
