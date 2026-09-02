begin;

do $guard$
declare
  matched_count integer;
begin
  select count(*)
    into matched_count
    from public.recruitment_precandidates rp
   where rp.id = 'a7eb1855-20b4-4262-bc19-cf765c41a2ed'
     and rp.national_id = '104622135'
     and rp.phone = '+56944062808'
     and rp.personal_email = 'mariopenarivera2020@gmail.com'
     and rp.first_name = 'Mario Antonio'
     and rp.last_name = 'Pena'
     and rp.second_last_name = 'Rivera'
     and rp.full_name = 'Mario Antonio Pena Rivera'
     and rp.status = 'pending'
     and rp.approved_recruitment_case_id is null
     and rp.approved_case_candidate_id is null;

  if matched_count <> 1 then
    raise exception 'Guard de correccion DSAL: no se encontro exactamente el registro pendiente esperado';
  end if;
end;
$guard$;

update public.recruitment_precandidates
   set last_name = 'Peña',
       full_name = 'Mario Antonio Peña Rivera',
       updated_at = timezone('utc', now())
 where id = 'a7eb1855-20b4-4262-bc19-cf765c41a2ed'
   and national_id = '104622135'
   and last_name = 'Pena'
   and full_name = 'Mario Antonio Pena Rivera'
   and status = 'pending';

do $verify$
declare
  corrected_count integer;
begin
  select count(*)
    into corrected_count
    from public.recruitment_precandidates rp
   where rp.id = 'a7eb1855-20b4-4262-bc19-cf765c41a2ed'
     and rp.national_id = '104622135'
     and rp.first_name = 'Mario Antonio'
     and rp.last_name = 'Peña'
     and rp.second_last_name = 'Rivera'
     and rp.full_name = 'Mario Antonio Peña Rivera'
     and rp.status = 'pending'
     and rp.approved_recruitment_case_id is null
     and rp.approved_case_candidate_id is null;

  if corrected_count <> 1 then
    raise exception 'Verificacion de correccion DSAL fallida para RUT 104622135';
  end if;
end;
$verify$;

commit;
