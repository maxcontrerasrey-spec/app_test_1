begin;

do $$
declare
  target_profile_id uuid := 'e9dd7fe0-7573-404d-803e-2982cfe5a8fd';
  target_precandidate_id uuid := '7304d47a-97e7-44a2-ab03-db48d215def5';
  target_case_candidate_id uuid := '669cd770-c1b6-47ee-9601-249e99ec64af';
  correct_national_id text := '155731087';
begin
  if exists (
    select 1 from public.candidate_profiles
     where regexp_replace(national_id, '[^0-9kK]', '', 'g') = correct_national_id
       and id <> target_profile_id
  ) then
    raise exception 'El RUT correcto ya pertenece a otro perfil';
  end if;

  if exists (
    select 1 from public.recruitment_precandidates
     where regexp_replace(national_id, '[^0-9kK]', '', 'g') = correct_national_id
       and id <> target_precandidate_id
  ) then
    raise exception 'El RUT correcto ya pertenece a otra precandidatura';
  end if;

  if not exists (
    select 1 from public.candidate_profiles
     where id = target_profile_id
       and full_name = 'William Eric Araya Toro'
       and national_id = '15573108'
  ) then
    raise exception 'El perfil objetivo no coincide con el RUT ingresado esperado';
  end if;

  if not exists (
    select 1 from public.recruitment_precandidates
     where id = target_precandidate_id
       and approved_case_candidate_id = target_case_candidate_id
       and full_name = 'William Eric Araya Toro'
       and national_id = '15573108'
  ) then
    raise exception 'La precandidatura objetivo no coincide con el RUT ingresado esperado';
  end if;

  update public.candidate_profiles
     set national_id = correct_national_id,
         updated_at = timezone('utc', now())
   where id = target_profile_id;

  update public.recruitment_precandidates
     set national_id = correct_national_id,
         updated_at = timezone('utc', now())
   where id = target_precandidate_id;

  if not exists (select 1 from public.candidate_profiles where id = target_profile_id and national_id = correct_national_id)
     or not exists (select 1 from public.recruitment_precandidates where id = target_precandidate_id and national_id = correct_national_id) then
    raise exception 'La correccion de RUT no quedo confirmada';
  end if;
end;
$$;

-- The original migration was applied with the body only. This guarded follow-up
-- stores the verifier too, matching the UI and all RUT-based source records.
do $$
begin
  if not exists (select 1 from public.candidate_profiles where id = 'e9dd7fe0-7573-404d-803e-2982cfe5a8fd' and national_id = '155731087') then
    update public.candidate_profiles set national_id = '155731087', updated_at = timezone('utc', now()) where id = 'e9dd7fe0-7573-404d-803e-2982cfe5a8fd' and national_id = '15573108';
  end if;
  if not exists (select 1 from public.recruitment_precandidates where id = '7304d47a-97e7-44a2-ab03-db48d215def5' and national_id = '155731087') then
    update public.recruitment_precandidates set national_id = '155731087', updated_at = timezone('utc', now()) where id = '7304d47a-97e7-44a2-ab03-db48d215def5' and national_id = '15573108';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
