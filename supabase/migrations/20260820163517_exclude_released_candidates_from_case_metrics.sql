-- Los candidatos liberados sin folio permanecen en la historia, pero dejan de
-- pertenecer al caso operativo y no deben inflar sus contadores ni su detalle.

do $$
declare
  v_source text;
  v_old text := $needle$
      count(*) filter (where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')) as active_candidate_count$needle$;
  v_new text := $replacement$
      count(*) filter (
        where rcc.stage_code not in ('rejected', 'withdrawn', 'hired', 'ready_for_hire')
          and rcc.released_without_folio_at is null
      ) as active_candidate_count$replacement$;
begin
  v_source := pg_get_functiondef('public.get_recruitment_case_effective_metrics(uuid)'::regprocedure);
  if position(v_old in v_source) = 0 then
    raise exception 'No se encontró el cálculo activo esperado en get_recruitment_case_effective_metrics';
  end if;
  execute replace(v_source, v_old, v_new);
end;
$$;

do $$
declare
  v_source text;
  v_old text := $needle$
      where rcc.recruitment_case_id = p_case_id
        and (
          has_candidate_control_access$needle$;
  v_new text := $replacement$
      where rcc.recruitment_case_id = p_case_id
        and rcc.released_without_folio_at is null
        and (
          has_candidate_control_access$replacement$;
begin
  v_source := pg_get_functiondef('public.get_recruitment_case_detail(uuid)'::regprocedure);
  if position(v_old in v_source) = 0 then
    raise exception 'No se encontró el filtro de candidatos esperado en get_recruitment_case_detail';
  end if;
  execute replace(v_source, v_old, v_new);
end;
$$;

notify pgrst, 'reload schema';
