begin;

alter table public.recruitment_case_candidates
  add column if not exists released_without_folio_at timestamptz,
  add column if not exists released_without_folio_by uuid,
  add column if not exists released_without_folio_reason text;

create or replace function public.release_active_candidates_without_folio(
  p_case_id uuid,
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  released_count integer := 0;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  if not public.user_can_manage_recruitment_case(current_user_id, p_case_id) then
    raise exception 'Sin permisos para liberar candidatos de este folio';
  end if;

  with released as (
    update public.recruitment_case_candidates rcc
       set released_without_folio_at = timezone('utc', now()),
           released_without_folio_by = current_user_id,
           released_without_folio_reason = normalized_comment,
           updated_at = timezone('utc', now())
     where rcc.recruitment_case_id = p_case_id
       and rcc.stage_code not in ('hired', 'rejected', 'withdrawn')
       and rcc.released_without_folio_at is null
    returning rcc.id
  )
  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    metadata
  )
  select
    p_case_id,
    released.id,
    current_user_id,
    'candidate_released_without_folio',
    jsonb_build_object('comment', normalized_comment)
  from released;

  get diagnostics released_count = row_count;
  return released_count;
end;
$function$;

revoke all on function public.release_active_candidates_without_folio(uuid, text) from public, anon;
grant execute on function public.release_active_candidates_without_folio(uuid, text) to authenticated;

create or replace function public.reset_released_without_folio_on_transfer()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.recruitment_case_id is distinct from old.recruitment_case_id then
    new.released_without_folio_at := null;
    new.released_without_folio_by := null;
    new.released_without_folio_reason := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_reset_released_without_folio_on_transfer
  on public.recruitment_case_candidates;
create trigger trg_reset_released_without_folio_on_transfer
before update of recruitment_case_id on public.recruitment_case_candidates
for each row
execute function public.reset_released_without_folio_on_transfer();

do $migration$
declare
  function_definition text;
  patched_definition text;
begin
  select pg_get_functiondef('public.get_recruitment_candidates_page(text,text,integer,integer)'::regprocedure)
    into function_definition;

  patched_definition := replace(function_definition,
    '      rcc.stage_code,' || chr(10) || '      public.normalize_recruitment_search_text(',
    '      rcc.stage_code,' || chr(10) || '      rcc.released_without_folio_at is not null as is_without_folio,' || chr(10) || '      public.normalize_recruitment_search_text('
  );
  patched_definition := replace(patched_definition,
    '''case_status'', rc.status,' || chr(10) || '        ''national_id'', cp.national_id,',
    '''case_status'', rc.status,' || chr(10) || '        ''is_without_folio'', rcc.released_without_folio_at is not null,' || chr(10) || '        ''national_id'', cp.national_id,'
  );
  patched_definition := replace(patched_definition,
    '            and candidate_row.case_status not in (''filled'', ''closed_unfilled'', ''cancelled'')' || chr(10) || '            and candidate_row.stage_code not in (''hired'', ''rejected'', ''withdrawn'')',
    '            and candidate_row.case_status not in (''filled'', ''closed_unfilled'', ''cancelled'')' || chr(10) || '            and not candidate_row.is_without_folio' || chr(10) || '            and candidate_row.stage_code not in (''hired'', ''rejected'', ''withdrawn'')'
  );
  patched_definition := replace(patched_definition,
    '            normalized_stage_filter = ''without_folio''' || chr(10) || '            and candidate_row.case_status in (''filled'', ''closed_unfilled'')',
    '            normalized_stage_filter = ''without_folio''' || chr(10) || '            and (candidate_row.is_without_folio or candidate_row.case_status in (''filled'', ''closed_unfilled''))'
  );

  if patched_definition = function_definition or patched_definition not like '%is_without_folio%' then
    raise exception 'No se pudo ajustar get_recruitment_candidates_page para liberar candidatos sin folio';
  end if;
  execute patched_definition;

  select pg_get_functiondef('public.close_hiring_request(uuid,text)'::regprocedure)
    into function_definition;
  patched_definition := replace(function_definition,
    '       and rcc.stage_code not in (''hired'', ''rejected'', ''withdrawn'')',
    '       and rcc.stage_code not in (''hired'', ''rejected'', ''withdrawn'')' || chr(10) || '       and rcc.released_without_folio_at is null'
  );

  if patched_definition = function_definition or patched_definition not like '%released_without_folio_at is null%' then
    raise exception 'No se pudo ajustar close_hiring_request para candidatos liberados sin folio';
  end if;
  execute patched_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
