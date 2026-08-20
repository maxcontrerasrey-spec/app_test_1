begin;

do $guard$
declare
  expected_count integer := 4;
  actual_count integer;
begin
  select count(*)
    into actual_count
    from public.recruitment_precandidates rp
    join public.recruitment_case_candidates rcc
      on rcc.id = rp.approved_case_candidate_id
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
   where rp.national_id in ('138805336', '104066321', '121824396', '126112157')
     and rp.status = 'approved'
     and rcc.recruitment_case_id = (select id from public.recruitment_cases where case_code = 'RC-0132')
     and cp.source = 'dsal_public_preapplication';

  if actual_count <> expected_count then
    raise exception 'Guard de acentos DSAL: se esperaban % candidatos en RC-0132 y se encontraron %', expected_count, actual_count;
  end if;
end;
$guard$;

update public.recruitment_precandidates rp
   set first_name = values.first_name,
       last_name = values.last_name,
       second_last_name = values.second_last_name,
       full_name = values.full_name,
       updated_at = timezone('utc', now())
  from (values
    ('138805336', 'Elvis Alex', 'Poulin', 'Guerrero', 'Elvis Alex Poulin Guerrero'),
    ('104066321', 'Patricio Ricardo', 'Paredes', 'Vielma', 'Patricio Ricardo Paredes Vielma'),
    ('121824396', 'Nelson Gabriel', 'López', 'Flores', 'Nelson Gabriel López Flores'),
    ('126112157', 'Fabián Alexander', 'Solís', 'Halles', 'Fabián Alexander Solís Halles')
  ) as values(national_id, first_name, last_name, second_last_name, full_name)
 where rp.national_id = values.national_id;

update public.candidate_profiles cp
   set first_name = values.first_name,
       last_name = values.last_name,
       second_last_name = values.second_last_name,
       full_name = values.full_name,
       updated_at = timezone('utc', now())
  from (values
    ('138805336', 'Elvis Alex', 'Poulin', 'Guerrero', 'Elvis Alex Poulin Guerrero'),
    ('104066321', 'Patricio Ricardo', 'Paredes', 'Vielma', 'Patricio Ricardo Paredes Vielma'),
    ('121824396', 'Nelson Gabriel', 'López', 'Flores', 'Nelson Gabriel López Flores'),
    ('126112157', 'Fabián Alexander', 'Solís', 'Halles', 'Fabián Alexander Solís Halles')
  ) as values(national_id, first_name, last_name, second_last_name, full_name)
 where cp.national_id = values.national_id
   and cp.source = 'dsal_public_preapplication';

do $verify$
declare
  expected_count integer := 4;
  actual_count integer;
begin
  select count(*)
    into actual_count
    from public.recruitment_precandidates rp
    join public.recruitment_case_candidates rcc
      on rcc.id = rp.approved_case_candidate_id
    join public.candidate_profiles cp
      on cp.id = rcc.candidate_profile_id
   where rp.national_id in ('138805336', '104066321', '121824396', '126112157')
     and rp.full_name in (
       'Elvis Alex Poulin Guerrero',
       'Patricio Ricardo Paredes Vielma',
       'Nelson Gabriel López Flores',
       'Fabián Alexander Solís Halles'
     )
     and cp.full_name = rp.full_name
     and cp.source = 'dsal_public_preapplication';

  if actual_count <> expected_count then
    raise exception 'Verificación de acentos DSAL fallida: % de % nombres corregidos', actual_count, expected_count;
  end if;
end;
$verify$;

commit;
