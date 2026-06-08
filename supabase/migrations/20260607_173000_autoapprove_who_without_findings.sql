begin;

create or replace function public.normalize_candidate_who_causes(
  p_causes jsonb
)
returns jsonb
language plpgsql
stable
set search_path = public
as $function$
declare
  cause_item jsonb;
  normalized jsonb := '[]'::jsonb;
  cause_type text;
  cause_year_text text;
  cause_year integer;
  cause_comment text;
  cause_count integer := 0;
begin
  if p_causes is null or jsonb_typeof(p_causes) <> 'array' then
    raise exception 'Debes informar las causas Who en formato lista';
  end if;

  cause_count := jsonb_array_length(p_causes);

  if cause_count = 0 then
    return '[]'::jsonb;
  end if;

  if cause_count > 4 then
    raise exception 'Solo se permiten hasta 4 causas Who por solicitud';
  end if;

  for cause_item in
    select value
    from jsonb_array_elements(p_causes)
  loop
    cause_type := lower(trim(coalesce(cause_item->>'type', '')));
    cause_year_text := trim(coalesce(cause_item->>'year', ''));
    cause_comment := nullif(trim(coalesce(cause_item->>'comment', '')), '');

    if cause_type not in ('laboral', 'penal', 'civil') then
      raise exception 'Cada causa Who debe indicar tipo laboral, penal o civil';
    end if;

    if cause_year_text !~ '^\d{4}$' then
      raise exception 'Cada causa Who debe indicar un año válido de 4 dígitos';
    end if;

    cause_year := cause_year_text::integer;

    if cause_year < 1900 or cause_year > extract(year from timezone('utc', now()))::integer + 1 then
      raise exception 'El año informado en causas Who está fuera de rango';
    end if;

    if cause_comment is null then
      raise exception 'Cada causa Who debe incluir comentario';
    end if;

    normalized := normalized || jsonb_build_array(
      jsonb_build_object(
        'type', cause_type,
        'year', cause_year,
        'comment', cause_comment
      )
    );
  end loop;

  return normalized;
end;
$function$;

create or replace function public.request_candidate_stage_who(
  p_case_candidate_id uuid,
  p_comment text default null,
  p_causes jsonb default '[]'::jsonb
)
returns table (
  recruitment_case_id uuid,
  stage_code text,
  case_status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  candidate_record public.recruitment_case_candidates%rowtype;
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  normalized_causes jsonb := public.normalize_candidate_who_causes(p_causes);
  has_findings boolean := jsonb_array_length(normalized_causes) > 0;
  target_stage text := case when has_findings then 'who_pending' else 'who_approved' end;
  approval_status text := case when has_findings then 'pending' else 'approved' end;
  approval_timestamp timestamptz := timezone('utc', now());
  next_case_status text;
  approval_id bigint;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  perform public.assert_candidate_control_access(current_user_id);

  select *
    into candidate_record
    from public.recruitment_case_candidates rcc
   where rcc.id = p_case_candidate_id
   for update;

  if candidate_record.id is null then
    raise exception 'No existe el candidato del caso';
  end if;

  if not public.user_can_manage_recruitment_case(current_user_id, candidate_record.recruitment_case_id) then
    raise exception 'Sin permisos para solicitar aprobación Who';
  end if;

  if candidate_record.stage_code <> 'lead' then
    raise exception 'La aprobación Who solo puede solicitarse desde la etapa Lead';
  end if;

  update public.candidate_stage_approvals csa
     set status = 'cancelled',
         updated_at = approval_timestamp
   where csa.recruitment_case_candidate_id = candidate_record.id
     and csa.stage_code = 'who_pending'
     and csa.status = 'pending';

  insert into public.candidate_stage_approvals (
    recruitment_case_candidate_id,
    stage_code,
    status,
    requested_by,
    requested_at,
    approved_by,
    approved_at,
    comment,
    causes,
    created_at,
    updated_at
  )
  values (
    candidate_record.id,
    'who_pending',
    approval_status,
    current_user_id,
    approval_timestamp,
    case when has_findings then null else current_user_id end,
    case when has_findings then null else approval_timestamp end,
    normalized_comment,
    normalized_causes,
    approval_timestamp,
    approval_timestamp
  )
  returning id into approval_id;

  update public.recruitment_case_candidates rcc
     set stage_code = target_stage,
         stage_entered_at = approval_timestamp,
         updated_at = approval_timestamp
   where rcc.id = candidate_record.id;

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  values (
    candidate_record.id,
    candidate_record.stage_code,
    target_stage,
    current_user_id,
    case when has_findings then 'who_requested' else 'who_auto_approved_no_findings' end,
    normalized_comment
  );

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  )
  values (
    candidate_record.recruitment_case_id,
    candidate_record.id,
    current_user_id,
    case
      when has_findings then 'candidate_stage_approval_requested'
      else 'candidate_stage_approval_approved'
    end,
    jsonb_build_object(
      'stage_code', candidate_record.stage_code
    ),
    jsonb_build_object(
      'stage_code', target_stage,
      'approval_id', approval_id,
      'status', approval_status
    ),
    jsonb_build_object(
      'comment', normalized_comment,
      'causes', normalized_causes,
      'auto_approved', not has_findings
    )
  );

  next_case_status := public.sync_recruitment_case_status(
    candidate_record.recruitment_case_id,
    current_user_id
  );

  return query
  select candidate_record.recruitment_case_id, target_stage, next_case_status;
end;
$function$;

notify pgrst, 'reload schema';

commit;
