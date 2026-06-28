begin;

create or replace function public.trg_reset_candidate_document_validation_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  affected_candidate_id uuid;
begin
  if
    new.document_type is not distinct from old.document_type
    and new.national_id is not distinct from old.national_id
    and new.last_name is not distinct from old.last_name
    and new.first_name is not distinct from old.first_name
    and new.gender is not distinct from old.gender
    and new.nationality is not distinct from old.nationality
    and new.birth_date is not distinct from old.birth_date
    and new.marital_status is not distinct from old.marital_status
    and new.address_line is not distinct from old.address_line
    and new.region is not distinct from old.region
    and new.district_or_commune is not distinct from old.district_or_commune
  then
    return null;
  end if;

  for affected_candidate_id in
    select rcc.id
    from public.recruitment_case_candidates rcc
    where rcc.candidate_profile_id = new.id
  loop
    perform public.reset_candidate_document_validation(
      affected_candidate_id,
      auth.uid(),
      'candidate_profile_changed'
    );
  end loop;

  return null;
end;
$function$;

notify pgrst, 'reload schema';

commit;
