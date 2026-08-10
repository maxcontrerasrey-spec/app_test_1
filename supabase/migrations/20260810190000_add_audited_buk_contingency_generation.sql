begin;

-- Contingency generation keeps the normal BUK gates intact and is only for
-- explicitly authorized RRHH operations with a documented reason.
create or replace function public.get_candidate_buk_sync_contingency_payload(
  p_case_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  case_record public.recruitment_cases%rowtype;
  profile_record public.candidate_profiles%rowtype;
  worker_record public.candidate_worker_files%rowtype;
  documents_payload jsonb := '[]'::jsonb;
  effective_employee_code text := null;
  effective_private_role text := null;
  effective_increase_quote_one_percent text := null;
  effective_afc_regime text := null;
  effective_retirement_regime text := null;
  effective_health_plan_uf numeric := null;
  effective_health_plan_percentage numeric := null;
  health_plan_required boolean := false;
  successful_buk_employee_id text := null;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not (
    public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id)
    or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_record.id)
  ) then
    raise exception 'Sin permisos para generar este candidato en BUK';
  end if;

  select nullif(trim(coalesce(bsj.buk_employee_id, '')), '') into successful_buk_employee_id
    from public.buk_sync_jobs bsj
   where bsj.recruitment_case_candidate_id = candidate_record.id
     and public.is_effective_buk_generation_success(bsj.status, bsj.buk_employee_id, bsj.result_snapshot)
   order by coalesce(bsj.finished_at, bsj.created_at) desc, bsj.id desc
   limit 1;

  if candidate_record.stage_code in ('rejected', 'withdrawn', 'hired')
     or successful_buk_employee_id is not null then
    raise exception 'El candidato no puede generarse en BUK por su estado actual';
  end if;

  select * into case_record
    from public.recruitment_cases rc
   where rc.id = candidate_record.recruitment_case_id;

  if not exists (
    select 1
      from public.buk_contract_mappings bcm
     where bcm.contract_id = case_record.contract_id
       and bcm.is_operational = true
       and nullif(trim(coalesce(bcm.buk_area_code, '')), '') is not null
  ) then
    raise exception 'El contrato no tiene una ruta operativa BUK vigente';
  end if;

  select * into profile_record
    from public.candidate_profiles cp
   where cp.id = candidate_record.candidate_profile_id;

  select * into worker_record
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id;

  effective_employee_code := coalesce(
    nullif(trim(coalesce(worker_record.employee_code, '')), ''),
    public.resolve_candidate_worker_employee_code(candidate_record.id)
  );
  effective_private_role := coalesce(nullif(trim(coalesce(worker_record.private_role, '')), ''), 'No');
  effective_increase_quote_one_percent := coalesce(nullif(trim(coalesce(worker_record.increase_quote_one_percent, '')), ''), 'No');
  effective_afc_regime := coalesce(nullif(trim(coalesce(worker_record.afc_regime, '')), ''), 'Menos de 11 Años');
  effective_retirement_regime := case
    when public.is_affirmative_buk_value(worker_record.retired_status)
      then nullif(trim(coalesce(worker_record.retirement_regime, '')), '')
    else null
  end;
  health_plan_required := public.worker_health_provider_requires_plan(worker_record.health_provider);
  effective_health_plan_uf := public.resolve_candidate_buk_health_plan_uf(worker_record.health_provider, worker_record.health_plan_uf);
  effective_health_plan_percentage := public.resolve_candidate_buk_health_plan_percentage(worker_record.health_provider, worker_record.health_plan_percentage);

  -- Personal and contractual fields remain mandatory. The contingency only
  -- relaxes lifecycle/document approval gates, never critical BUK data.
  if nullif(trim(coalesce(profile_record.document_type, '')), '') is null
     or nullif(trim(coalesce(profile_record.national_id, '')), '') is null
     or nullif(trim(coalesce(profile_record.first_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.last_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.gender, '')), '') is null
     or nullif(trim(coalesce(profile_record.nationality, '')), '') is null
     or profile_record.birth_date is null
     or nullif(trim(coalesce(profile_record.marital_status, '')), '') is null
     or public.normalize_candidate_buk_email(profile_record.personal_email) is null
     or nullif(trim(coalesce(profile_record.address_line, '')), '') is null
     or nullif(trim(coalesce(profile_record.region, '')), '') is null
     or nullif(trim(coalesce(profile_record.district_or_commune, '')), '') is null then
    raise exception 'La ficha personal BUK del candidato aún está incompleta o contiene un email inválido';
  end if;

  if worker_record.id is null
     or effective_employee_code is null
     or worker_record.company_entry_date is null
     or effective_private_role is null
     or nullif(trim(coalesce(worker_record.payment_method, '')), '') is null
     or nullif(trim(coalesce(worker_record.payment_period, '')), '') is null
     or nullif(trim(coalesce(worker_record.pension_regime, '')), '') is null
     or effective_increase_quote_one_percent is null
     or nullif(trim(coalesce(worker_record.health_provider, '')), '') is null
     or effective_afc_regime is null
     or (public.is_affirmative_buk_value(worker_record.retired_status) and effective_retirement_regime is null)
     or (health_plan_required and effective_health_plan_uf is null) then
    raise exception 'La ficha contractual BUK del candidato aún está incompleta';
  end if;

  documents_payload := coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', cd.id,
        'document_type_id', cd.document_type_id,
        'document_name', dt.name,
        'file_path', cd.file_path,
        'status', cd.status,
        'expiry_date', cd.expiry_date
      ) order by dt.name asc
    )
    from public.candidate_documents cd
    join public.document_types dt on dt.id = cd.document_type_id
   where cd.recruitment_case_id = candidate_record.recruitment_case_id
     and cd.candidate_profile_id = candidate_record.candidate_profile_id
     and cd.status in ('approved', 'uploaded')
     and cd.file_path is not null
  ), '[]'::jsonb);

  return jsonb_build_object(
    'candidate', jsonb_build_object(
      'case_candidate_id', candidate_record.id,
      'recruitment_case_id', candidate_record.recruitment_case_id,
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'stage_code', candidate_record.stage_code,
      'document_validation_status', candidate_record.document_validation_status,
      'hired_at', candidate_record.hired_at
    ),
    'case', jsonb_build_object(
      'id', case_record.id,
      'case_code', case_record.case_code,
      'contract_name', case_record.contract_name,
      'job_position_name', case_record.job_position_name,
      'requested_entry_date', case_record.requested_entry_date
    ),
    'profile', public.get_candidate_buk_profile(candidate_record.id),
    'documents', documents_payload
  );
