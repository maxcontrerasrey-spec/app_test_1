-- EEES-DB-005: approved
-- owner: Reclutamiento / Control de Contratos
-- rollback: forward-only; revert the frontend first, then restore the prior approval RPC definition in a corrective migration. Retain the additive columns and captured values.
begin;

-- Nullable additions preserve all historical requests without inferred values.
alter table public.hiring_requests
  add column if not exists accommodation_type text,
  add column if not exists travel_allowance_amount numeric(12, 0);

alter table public.hiring_requests
  add constraint hiring_requests_accommodation_type_check
  check (accommodation_type is null or accommodation_type in ('pension', 'mining_camp')) not valid;

alter table public.hiring_requests
  add constraint hiring_requests_travel_allowance_amount_check
  check (travel_allowance_amount is null or travel_allowance_amount > 0) not valid;

create or replace function public.submit_hiring_request_with_accommodation(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_vacancies integer,
  p_requested_entry_date date,
  p_start_date date,
  p_end_date date,
  p_campamento boolean,
  p_pasajes boolean,
  p_other_benefits text,
  p_salary_offer numeric,
  p_shift_id bigint,
  p_requester_signed boolean,
  p_idempotency_key uuid,
  p_accommodation_type text
)
returns table (request_id uuid, folio text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  created_row record;
begin
  if current_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if coalesce(p_campamento, false) then
    if p_accommodation_type is null
       or p_accommodation_type not in ('pension', 'mining_camp') then
      raise exception 'Debes seleccionar Pensión o Campamento Minero';
    end if;
  elsif p_accommodation_type is not null then
    raise exception 'El tipo de alojamiento solo aplica cuando se solicita alojamiento';
  end if;

  select * into created_row
  from public.submit_hiring_request(
    p_contract_id, p_job_position_id, p_vacancies, p_requested_entry_date,
    p_start_date, p_end_date, p_campamento, p_pasajes, p_other_benefits,
    p_salary_offer, p_shift_id, p_requester_signed, p_idempotency_key
  );

  update public.hiring_requests hr
     set accommodation_type = p_accommodation_type
   where hr.id = created_row.request_id
     and hr.requester_id = current_user_id;

  if not found then
    raise exception 'No fue posible asociar el tipo de alojamiento a la solicitud';
  end if;

  update public.hiring_request_snapshots hrs
     set payload = coalesce(hrs.payload, '{}'::jsonb)
                  || jsonb_build_object('accommodation_type', p_accommodation_type)
   where hrs.hiring_request_id = created_row.request_id
     and hrs.snapshot_type = 'submitted';

  update public.hiring_request_audit_log hral
     set new_values = coalesce(hral.new_values, '{}'::jsonb)
                      || jsonb_build_object('accommodation_type', p_accommodation_type)
   where hral.hiring_request_id = created_row.request_id
     and hral.action_type = 'submitted';

  return query select created_row.request_id::uuid, created_row.folio::text;
end;
$function$;

revoke all on function public.submit_hiring_request_with_accommodation(
  bigint, bigint, integer, date, date, date, boolean, boolean, text, numeric,
  bigint, boolean, uuid, text
) from public, anon;
grant execute on function public.submit_hiring_request_with_accommodation(
  bigint, bigint, integer, date, date, date, boolean, boolean, text, numeric,
  bigint, boolean, uuid, text
) to authenticated, service_role;

-- Derive the new approval overload from the current secured implementation;
-- asserted anchors fail closed if the live workflow has drifted.
do $migration$
declare
  v_source text;
  v_patched text;
  v_old_signature text := 'p_comment text DEFAULT NULL::text, p_travel_methodology text DEFAULT NULL::text)';
  v_new_signature text := 'p_comment text, p_travel_methodology text, p_travel_allowance_amount numeric)';
  v_old_declaration text := $anchor$  normalized_travel_methodology text := nullif(trim(coalesce(p_travel_methodology, '')), '');$anchor$;
  v_new_declaration text := $replacement$  normalized_travel_methodology text := nullif(trim(coalesce(p_travel_methodology, '')), '');
  normalized_travel_allowance_amount numeric := p_travel_allowance_amount;$replacement$;
  v_old_update text := $anchor$
         travel_methodology = case
           when coalesce(request_record.pasajes, false) = true then normalized_travel_methodology
           else null
         end,
         updated_at = timezone('utc', now())$anchor$;
  v_new_update text := $replacement$
         travel_methodology = case
           when coalesce(request_record.pasajes, false) = true then normalized_travel_methodology
           else null
         end,
         travel_allowance_amount = case
           when coalesce(request_record.pasajes, false) = true
             and normalized_travel_methodology = 'travel_allowance'
             then normalized_travel_allowance_amount
           else null
         end,
         updated_at = timezone('utc', now())$replacement$;
  v_old_case_open text := '  perform public.open_recruitment_case_from_hiring_request(request_record.id, current_user_id);';
  v_new_case_open text := $replacement$
  update public.hiring_request_audit_log hral
     set old_values = coalesce(hral.old_values, '{}'::jsonb)
                      || jsonb_build_object('travel_allowance_amount', request_record.travel_allowance_amount),
         new_values = coalesce(hral.new_values, '{}'::jsonb)
                      || jsonb_build_object('travel_allowance_amount', normalized_travel_allowance_amount),
         metadata = coalesce(hral.metadata, '{}'::jsonb)
                    || jsonb_build_object('travel_allowance_amount', normalized_travel_allowance_amount)
   where hral.hiring_request_id = request_record.id
     and hral.approval_id = approval_record.id
     and hral.actor_user_id = current_user_id
     and hral.action_type = 'approved';

  perform public.open_recruitment_case_from_hiring_request(request_record.id, current_user_id);$replacement$;
  v_old_check text := $anchor$  if approval_record.step_code = 'contracts_control'
     and p_decision = 'approved'
     and coalesce(request_record.pasajes, false) = true
     and normalized_travel_methodology is null then
    raise exception 'Debes definir la metodologia de pasajes antes de aprobar';
  end if;$anchor$;
  v_new_check text := $replacement$  if approval_record.step_code = 'contracts_control'
     and p_decision = 'approved'
     and coalesce(request_record.pasajes, false) = true
     and normalized_travel_methodology is null then
    raise exception 'Debes definir la metodologia de pasajes antes de aprobar';
  end if;

  if approval_record.step_code = 'contracts_control'
     and p_decision = 'approved'
     and normalized_travel_methodology = 'travel_allowance'
     and (normalized_travel_allowance_amount is null
          or normalized_travel_allowance_amount <= 0
          or normalized_travel_allowance_amount <> trunc(normalized_travel_allowance_amount)) then
    raise exception 'El monto del bono de traslado debe ser un entero mayor a cero';
  end if;

  if normalized_travel_allowance_amount is not null
     and (approval_record.step_code <> 'contracts_control'
          or p_decision <> 'approved'
          or normalized_travel_methodology <> 'travel_allowance') then
    raise exception 'El monto solo aplica al aprobar un bono de traslado';
  end if;$replacement$;
begin
  select pg_get_functiondef(
    'public.decide_hiring_request_approval_v2(bigint,text,text,text)'::regprocedure
  ) into v_source;

  if position(v_old_signature in v_source) = 0
     or position(v_old_declaration in v_source) = 0
     or position(v_old_update in v_source) = 0
     or position(v_old_check in v_source) = 0
     or position(v_old_case_open in v_source) = 0 then
    raise exception 'La función vigente de aprobación cambió; se cancela el parche preventivo';
  end if;

  v_patched := replace(v_source, v_old_signature, v_new_signature);
  v_patched := replace(v_patched, v_old_declaration, v_new_declaration);
  v_patched := replace(v_patched, v_old_update, v_new_update);
  v_patched := replace(v_patched, v_old_check, v_new_check);
  v_patched := replace(v_patched, v_old_case_open, v_new_case_open);
  execute v_patched;
end;
$migration$;

create or replace function public.decide_hiring_request_approval_v2(
  p_approval_id bigint,
  p_decision text,
  p_comment text default null,
  p_travel_methodology text default null
)
returns table (
  hiring_request_id uuid,
  request_status text,
  decided_step text
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  select * from public.decide_hiring_request_approval_v2(
    p_approval_id, p_decision, p_comment, p_travel_methodology, null::numeric
  );
end;
$function$;

revoke all on function public.decide_hiring_request_approval_v2(bigint, text, text, text, numeric)
  from public, anon;
grant execute on function public.decide_hiring_request_approval_v2(bigint, text, text, text, numeric)
  to authenticated;

-- Keep the case-detail/approval JSON contracts and ACLs; add two fields and
-- constrain free-text benefits to the currently pending assigned approver.
do $migration$
declare
  v_source text;
  v_patched text;
  v_case_anchor text := $anchor$
      'campamento', hr.campamento,
      'pasajes', hr.pasajes,
      'travel_methodology', hr.travel_methodology,
      'other_benefits', hr.other_benefits,$anchor$;
  v_case_replacement text := $replacement$
      'campamento', hr.campamento,
      'accommodation_type', hr.accommodation_type,
      'pasajes', hr.pasajes,
      'travel_methodology', hr.travel_methodology,
      'travel_allowance_amount', hr.travel_allowance_amount,
      'other_benefits', null,$replacement$;
  v_approval_anchor text := $anchor$
          'campamento', hr.campamento,
          'pasajes', hr.pasajes,
          'travel_methodology', hr.travel_methodology,
          'other_benefits', hr.other_benefits$anchor$;
  v_approval_replacement text := $replacement$
          'campamento', hr.campamento,
          'accommodation_type', hr.accommodation_type,
          'pasajes', hr.pasajes,
          'travel_methodology', hr.travel_methodology,
          'travel_allowance_amount', hr.travel_allowance_amount,
          'other_benefits', case
            when hra.status = 'pending'
              and hra.step_code in ('area_manager', 'contracts_control')
              and hr.current_step_code = hra.step_code
              and (hra.approver_user_id = auth.uid() or public.user_is_admin(auth.uid()))
              then hr.other_benefits
            else null
          end$replacement$;
  v_detail_anchor text := $anchor$
      'other_benefits', hr.other_benefits,
      'campamento', hr.campamento,
      'pasajes', hr.pasajes,
      'travel_methodology', hr.travel_methodology$anchor$;
  v_detail_replacement text := $replacement$
      'other_benefits', case
        when hra.status = 'pending'
          and hra.step_code in ('area_manager', 'contracts_control')
          and hr.current_step_code = hra.step_code
          and (hra.approver_user_id = auth.uid() or public.user_is_admin(auth.uid()))
          then hr.other_benefits
        else null
      end,
      'campamento', hr.campamento,
      'accommodation_type', hr.accommodation_type,
      'pasajes', hr.pasajes,
      'travel_methodology', hr.travel_methodology,
      'travel_allowance_amount', hr.travel_allowance_amount$replacement$;
begin
  select pg_get_functiondef('public.get_recruitment_case_detail(uuid)'::regprocedure)
    into v_source;
  if position(v_case_anchor in v_source) = 0 then
    raise exception 'No se encontró el bloque vigente de beneficios en get_recruitment_case_detail';
  end if;
  v_patched := replace(v_source, v_case_anchor, v_case_replacement);
  execute v_patched;

  select pg_get_functiondef('public.get_recruitment_pending_approvals_page(integer,integer)'::regprocedure)
    into v_source;
  if position(v_approval_anchor in v_source) = 0 then
    raise exception 'No se encontró el bloque vigente de beneficios en la cola de aprobaciones';
  end if;
  v_patched := replace(v_source, v_approval_anchor, v_approval_replacement);
  execute v_patched;

  select pg_get_functiondef('public.get_hiring_approval_detail(bigint)'::regprocedure)
    into v_source;
  if position(v_detail_anchor in v_source) = 0 then
    raise exception 'No se encontró el bloque vigente de beneficios en el detalle de aprobación';
  end if;
  v_patched := replace(v_source, v_detail_anchor, v_detail_replacement);
  execute v_patched;
end;
$migration$;

-- Free-text benefits are approval-only. Redact them from general recruiter,
-- candidate, and requester RPCs while preserving their response shape and ACLs.
do $migration$
declare
  v_signature text;
  v_source text;
  v_patched text;
  v_signatures text[] := array[
    'public.get_recruitment_processes_page(text,text,text,text,integer,integer)',
    'public.get_recruitment_processes_page_v2(text,text,text,text,integer,integer,jsonb)',
    'public.get_recruitment_control_dashboard_v2()',
    'public.get_recruitment_active_case_options(text,integer)',
    'public.get_recruitment_case_detail_for_candidate(uuid,uuid)',
    'public.get_dashboard_approval_tracking()'
  ];
begin
  foreach v_signature in array v_signatures loop
    select pg_get_functiondef(v_signature::regprocedure) into v_source;
    if position('hr.other_benefits' in v_source) = 0 then
      raise exception 'No se encontró hr.other_benefits en %; se cancela la redacción fail-closed', v_signature;
    end if;

    v_patched := replace(v_source, 'hr.other_benefits', 'null::text');
    if position('hr.other_benefits' in v_patched) > 0 then
      raise exception 'La redacción de otros beneficios quedó incompleta en %', v_signature;
    end if;
    execute v_patched;
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
