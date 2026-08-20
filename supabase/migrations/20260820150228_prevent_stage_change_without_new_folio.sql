begin;

create or replace function public.prevent_stage_change_without_new_folio()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  current_case_status text;
begin
  if new.stage_code is distinct from old.stage_code then
    select rc.status
      into current_case_status
      from public.recruitment_cases rc
     where rc.id = new.recruitment_case_id;

    if current_case_status in ('filled', 'closed_unfilled') then
      raise exception 'El candidato debe asignarse a un folio nuevo antes de moverlo de etapa';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_prevent_stage_change_without_new_folio
  on public.recruitment_case_candidates;

create trigger trg_prevent_stage_change_without_new_folio
before update of stage_code on public.recruitment_case_candidates
for each row
execute function public.prevent_stage_change_without_new_folio();

notify pgrst, 'reload schema';
commit;
