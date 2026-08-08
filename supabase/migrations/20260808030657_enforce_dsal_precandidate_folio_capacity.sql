create or replace function public.assert_dsal_precandidate_case_capacity(
  p_case_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  case_record public.recruitment_cases%rowtype;
  request_record public.hiring_requests%rowtype;
  case_metrics record;
begin
  if p_case_id is null then
    raise exception 'Debes asociar el precandidato a un folio de contratación antes de aprobarlo';
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = p_case_id
   for update;

  if case_record.id is null then
    raise exception 'No existe el folio de contratación seleccionado';
  end if;

  if case_record.hiring_request_id is null then
    raise exception 'El caso seleccionado no tiene folio de contratación. Solicita a la gerencia respectiva la creación y aprobación del folio antes de convertir este precandidato en candidato';
  end if;

  select *
    into request_record
    from public.hiring_requests hr
   where hr.id = case_record.hiring_request_id;

  if request_record.id is null
     or nullif(trim(coalesce(request_record.folio, '')), '') is null then
    raise exception 'El caso seleccionado no tiene folio de contratación. Solicita a la gerencia respectiva la creación y aprobación del folio antes de convertir este precandidato en candidato';
  end if;

  if case_record.status in ('filled', 'closed_unfilled', 'cancelled') then
    raise exception 'El folio de contratación ya no tiene cupos disponibles';
  end if;

  select *
    into case_metrics
    from public.get_recruitment_case_effective_metrics(p_case_id)
   limit 1;

  if coalesce(case_metrics.available_vacancies, 0) <= 0 then
    raise exception 'El folio de contratación no tiene cupos disponibles para este candidato';
  end if;
end;
$function$;

revoke all on function public.assert_dsal_precandidate_case_capacity(uuid) from public, anon, authenticated;

create or replace function public.approve_recruitment_precandidate(
  p_precandidate_id uuid,
  p_case_id uuid,
  p_review_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  precandidate_record public.recruitment_precandidates%rowtype;
  created_candidate_id uuid;
  created_profile_id uuid;
  normalized_review_comment text := public.normalize_dsal_precandidate_text(p_review_comment);
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into precandidate_record
    from public.recruitment_precandidates rp
   where rp.id = p_precandidate_id
   for update;

  if precandidate_record.id is null then
    raise exception 'No existe el precandidato indicado';
  end if;

  if precandidate_record.status <> 'pending' then
    raise exception 'Solo se pueden aprobar precandidatos pendientes';
  end if;

  perform public.assert_dsal_precandidate_case_capacity(p_case_id);

  select out_case_candidate_id, out_candidate_profile_id
    into created_candidate_id, created_profile_id
    from public.add_candidate_to_recruitment_case(
      p_case_id,
      precandidate_record.national_id,
      precandidate_record.full_name,
      precandidate_record.personal_email,
      precandidate_record.phone
    );

  update public.candidate_profiles cp
     set document_type = 'RUT',
         first_name = precandidate_record.first_name,
         last_name = precandidate_record.last_name,
         second_last_name = precandidate_record.second_last_name,
         full_name = precandidate_record.full_name,
         personal_email = precandidate_record.personal_email,
         phone = precandidate_record.phone,
         address_line = precandidate_record.address_line,
         street_name = precandidate_record.address_line,
         street_number = null,
         region = precandidate_record.region,
         current_city = precandidate_record.current_city,
         country = coalesce(nullif(cp.country, ''), 'Chile'),
         driver_license_class = array_to_string(precandidate_record.driver_license_classes, ', '),
         source = 'dsal_public_preapplication',
         updated_at = timezone('utc', now())
   where cp.id = created_profile_id;

  update public.recruitment_precandidates rp
     set status = 'approved',
         reviewed_at = timezone('utc', now()),
         reviewed_by = current_user_id,
         review_comment = normalized_review_comment,
         approved_recruitment_case_id = p_case_id,
         approved_case_candidate_id = created_candidate_id,
         metadata = coalesce(rp.metadata, '{}'::jsonb) || jsonb_build_object(
           'approved_driver_license_classes', precandidate_record.driver_license_classes,
           'approved_dsal_role', precandidate_record.dsal_role
         )
   where rp.id = precandidate_record.id;

  return jsonb_build_object(
    'case_candidate_id', created_candidate_id,
    'candidate_profile_id', created_profile_id
  );
end;
$function$;

revoke all on function public.approve_recruitment_precandidate(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_recruitment_precandidate(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