end;
$function$;

create or replace function public.enqueue_buk_generation_contingency(
  p_candidate_ids uuid[],
  p_reason text
)
returns table (job_id uuid, recruitment_case_candidate_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_row record;
  existing_job public.buk_sync_jobs%rowtype;
  new_job_id uuid;
  payload_snapshot jsonb;
  capacity_record record;
  batch_reserved_by_case jsonb := '{}'::jsonb;
  batch_reserved_for_case integer := 0;
  remaining_capacity integer := 0;
begin
  if current_user_id is null then raise exception 'Usuario no autenticado'; end if;
  if not public.user_can_generate_buk_candidates(current_user_id) then
    raise exception 'Solo RRHH administrativo puede generar candidatos en BUK';
  end if;
  if not public.user_can_access_recruitment_personnel(current_user_id) then
    raise exception 'Sin permisos para operar Personal a Contratar';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 10 then
    raise exception 'La carga BUK en contingencia exige un motivo de al menos 10 caracteres';
  end if;

  for candidate_row in
    select distinct on (rcc.id) rcc.id, rcc.recruitment_case_id, rcc.stage_code, rc.case_code, input_candidate.input_order
      from unnest(coalesce(p_candidate_ids, '{}'::uuid[])) with ordinality as input_candidate(candidate_id, input_order)
      join public.recruitment_case_candidates rcc on rcc.id = input_candidate.candidate_id
      join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
     order by rcc.id, input_candidate.input_order
  loop
    if not (
      public.user_can_manage_recruitment_case(current_user_id, candidate_row.recruitment_case_id)
      or public.user_can_manage_recruitment_personnel_candidate(current_user_id, candidate_row.id)
    ) then
      raise exception 'Sin permisos para encolar el candidato %', candidate_row.id;
    end if;
    if candidate_row.stage_code in ('rejected', 'withdrawn', 'hired') then
      raise exception 'El candidato % no puede cargarse por contingencia en su estado actual', candidate_row.id;
    end if;

    select * into existing_job from public.buk_sync_jobs bsj
     where bsj.recruitment_case_candidate_id = candidate_row.id
       and bsj.status in ('pending', 'processing')
     order by bsj.created_at desc limit 1 for update;
    if existing_job.id is not null then
      job_id := existing_job.id; recruitment_case_candidate_id := candidate_row.id; status := existing_job.status; return next; continue;
    end if;

    select * into existing_job from public.buk_sync_jobs bsj
     where bsj.recruitment_case_candidate_id = candidate_row.id
       and public.is_effective_buk_generation_success(bsj.status, bsj.buk_employee_id, bsj.result_snapshot)
     order by bsj.created_at desc limit 1;
    if existing_job.id is not null then
      raise exception 'El candidato % ya fue generado previamente en BUK', candidate_row.id;
    end if;

    perform 1 from public.recruitment_cases rc where rc.id = candidate_row.recruitment_case_id for update;
    select * into capacity_record from public.get_recruitment_case_buk_capacity_snapshot(candidate_row.recruitment_case_id, candidate_row.id, true);
    if capacity_record.requested_vacancies is null then
      raise exception 'No existe el caso de reclutamiento asociado al candidato %', candidate_row.id;
    end if;
    batch_reserved_for_case := coalesce((batch_reserved_by_case ->> candidate_row.recruitment_case_id::text)::integer, 0);
    remaining_capacity := capacity_record.available_vacancies - batch_reserved_for_case;
    if remaining_capacity <= 0 then
      raise exception 'No hay cupos disponibles para generar en BUK en el caso %', candidate_row.case_code;
    end if;

    payload_snapshot := public.get_candidate_buk_sync_contingency_payload(candidate_row.id)
      || jsonb_build_object('contingency', jsonb_build_object(
        'reason', trim(p_reason), 'requested_by', current_user_id, 'requested_at', timezone('utc', now())
      ));
    insert into public.buk_sync_jobs (recruitment_case_candidate_id, requested_by, status, payload_snapshot)
    values (candidate_row.id, current_user_id, 'pending', payload_snapshot)
    returning id into new_job_id;

    batch_reserved_by_case := batch_reserved_by_case || jsonb_build_object(candidate_row.recruitment_case_id::text, batch_reserved_for_case + 1);
    job_id := new_job_id; recruitment_case_candidate_id := candidate_row.id; status := 'pending'; return next;
  end loop;
end;
$function$;

revoke all on function public.get_candidate_buk_sync_contingency_payload(uuid) from public, anon, authenticated;
grant execute on function public.get_candidate_buk_sync_contingency_payload(uuid) to service_role;
revoke all on function public.enqueue_buk_generation_contingency(uuid[], text) from public, anon;
grant execute on function public.enqueue_buk_generation_contingency(uuid[], text) to authenticated;

notify pgrst, 'reload schema';
commit;
