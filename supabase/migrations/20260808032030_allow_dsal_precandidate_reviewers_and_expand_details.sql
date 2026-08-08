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

  if upper(coalesce(case_record.contract_name, '')) not like '%DSAL%' then
    raise exception 'El precandidato DSAL solo puede asociarse a un folio del contrato DSAL';
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

drop function if exists public.user_can_review_dsal_precandidates(uuid);
drop function if exists public.assert_dsal_precandidate_review_access(uuid);

create function public.user_can_review_dsal_precandidates(actor_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if actor_id is null or current_user_id is null then
    return false;
  end if;

  if current_user_id <> actor_id and not public.user_is_admin(current_user_id) then
    return false;
  end if;

  return public.user_is_admin(actor_id)
      or public.user_has_capability(actor_id, 'candidate_control_access')
      or public.user_has_role(actor_id, 'reclutamiento')
      or public.user_has_role(actor_id, 'director_op')
      or exists (
        select 1
        from public.cost_center_approvers cca
        join public.recruitment_cases rc
          on rc.cost_center_code = cca.cost_center_code
        where cca.approver_user_id = actor_id
          and cca.is_active = true
          and upper(coalesce(rc.contract_name, '')) like '%DSAL%'
      );
end;
$function$;

create function public.assert_dsal_precandidate_review_access(actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if actor_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_review_dsal_precandidates(actor_id) then
    raise exception 'Sin permisos para revisar precandidatos DSAL';
  end if;
end;
$function$;

revoke all on function public.user_can_review_dsal_precandidates(uuid) from public, anon, authenticated;
revoke all on function public.assert_dsal_precandidate_review_access(uuid) from public, anon, authenticated;

create or replace function public.get_recruitment_precandidates_page(
  p_status text default 'pending',
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_status text := coalesce(nullif(trim(p_status), ''), 'pending');
  normalized_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_dsal_precandidate_review_access(current_user_id);

  if normalized_status not in ('pending', 'approved', 'rejected', 'archived', 'all') then
    raise exception 'Estado de precandidato inválido';
  end if;

  with filtered as (
    select rp.*, approved_hr.folio as approved_folio
      from public.recruitment_precandidates rp
      left join public.recruitment_cases approved_rc
        on approved_rc.id = rp.approved_recruitment_case_id
      left join public.hiring_requests approved_hr
        on approved_hr.id = approved_rc.hiring_request_id
     where (normalized_status = 'all' or rp.status = normalized_status)
       and (
         normalized_search is null
         or lower(rp.full_name) like '%' || normalized_search || '%'
         or lower(rp.national_id) like '%' || normalized_search || '%'
         or lower(rp.personal_email) like '%' || normalized_search || '%'
         or lower(rp.phone) like '%' || normalized_search || '%'
         or lower(rp.dsal_role) like '%' || normalized_search || '%'
       )
  ),
  counted as (
    select count(*)::integer as total_count from filtered
  ),
  page_items as (
    select *
      from filtered
     order by submitted_at desc, created_at desc
     limit safe_limit
     offset safe_offset
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(page_items) order by page_items.submitted_at desc, page_items.created_at desc), '[]'::jsonb),
    'total_count', (select total_count from counted),
    'summary', jsonb_build_object(
      'pending', (select count(*) from public.recruitment_precandidates where status = 'pending'),
      'approved', (select count(*) from public.recruitment_precandidates where status = 'approved'),
      'rejected', (select count(*) from public.recruitment_precandidates where status = 'rejected')
    )
  )
    into payload
    from page_items;

  return coalesce(payload, jsonb_build_object(
    'items', '[]'::jsonb,
    'total_count', 0,
    'summary', jsonb_build_object('pending', 0, 'approved', 0, 'rejected', 0)
  ));
end;
$function$;

create or replace function public.reject_recruitment_precandidate(
  p_precandidate_id uuid,
  p_review_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_review_comment text := public.normalize_dsal_precandidate_text(p_review_comment);
  affected_count integer;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_dsal_precandidate_review_access(current_user_id);

  update public.recruitment_precandidates rp
     set status = 'rejected',
         reviewed_at = timezone('utc', now()),
         reviewed_by = current_user_id,
         review_comment = normalized_review_comment
   where rp.id = p_precandidate_id
     and rp.status = 'pending';

  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    raise exception 'Solo se pueden rechazar precandidatos pendientes';
  end if;
end;
$function$;

-- La aprobacion conserva el guard de folio/cupo de la migracion anterior y cambia solo la autoridad del revisor.
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

  perform public.assert_dsal_precandidate_review_access(current_user_id);

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

revoke all on function public.get_recruitment_precandidates_page(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_recruitment_precandidates_page(text, text, integer, integer) to authenticated;
revoke all on function public.approve_recruitment_precandidate(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_recruitment_precandidate(uuid, uuid, text) to authenticated;
revoke all on function public.reject_recruitment_precandidate(uuid, text) from public, anon, authenticated;
grant execute on function public.reject_recruitment_precandidate(uuid, text) to authenticated;

notify pgrst, 'reload schema';
