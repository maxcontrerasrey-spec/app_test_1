begin;

do $guard$
declare
  matched_count integer;
begin
  select count(*)
    into matched_count
    from public.recruitment_precandidates rp
   where rp.national_id = '89220025'
     and rp.full_name = 'Raul Jaime Alvarez Troillet'
     and rp.status = 'pending'
     and rp.source_code = 'dsal_public'
     and rp.approved_case_candidate_id is null;

  if matched_count <> 1 then
    raise exception 'Guard de correccion DSAL: no se encontro exactamente el precandidato pendiente esperado para RUT 89220025';
  end if;
end;
$guard$;

update public.recruitment_precandidates
   set first_name = 'Raúl Jaime',
       last_name = 'Álvarez',
       second_last_name = 'Troillet',
       full_name = 'Raúl Jaime Álvarez Troillet',
       updated_at = timezone('utc', now())
 where national_id = '89220025'
   and full_name = 'Raul Jaime Alvarez Troillet'
   and status = 'pending'
   and source_code = 'dsal_public'
   and approved_case_candidate_id is null;

do $verify$
declare
  corrected_count integer;
begin
  select count(*)
    into corrected_count
    from public.recruitment_precandidates rp
   where rp.national_id = '89220025'
     and rp.full_name = 'Raúl Jaime Álvarez Troillet'
     and rp.first_name = 'Raúl Jaime'
     and rp.last_name = 'Álvarez'
     and rp.second_last_name = 'Troillet';

  if corrected_count <> 1 then
    raise exception 'Verificacion de correccion DSAL fallida para RUT 89220025';
  end if;
end;
$verify$;

commit;
