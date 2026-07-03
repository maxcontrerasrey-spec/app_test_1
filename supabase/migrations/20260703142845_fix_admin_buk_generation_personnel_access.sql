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
        'document_type', cd.document_type,
        'file_name', cd.file_name,
        'file_path', cd.file_path,
        'file_size', cd.file_size,
        'mime_type', cd.mime_type,
        'uploaded_at', cd.uploaded_at,
        'expires_at', cd.expires_at
      )
      order by cd.uploaded_at asc, cd.id asc
    )
    from public.candidate_documents cd
    where cd.recruitment_case_candidate_id = candidate_record.id
      and cd.is_active = true
      and cd.review_status = 'approved'
  ), '[]'::jsonb);

  return jsonb_build_object(
    'candidate', jsonb_build_object(
      'case_candidate_id', candidate_record.id,
      'recruitment_case_id', candidate_record.recruitment_case_id,
      'candidate_profile_id', candidate_record.candidate_profile_id,
      'stage_code', candidate_record.stage_code,
      'case_code', case_record.case_code,
      'contract_name', case_record.contract_name,
      'job_position_name', case_record.job_position_name
    ),
    'person_profile', jsonb_build_object(
      'document_type', profile_record.document_type,
      'document_number', profile_record.national_id,
      'first_name', profile_record.first_name,
      'last_name', profile_record.last_name,
      'second_last_name', profile_record.second_last_name,
      'gender', profile_record.gender,
      'birth_date', profile_record.birth_date,
      'nationality', profile_record.nationality,
      'marital_status', profile_record.marital_status,
      'email', profile_record.email,
      'personal_email', profile_record.personal_email,
      'phone', profile_record.phone,
      'office_phone', profile_record.office_phone,
      'country', profile_record.country,
      'address_line', profile_record.address_line,
      'region', profile_record.region,
      'district_or_commune', profile_record.district_or_commune,
      'current_city', profile_record.current_city,
      'street_name', profile_record.street_name,
      'street_number', profile_record.street_number,
      'apartment_or_office', profile_record.apartment_or_office,
      'education_title', profile_record.education_title,
      'education_institution', profile_record.education_institution,
      'emergency_contact_name', profile_record.emergency_contact_name,
      'emergency_contact_phone', profile_record.emergency_contact_phone,
      'emergency_contact_relationship', profile_record.emergency_contact_relationship,
      'disability_status', profile_record.disability_status,
      'disability_notice_date', profile_record.disability_notice_date,
      'invalidity_status', profile_record.invalidity_status,
      'invalidity_notice_date', profile_record.invalidity_notice_date,
      'inclusion_notes', profile_record.inclusion_notes,
      'labor_inclusion', profile_record.labor_inclusion,
      'firefighter_status', profile_record.firefighter_status,
      'foreign_worker', profile_record.foreign_worker,
      'shirt_size', profile_record.shirt_size,
      'pants_size', profile_record.pants_size,
      'shoe_size', profile_record.shoe_size
    ),
    'worker_file', jsonb_build_object(
      'id', worker_record.id,
      'employee_code', effective_employee_code,
      'project_name', worker_record.project_name,
      'company_entry_date', worker_record.company_entry_date,
      'shift_name', worker_record.shift_name,
      'advance_amount', worker_record.advance_amount,
      'contract_notes', worker_record.contract_notes,
      'private_role', effective_private_role,
      'afc_start_date', coalesce(worker_record.afc_start_date, worker_record.company_entry_date),
      'seniority_recognition_date', coalesce(
        worker_record.seniority_recognition_date,
        worker_record.company_entry_date
      ),
      'progressive_vacation_start_date', coalesce(
        worker_record.progressive_vacation_start_date,
        worker_record.company_entry_date
      ),
      'payment_method', worker_record.payment_method,
      'payment_period', worker_record.payment_period,
      'bank_name', worker_record.bank_name,
      'bank_account_type', worker_record.bank_account_type,
      'bank_account_number', worker_record.bank_account_number,
      'bank_branch_code', worker_record.bank_branch_code,
      'vale_vista_type', case
        when translate(lower(trim(coalesce(worker_record.payment_method, ''))), 'áéíóú', 'aeiou') =
          'vale vista' then worker_record.vale_vista_type
        else null
      end,
      'pension_regime', worker_record.pension_regime,
      'contribution_fund', worker_record.contribution_fund,
      'afp_collection_entity', coalesce(
        worker_record.afp_collection_entity,
        case
          when translate(lower(trim(coalesce(worker_record.pension_regime, ''))), 'áéíóú', 'aeiou') =
            'afp' then worker_record.contribution_fund
          else null
        end
      ),
      'increase_quote_one_percent', effective_increase_quote_one_percent,
      'health_provider', worker_record.health_provider,
      'health_plan_uf', effective_health_plan_uf,
      'health_plan_pesos', null,
      'health_plan_percentage', effective_health_plan_percentage,
      'afc_regime', effective_afc_regime,
      'retired_status', worker_record.retired_status,
      'retirement_regime', effective_retirement_regime,
      'account_two_fund', worker_record.account_two_fund,
      'account_two_plan', worker_record.account_two_plan,
      'currency', worker_record.currency,
      'simple_load_count', worker_record.simple_load_count,
      'maternal_load_count', worker_record.maternal_load_count,
      'invalid_load_count', worker_record.invalid_load_count,
      'family_allowance_section', worker_record.family_allowance_section,
      'personal_data_update_date', worker_record.personal_data_update_date
    ),
    'documents', documents_payload
  );
