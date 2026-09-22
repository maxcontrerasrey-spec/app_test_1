-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; preserve external BUK evidence and candidate history.
begin;

alter table public.recruitment_case_external_hires
  add column if not exists recruitment_case_candidate_id uuid
    references public.recruitment_case_candidates(id) on delete restrict;
alter table public.recruitment_case_external_hires
  add column if not exists is_active boolean not null default true;
create index if not exists idx_recruitment_case_external_hires_candidate
  on public.recruitment_case_external_hires (recruitment_case_candidate_id) where is_active;

do $migration$
declare
  v_case_id uuid;
  v_actor uuid;
  v_now timestamptz := timezone('utc', now());
begin
  select id into v_case_id from public.recruitment_cases where case_code = 'RC-0173' for update;
  if v_case_id is null then raise exception 'No se encontró RC-0173'; end if;

  if exists (
    select 1
    from public.recruitment_case_candidates rcc
    join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
    where rcc.recruitment_case_id = v_case_id
      and not exists (
        select 1 from public.employees e
        where e.is_active
          and upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9Kk]', '', 'g')) = upper(regexp_replace(coalesce(cp.national_id, ''), '[^0-9Kk]', '', 'g'))
          and upper(coalesce(e.area_name, '')) like '%CODELCO - DSAL%'
      )
  ) then
    raise exception 'RC-0173: existe un candidato sin ficha BUK DSAL activa inequívoca';
  end if;

  update public.recruitment_case_external_hires eh
     set recruitment_case_candidate_id = rcc.id, updated_at = v_now
    from public.recruitment_case_candidates rcc
    join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
   where eh.recruitment_case_id = v_case_id
     and rcc.recruitment_case_id = v_case_id
     and upper(regexp_replace(coalesce(eh.employee_document_number, ''), '[^0-9Kk]', '', 'g')) = upper(regexp_replace(coalesce(cp.national_id, ''), '[^0-9Kk]', '', 'g'))
     and eh.recruitment_case_candidate_id is distinct from rcc.id;

  insert into public.recruitment_case_external_hires (
    recruitment_case_id, recruitment_case_candidate_id, employee_buk_employee_id,
    employee_document_number, employee_full_name, source, hired_at, notes
  )
  select v_case_id, rcc.id, e.buk_employee_id, e.document_number, cp.full_name,
    'manual_buk_external_hire_reconciled', v_now,
    'Alta manual en BUK reconciliada con el candidato vigente de RC-0173 por RUT.'
  from public.recruitment_case_candidates rcc
  join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
  join public.employees e on e.is_active
    and upper(regexp_replace(coalesce(e.document_number, ''), '[^0-9Kk]', '', 'g')) = upper(regexp_replace(coalesce(cp.national_id, ''), '[^0-9Kk]', '', 'g'))
    and upper(coalesce(e.area_name, '')) like '%CODELCO - DSAL%'
  where rcc.recruitment_case_id = v_case_id and cp.national_id = '117932737'
    and not exists (select 1 from public.recruitment_case_external_hires x where x.recruitment_case_id = v_case_id and x.recruitment_case_candidate_id = rcc.id)
  order by e.updated_at desc, e.buk_employee_id limit 1;

  -- Keep the old Gustavo record auditable but outside the current ERP roster.
  update public.recruitment_case_external_hires
     set is_active = false, source = 'manual_buk_external_hire_superseded',
         notes = concat_ws(' ', notes, 'Registro histórico: no existe candidato vigente con este RUT en RC-0173.'), updated_at = v_now
   where recruitment_case_id = v_case_id and employee_buk_employee_id = '43950' and recruitment_case_candidate_id is null;

  select rca.user_id into v_actor from public.recruitment_case_assignments rca
   where rca.recruitment_case_id = v_case_id and rca.is_primary order by rca.id limit 1;

  if (select count(*) from public.recruitment_case_candidates where recruitment_case_id = v_case_id) <> 10
     or (select count(*) from public.recruitment_case_external_hires where recruitment_case_id = v_case_id and recruitment_case_candidate_id is not null) <> 10 then
    raise exception 'RC-0173: no se reconciliaron exactamente 10 candidatos';
  end if;

  create temp table tmp_rc_0173_transition(candidate_id uuid primary key, previous_stage text not null, buk_employee_id text not null) on commit drop;
  insert into tmp_rc_0173_transition
  select rcc.id, rcc.stage_code, eh.employee_buk_employee_id
  from public.recruitment_case_candidates rcc
  join public.recruitment_case_external_hires eh on eh.recruitment_case_candidate_id = rcc.id and eh.recruitment_case_id = v_case_id
  where rcc.recruitment_case_id = v_case_id;

  update public.recruitment_case_candidates rcc
     set stage_code = 'hired', stage_entered_at = v_now, hired_at = coalesce(rcc.hired_at, v_now),
         rejection_reason = null, withdrawal_reason = null, updated_at = v_now
    from tmp_rc_0173_transition t where rcc.id = t.candidate_id and rcc.stage_code <> 'hired';

  insert into public.recruitment_case_candidate_stage_history(recruitment_case_candidate_id, from_stage, to_stage, changed_by, reason_code, comment)
  select candidate_id, previous_stage, 'hired', v_actor, 'external_buk_hire_reconciled', 'Contratación manual en BUK reconciliada con ERP por RUT e ID BUK.'
  from tmp_rc_0173_transition where previous_stage <> 'hired';

  insert into public.recruitment_case_audit_log(recruitment_case_id, recruitment_case_candidate_id, actor_user_id, action_type, old_values, new_values, metadata)
  select v_case_id, candidate_id, v_actor, 'candidate_hired', jsonb_build_object('stage_code', previous_stage), jsonb_build_object('stage_code', 'hired', 'hired_at', v_now), jsonb_build_object('source', 'external_buk_hire_reconciled', 'buk_employee_id', buk_employee_id, 'case_code', 'RC-0173')
  from tmp_rc_0173_transition where previous_stage <> 'hired';

  -- Once linked to an ERP candidate, the external row is evidence, not a second vacancy.
  update public.recruitment_case_external_hires set is_active = false, source = 'manual_buk_external_hire_reconciled', updated_at = v_now
   where recruitment_case_id = v_case_id and recruitment_case_candidate_id is not null;
  perform public.sync_recruitment_case_status(v_case_id, v_actor);
