-- EEES-DB-005: approved
-- owner: Human Resources and Recruitment
-- rollback: forward-only; preserve the historical external-hire evidence.
-- Reconcile Gustavo Cortes with the current ERP candidate model so the
-- already-active BUK worker can receive the pending Psycholaboral battery.

begin;

do $migration$
declare
  v_case_id uuid;
  v_actor uuid;
  v_profile_id uuid;
  v_candidate_id uuid;
  v_external_id uuid;
  v_existing_profile_id uuid;
  v_existing_candidate_id uuid;
begin
  select id
    into v_case_id
    from public.recruitment_cases
   where case_code = 'RC-0173'
   for update;

  if v_case_id is null then
    raise exception 'No se encontro RC-0173';
  end if;

  select eh.id
    into v_external_id
    from public.recruitment_case_external_hires eh
   where eh.recruitment_case_id = v_case_id
     and eh.employee_buk_employee_id = '43950'
     and upper(regexp_replace(coalesce(eh.employee_document_number, ''), '[^0-9Kk]', '', 'g')) = '156120510'
   for update;

  if v_external_id is null then
    raise exception 'No se encontro la evidencia BUK 43950 de Gustavo Cortes en RC-0173';
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.buk_employee_id = '43950'
      and e.is_active
      and upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9Kk]', '', 'g')) = '156120510'
      and upper(coalesce(e.area_name, '')) like '%CODELCO - DSAL%'
  ) then
    raise exception 'La ficha BUK 43950 no esta activa en CODELCO - DSAL';
  end if;

  select cp.id
    into v_existing_profile_id
    from public.candidate_profiles cp
   where upper(regexp_replace(coalesce(cp.national_id, ''), '[^0-9Kk]', '', 'g')) = '156120510'
   for update;

  if v_existing_profile_id is not null then
    select rcc.id
      into v_existing_candidate_id
      from public.recruitment_case_candidates rcc
     where rcc.recruitment_case_id = v_case_id
       and rcc.candidate_profile_id = v_existing_profile_id
     limit 1
     for update;

    if v_existing_candidate_id is not null then
      raise exception 'Gustavo Cortes ya tiene un candidato ERP en RC-0173; no se crea un duplicado';
    end if;

    raise exception 'Gustavo Cortes ya tiene un perfil ERP fuera de RC-0173; revisar conciliacion antes de continuar';
  end if;

  select rca.user_id
    into v_actor
    from public.recruitment_case_assignments rca
   where rca.recruitment_case_id = v_case_id
     and rca.is_primary
   order by rca.id
   limit 1;

  if v_actor is null then
    raise exception 'RC-0173 no tiene responsable primario para dejar trazabilidad';
  end if;

  insert into public.candidate_profiles (
    national_id,
    full_name,
    email,
    source
  )
  select
    '156120510',
    e.full_name,
    nullif(trim(e.email), ''),
    'buk_external_hire_reconciled'
  from public.employees e
  where e.buk_employee_id = '43950'
    and e.is_active
  returning id into v_profile_id;

  insert into public.recruitment_case_candidates (
    recruitment_case_id,
    candidate_profile_id,
    stage_code,
    stage_entered_at,
    suitability_status,
    is_selected,
    hired_at,
    created_by
  ) values (
    v_case_id,
    v_profile_id,
    'hired',
    timezone('utc', now()),
    'unknown',
    false,
    null,
    v_actor
  )
  returning id into v_candidate_id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  ) values (
    v_candidate_id,
    null,
    'hired',
    v_actor,
    'external_buk_hire_reconciled',
    'Contratacion activa en BUK reconciliada con el ERP para habilitar la evaluacion psicolaboral pendiente.'
  );

  update public.recruitment_case_external_hires
     set recruitment_case_candidate_id = v_candidate_id,
         is_active = true,
         source = 'manual_buk_external_hire_reconciled',
         notes = concat_ws(' ', notes, 'Registro reconciliado con candidato ERP para Psicolaboral.'),
         updated_at = timezone('utc', now())
   where id = v_external_id;

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    new_values,
    metadata
  ) values (
    v_case_id,
    v_candidate_id,
    v_actor,
    'candidate_hired',
    jsonb_build_object('stage_code', 'hired', 'buk_employee_id', '43950'),
    jsonb_build_object(
      'source', 'external_buk_hire_reconciled',
      'reason', 'psycholaboral_pending',
      'employee_document_number', '156120510'
    )
  );

  perform public.sync_recruitment_case_status(v_case_id, v_actor);
end;
$migration$;

notify pgrst, 'reload schema';
commit;
