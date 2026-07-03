begin;

create or replace function public.get_candidate_buk_sync_payload(
  p_case_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
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
  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  select nullif(trim(coalesce(bsj.buk_employee_id, '')), '')
    into successful_buk_employee_id
    from public.buk_sync_jobs bsj
   where bsj.recruitment_case_candidate_id = candidate_record.id
     and bsj.status = 'success'
     and nullif(trim(coalesce(bsj.buk_employee_id, '')), '') is not null
   order by coalesce(bsj.finished_at, bsj.created_at) desc, bsj.id desc
   limit 1;

  if candidate_record.stage_code not in ('ready_for_hire', 'hired')
     or successful_buk_employee_id is not null then
    raise exception 'El candidato debe seguir pendiente de generación efectiva en BUK antes de generar';
  end if;

  if candidate_record.document_validation_status <> 'approved' then
    raise exception 'La documentación del candidato debe estar aprobada para generar en BUK';
  end if;

  select *
    into case_record
    from public.recruitment_cases rc
   where rc.id = candidate_record.recruitment_case_id;

  select *
    into profile_record
    from public.candidate_profiles cp
   where cp.id = candidate_record.candidate_profile_id;

  select *
    into worker_record
    from public.candidate_worker_files cwf
   where cwf.recruitment_case_candidate_id = candidate_record.id;

  effective_employee_code := coalesce(
    nullif(trim(coalesce(worker_record.employee_code, '')), ''),
    public.resolve_candidate_worker_employee_code(candidate_record.id)
  );
  effective_private_role := coalesce(
    nullif(trim(coalesce(worker_record.private_role, '')), ''),
    'No'
  );
  effective_increase_quote_one_percent := coalesce(
    nullif(trim(coalesce(worker_record.increase_quote_one_percent, '')), ''),
    'No'
  );
  effective_afc_regime := coalesce(
    nullif(trim(coalesce(worker_record.afc_regime, '')), ''),
    'Menos de 11 Años'
  );
  effective_retirement_regime := case
    when public.is_affirmative_buk_value(worker_record.retired_status)
      then nullif(trim(coalesce(worker_record.retirement_regime, '')), '')
    else null
  end;
  health_plan_required := public.worker_health_provider_requires_plan(worker_record.health_provider);
  effective_health_plan_uf := public.resolve_candidate_buk_health_plan_uf(
    worker_record.health_provider,
    worker_record.health_plan_uf
  );
  effective_health_plan_percentage := public.resolve_candidate_buk_health_plan_percentage(
    worker_record.health_provider,
    worker_record.health_plan_percentage
  );

  if nullif(trim(coalesce(profile_record.document_type, '')), '') is null
     or nullif(trim(coalesce(profile_record.national_id, '')), '') is null
     or nullif(trim(coalesce(profile_record.first_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.last_name, '')), '') is null
     or nullif(trim(coalesce(profile_record.gender, '')), '') is null
     or nullif(trim(coalesce(profile_record.nationality, '')), '') is null
     or profile_record.birth_date is null
     or nullif(trim(coalesce(profile_record.marital_status, '')), '') is null
     or nullif(trim(coalesce(profile_record.personal_email, '')), '') is null
     or nullif(trim(coalesce(profile_record.address_line, '')), '') is null
     or nullif(trim(coalesce(profile_record.region, '')), '') is null
     or nullif(trim(coalesce(profile_record.district_or_commune, '')), '') is null then
    raise exception 'La ficha personal BUK del candidato aún está incompleta';
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
     or (
       public.is_affirmative_buk_value(worker_record.retired_status)
       and effective_retirement_regime is null
     )
     or (
       health_plan_required
       and effective_health_plan_uf is null
     ) then
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
      )
      order by dt.name asc
    )
    from public.candidate_documents cd
    join public.document_types dt
      on dt.id = cd.document_type_id
    where cd.recruitment_case_id = candidate_record.recruitment_case_id
      and cd.candidate_profile_id = candidate_record.candidate_profile_id
      and cd.status = 'approved'
      and cd.file_path is not null
  ), '[]'::jsonb);

  return jsonb_build_object(
    'candidate',
    jsonb_build_object(
      'case_candidate_id', candidate_record.id,
      'recruitment_case_id', candidate_record.recruitment_case_id,
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'stage_code', candidate_record.stage_code,
      'document_validation_status', candidate_record.document_validation_status,
      'hired_at', candidate_record.hired_at
    ),
    'case',
    jsonb_build_object(
      'id', case_record.id,
      'case_code', case_record.case_code,
      'contract_name', case_record.contract_name,
      'job_position_name', case_record.job_position_name,
      'requested_entry_date', case_record.requested_entry_date
    ),
    'profile',
    public.get_candidate_buk_profile(candidate_record.id),
    'documents',
    documents_payload
  );
end;
$function$;

notify pgrst, 'reload schema';

commit;