end;
$migration$;

create or replace function public.get_recruitment_contracted_personnel_page(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = public
as $function$
declare
  v_user uuid := auth.uid(); v_search text := public.normalize_recruitment_search_text(p_search);
  v_items jsonb := '[]'::jsonb; v_total bigint := 0; v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_user is null then raise exception 'Usuario no autenticado'; end if;
  if not public.user_can_access_recruitment_personnel(v_user) then return jsonb_build_object('items','[]'::jsonb,'total_count',0); end if;
  with rows as (
    select rcc.id, rc.opened_at, rcc.created_at, coalesce(rcc.hired_at, eh.hired_at, eh.created_at, rcc.updated_at) as sort_at,
      public.normalize_recruitment_search_text(concat_ws(' ',cp.full_name,cp.national_id,rc.case_code,hr.folio,rc.contract_name,rc.job_position_name,rc.cost_center_name,rc.cost_center_code,owner_profile.full_name)) as haystack,
      jsonb_build_object('id',rcc.id,'candidate_profile_id',cp.id,'recruitment_case_id',rc.id,'case_code',rc.case_code,'folio',hr.folio,'case_status',rc.status,'national_id',cp.national_id,'full_name',cp.full_name,'email',cp.email,'phone',cp.phone,'driver_license_number',cp.driver_license_number,'driver_license_class',cp.driver_license_class,'driver_license_expiry',cp.driver_license_expiry,'stage_code',rcc.stage_code,'stage_entered_at',rcc.stage_entered_at,'suitability_status',rcc.suitability_status,'is_selected',rcc.is_selected,'contract_name',rc.contract_name,'job_position_name',rc.job_position_name,'cost_center_code',rc.cost_center_code,'cost_center_name',rc.cost_center_name,'owner_name',owner_profile.full_name,'active_process_count',0,'contract_locked_case_id',null,'contract_locked_case_code',null,'contract_locked_folio',null,'contract_locked_stage_code',null,'is_contract_path_blocked',false,'interview_notes',rcc.interview_notes,'hired_at',rcc.hired_at,'buk_generated_at',coalesce(eh.hired_at,eh.created_at),'buk_employee_id',eh.employee_buk_employee_id,'has_buk_generation_success',true,'requested_vacancies',rc.requested_vacancies,'buk_occupied_vacancies',null,'buk_available_vacancies',null,'buk_generation_blocked',false,'buk_generation_block_reason',null) as payload
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc on rc.id=rcc.recruitment_case_id
    join public.hiring_requests hr on hr.id=rc.hiring_request_id
    join public.candidate_profiles cp on cp.id=rcc.candidate_profile_id
    join public.recruitment_case_external_hires eh on eh.recruitment_case_candidate_id=rcc.id and eh.recruitment_case_id=rc.id
    left join lateral (select rca.user_id from public.recruitment_case_assignments rca where rca.recruitment_case_id=rc.id and rca.is_primary order by rca.id limit 1) owner_assignment on true
    left join public.profiles owner_profile on owner_profile.id=owner_assignment.user_id
    where rcc.stage_code='hired' and public.user_can_manage_recruitment_personnel_candidate(v_user,rcc.id)
  ), filtered as (select * from rows where v_search='' or haystack like '%'||v_search||'%'), total as (select count(*) value from filtered), ordered as (select payload,row_number() over() n from (select payload from filtered order by sort_at desc,opened_at desc,created_at asc,id asc limit v_limit offset v_offset) x)
  select coalesce(jsonb_agg(payload order by n),'[]'::jsonb),(select value from total) into v_items,v_total from ordered;
  return jsonb_build_object('items',v_items,'total_count',coalesce(v_total,0));
end;
$function$;

notify pgrst, 'reload schema';
commit;