end;
$function$;

create or replace function public.get_recruitment_case_detail(
  p_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  case_payload jsonb;
  assignments_payload jsonb := '[]'::jsonb;
  candidates_payload jsonb := '[]'::jsonb;
  audit_payload jsonb := '[]'::jsonb;
  has_summary_access boolean := false;
  has_candidate_control_access boolean := false;
  has_personnel_access boolean := false;
  has_full_access boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  has_summary_access := public.user_can_view_recruitment_process_summary(current_user_id, p_case_id);
  has_candidate_control_access :=
    public.user_can_access_candidate_control(current_user_id)
    and public.user_can_view_recruitment_case(current_user_id, p_case_id);

  select exists (
    select 1
    from public.recruitment_case_candidates rcc
    where rcc.recruitment_case_id = p_case_id
      and public.user_can_manage_recruitment_personnel_candidate(current_user_id, rcc.id)
  )
    into has_personnel_access;

  if not (has_summary_access or has_candidate_control_access or has_personnel_access) then
    raise exception 'Sin permisos para ver este proceso de contratación';
  end if;

  has_full_access := has_candidate_control_access or has_personnel_access;

  select jsonb_build_object(
    'id', rc.id,
    'case_code', rc.case_code,
    'status', rc.status,
    'requested_vacancies', rc.requested_vacancies,
    'filled_vacancies', rc.filled_vacancies,
    'title', rc.title,
    'contract_name', rc.contract_name,
    'job_position_name', rc.job_position_name,
    'cost_center_code', rc.cost_center_code,
    'cost_center_name', rc.cost_center_name,
    'requested_entry_date', rc.requested_entry_date,
    'target_close_date', rc.target_close_date,
    'opened_at', rc.opened_at,
    'close_reason', rc.close_reason,
    'hiring_request', jsonb_build_object(
      'id', hr.id,
      'folio', hr.folio,
      'requester_name', hr.requester_name,
      'requester_email', hr.requester_email,
      'start_date', hr.start_date,
      'end_date', hr.end_date,
      'shift_name', hr.shift_name,
      'salary_offer', hr.salary_offer,
      'campamento', hr.campamento,
      'pasajes', hr.pasajes,
      'travel_methodology', hr.travel_methodology,
      'other_benefits', hr.other_benefits,
      'approval_summary', case
        when latest_approval.id is null then null
        else jsonb_build_object(
          'step_name', latest_approval.step_name,
          'status', latest_approval.status,
          'decision_comment', latest_approval.decision_comment,
          'decided_at', latest_approval.decided_at,
          'decided_by_name', latest_approval.decided_by_name
        )
      end
    )
  )
  into case_payload
  from public.recruitment_cases rc
  join public.hiring_requests hr
    on hr.id = rc.hiring_request_id
  left join lateral (
    select
      hra.id,
      hra.step_name,
      hra.status,
      hra.decision_comment,
      hra.decided_at,
      decision_profile.full_name as decided_by_name
    from public.hiring_request_approvals hra
    left join public.profiles decision_profile
      on decision_profile.id = hra.decision_by
    where hra.hiring_request_id = hr.id
      and hra.status in ('approved', 'rejected')
    order by
      case
        when hr.status = 'approved' and hra.status = 'approved' then 0
        when hr.status = 'approved' then 1
        else 0
      end asc,
      coalesce(hra.decided_at, hra.updated_at, hra.created_at) desc,
      hra.id desc
    limit 1
  ) latest_approval on true
  where rc.id = p_case_id;

  if case_payload is null then
    raise exception 'Caso no encontrado';
  end if;

  if has_full_access then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', rca.id,
          'user_id', rca.user_id,
          'assignment_role', rca.assignment_role,
          'is_primary', rca.is_primary,
          'assigned_at', rca.assigned_at,
          'full_name', p.full_name,
          'email', p.email
        )
        order by rca.is_primary desc, rca.id asc
      ),
      '[]'::jsonb
    )
    into assignments_payload
    from public.recruitment_case_assignments rca
    join public.profiles p
      on p.id = rca.user_id
    where rca.recruitment_case_id = p_case_id;

    select coalesce(
      jsonb_agg(candidate_row.payload order by candidate_row.sort_created_at asc),
      '[]'::jsonb
    )
    into candidates_payload
    from (
      select
        jsonb_build_object(
          'id', rcc.id,
          'candidate_profile_id', cp.id,
          'national_id', cp.national_id,
          'full_name', cp.full_name,
          'email', cp.email,
          'phone', cp.phone,
          'birth_date', cp.birth_date,
          'nationality', cp.nationality,
          'marital_status', cp.marital_status,
          'address_line', cp.address_line,
          'district_or_commune', cp.district_or_commune,
          'current_city', cp.current_city,
          'region', cp.region,
          'emergency_contact_name', cp.emergency_contact_name,
          'emergency_contact_phone', cp.emergency_contact_phone,
          'emergency_contact_relationship', cp.emergency_contact_relationship,
          'inclusion_notes', cp.inclusion_notes,
          'firefighter_status', cp.firefighter_status,
          'shirt_size', cp.shirt_size,
          'pants_size', cp.pants_size,
          'shoe_size', cp.shoe_size,
          'bank_name', cp.bank_name,
          'bank_account_type', cp.bank_account_type,
          'bank_account_number', cp.bank_account_number,
          'afp_name', cp.afp_name,
          'health_provider', cp.health_provider,
          'driver_license_number', cp.driver_license_number,
          'driver_license_class', cp.driver_license_class,
          'driver_license_expiry', cp.driver_license_expiry,
          'stage_code', rcc.stage_code,
          'stage_entered_at', rcc.stage_entered_at,
          'suitability_status', rcc.suitability_status,
          'is_selected', rcc.is_selected,
          'hired_at', rcc.hired_at,
          'created_at', rcc.created_at,
          'interview_notes', rcc.interview_notes,
          'document_validation_status', rcc.document_validation_status,
          'document_validated_by', rcc.document_validated_by,
          'document_validated_by_name', validation_profile.full_name,
          'document_validated_at', rcc.document_validated_at,
          'document_validation_comment', rcc.document_validation_comment,
          'worker_file', (
            select case
              when cwf.id is null then null
              else jsonb_build_object(
                'id', cwf.id,
                'project_name', cwf.project_name,
                'company_entry_date', cwf.company_entry_date,
                'shift_name', cwf.shift_name,
                'advance_amount', cwf.advance_amount,
                'contract_notes', cwf.contract_notes,
                'created_at', cwf.created_at,
                'updated_at', cwf.updated_at
              )
            end
            from public.candidate_worker_files cwf
            where cwf.recruitment_case_candidate_id = rcc.id
            limit 1
          ),
          'who_approval', (
            select jsonb_build_object(
              'id', csa.id,
              'status', csa.status,
              'requested_by', csa.requested_by,
              'requested_by_name', requested_profile.full_name,
              'requested_at', csa.requested_at,
              'approved_by', csa.approved_by,
              'approved_by_name', approved_profile.full_name,
              'approved_at', csa.approved_at,
              'comment', csa.comment,
              'causes', csa.causes
            )
            from public.candidate_stage_approvals csa
            left join public.profiles requested_profile
              on requested_profile.id = csa.requested_by
            left join public.profiles approved_profile
              on approved_profile.id = csa.approved_by
            where csa.recruitment_case_candidate_id = rcc.id
              and csa.stage_code = 'who_pending'
            order by coalesce(csa.approved_at, csa.requested_at) desc, csa.id desc
            limit 1
          ),
          'stage_history', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', sh.id,
                'from_stage', sh.from_stage,
                'to_stage', sh.to_stage,
                'changed_by', sh.changed_by,
                'reason_code', sh.reason_code,
                'comment', sh.comment,
                'created_at', sh.created_at
              )
              order by sh.created_at desc
            )
            from public.recruitment_case_candidate_stage_history sh
            where sh.recruitment_case_candidate_id = rcc.id
          ), '[]'::jsonb)
        ) as payload,
        rcc.created_at as sort_created_at
      from public.recruitment_case_candidates rcc
      join public.candidate_profiles cp
        on cp.id = rcc.candidate_profile_id
      left join public.profiles validation_profile
        on validation_profile.id = rcc.document_validated_by
      where rcc.recruitment_case_id = p_case_id
        and (
          has_candidate_control_access
          or public.user_can_manage_recruitment_personnel_candidate(current_user_id, rcc.id)
        )
    ) as candidate_row;
  end if;

  if has_candidate_control_access then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', al.id,
          'action_type', al.action_type,
          'actor_user_id', al.actor_user_id,
          'actor_name', actor_profile.full_name,
          'old_values', al.old_values,
          'new_values', al.new_values,
          'metadata', al.metadata,
          'created_at', al.created_at
        )
        order by al.created_at desc
      ),
      '[]'::jsonb
    )
    into audit_payload
    from public.recruitment_case_audit_log al
    left join public.profiles actor_profile
      on actor_profile.id = al.actor_user_id
    where al.recruitment_case_id = p_case_id;
  end if;

  return jsonb_build_object(
    'case', case_payload,
    'assignments', assignments_payload,
    'candidates', candidates_payload,
    'audit', audit_payload
  );
end;
$function$;

notify pgrst, 'reload schema';

commit;
