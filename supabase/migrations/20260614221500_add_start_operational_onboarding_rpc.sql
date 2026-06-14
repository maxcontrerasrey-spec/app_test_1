begin;

create or replace function public.start_operational_onboarding(
  p_candidate_id uuid,
  p_template_id uuid
)
returns table (case_id uuid)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid;
  template_record public.onboarding_templates%rowtype;
  candidate_record public.candidate_profiles%rowtype;
  created_case_id uuid;
  inserted_tasks_count integer := 0;
  max_sla_hours integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not public.user_can_access_operational_onboarding(current_user_id) then
    raise exception 'Sin permisos para iniciar alta operacional';
  end if;

  if p_candidate_id is null then
    raise exception 'El candidato es obligatorio';
  end if;

  if p_template_id is null then
    raise exception 'La plantilla es obligatoria';
  end if;

  select *
    into template_record
    from public.onboarding_templates ot
   where ot.id = p_template_id
   for update;

  if template_record.id is null then
    raise exception 'No existe la plantilla indicada';
  end if;

  if template_record.is_active is not true then
    raise exception 'La plantilla seleccionada se encuentra inactiva';
  end if;

  select *
    into candidate_record
    from public.candidate_profiles cp
   where cp.id = p_candidate_id;

  if candidate_record.id is null then
    raise exception 'No existe el candidato indicado';
  end if;

  select max(ott.sla_hours)
    into max_sla_hours
    from public.onboarding_template_tasks ott
   where ott.template_id = template_record.id
     and ott.is_active = true;

  insert into public.employee_onboarding_cases (
    candidate_id,
    template_id,
    status,
    cargo,
    contrato,
    faena,
    division,
    centro_costo,
    target_ready_date,
    created_by
  )
  values (
    candidate_record.id,
    template_record.id,
    'in_progress',
    template_record.cargo,
    template_record.contrato,
    template_record.faena,
    template_record.division,
    template_record.centro_costo,
    case
      when max_sla_hours is null then null
      else (timezone('utc', now()) + make_interval(hours => max_sla_hours))::date
    end,
    current_user_id
  )
  returning id into created_case_id;

  insert into public.employee_onboarding_tasks (
    case_id,
    template_task_id,
    area_responsible,
    role_responsible,
    task_name,
    task_description,
    status,
    is_required,
    is_blocking,
    requires_evidence,
    evidence_type,
    due_at,
    order_index
  )
  select
    created_case_id,
    ott.id,
    ott.area_responsible,
    ott.role_responsible,
    ott.task_name,
    ott.task_description,
    'pending',
    ott.is_required,
    ott.is_blocking,
    ott.requires_evidence,
    ott.evidence_type,
    case
      when ott.sla_hours is null then null
      else timezone('utc', now()) + make_interval(hours => ott.sla_hours)
    end,
    ott.order_index
  from public.onboarding_template_tasks ott
  where ott.template_id = template_record.id
    and ott.is_active = true
  order by ott.order_index asc, ott.created_at asc, ott.id asc;

  get diagnostics inserted_tasks_count = row_count;

  if inserted_tasks_count = 0 then
    raise exception 'La plantilla seleccionada no tiene tareas activas para iniciar el caso';
  end if;

  perform public.refresh_employee_onboarding_case_metrics(created_case_id);

  return query
  select created_case_id;
end;
$function$;

revoke all on function public.start_operational_onboarding(uuid, uuid) from public, anon;
grant execute on function public.start_operational_onboarding(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
