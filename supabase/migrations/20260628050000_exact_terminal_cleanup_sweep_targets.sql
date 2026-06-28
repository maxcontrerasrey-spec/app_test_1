begin;

create or replace function public.list_terminal_candidate_cleanup_targets(
  p_limit integer default 25,
  p_candidate_ids uuid[] default null
)
returns table (
  id uuid,
  recruitment_case_id uuid,
  candidate_profile_id uuid,
  stage_code text,
  created_by uuid
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 25), 250));
begin
  return query
  select
    rcc.id,
    rcc.recruitment_case_id,
    rcc.candidate_profile_id,
    rcc.stage_code,
    rcc.created_by
  from public.recruitment_case_candidates rcc
  where rcc.stage_code in ('rejected', 'withdrawn')
    and (
      p_candidate_ids is null
      or rcc.id = any (p_candidate_ids)
    )
    and exists (
      select 1
      from public.candidate_documents cd
      where cd.recruitment_case_id = rcc.recruitment_case_id
        and cd.candidate_profile_id = rcc.candidate_profile_id
    )
    and not exists (
      select 1
      from public.candidate_document_cleanup_jobs cdcj
      where cdcj.recruitment_case_candidate_id = rcc.id
        and cdcj.status in ('pending', 'processing', 'error')
    )
  order by coalesce(rcc.stage_entered_at, rcc.updated_at, rcc.created_at) asc, rcc.id asc
  limit normalized_limit;
end;
$function$;

revoke all on function public.list_terminal_candidate_cleanup_targets(integer, uuid[]) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
