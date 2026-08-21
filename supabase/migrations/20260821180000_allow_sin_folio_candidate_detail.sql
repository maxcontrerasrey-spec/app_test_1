begin;

do $migration$
declare
  v_source text;
  v_patched text;
  v_signature text := 'CREATE OR REPLACE FUNCTION public.get_recruitment_case_detail(p_case_id uuid)';
  v_new_signature text := $signature$
CREATE OR REPLACE FUNCTION public.get_recruitment_case_detail_for_candidate(
  p_case_id uuid,
  p_case_candidate_id uuid
)$signature$;
  v_old_filter text := $filter$
      where rcc.recruitment_case_id = p_case_id
        and rcc.released_without_folio_at is null
        and (
          has_candidate_control_access$filter$;
  v_new_filter text := $filter$
      where rcc.recruitment_case_id = p_case_id
        and (rcc.released_without_folio_at is null or rcc.id = p_case_candidate_id)
        and (
          has_candidate_control_access$filter$;
begin
  select pg_get_functiondef('public.get_recruitment_case_detail(uuid)'::regprocedure)
    into v_source;

  if position(v_signature in v_source) = 0 then
    raise exception 'No se encontró la firma vigente de get_recruitment_case_detail';
  end if;

  if position(v_old_filter in v_source) = 0 then
    raise exception 'No se encontró el filtro vigente de candidatos liberados';
  end if;

  v_patched := replace(v_source, v_signature, v_new_signature);
  v_patched := replace(v_patched, v_old_filter, v_new_filter);
  execute v_patched;
end;
$migration$;

revoke all on function public.get_recruitment_case_detail_for_candidate(uuid, uuid) from public, anon;
grant execute on function public.get_recruitment_case_detail_for_candidate(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
