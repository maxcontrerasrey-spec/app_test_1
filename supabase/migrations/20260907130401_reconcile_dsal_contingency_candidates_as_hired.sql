-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; terminal recruitment decisions require a new audited correction.
begin;

create temp table tmp_dsal_contingency_hires (
  candidate_id uuid primary key,
  live_buk_employee_id text not null,
  expected_case_code text not null,
  previous_stage text,
  source_job_id uuid,
  actor_user_id uuid
) on commit drop;

insert into tmp_dsal_contingency_hires (candidate_id, live_buk_employee_id, expected_case_code)
values
  ('01d70d69-848e-4df6-a151-7bc9092957be', '42992', 'RC-0091'),
  ('1cac91ba-b554-4705-bbb9-760dc039149d', '42999', 'RC-0132'),
  ('92fabc76-ac25-4de0-a68b-c5fe9a9ce474', '43003', 'RC-0132'),
  ('3951a9db-be02-47a6-8b9d-43cc02d6a68d', '42998', 'RC-0132'),
  ('2b780860-d6ea-46c7-8cbe-54bafe719dee', '42698', 'RC-0132'),
  ('60a35ad0-3952-4abf-9bd6-84cfa5bccc0b', '42699', 'RC-0132'),
  ('17a14ae1-a355-4d51-973b-e12dde3e8f2b', '42663', 'RC-0132'),
  ('4cc2afd8-d47d-4158-bf90-fd01a45909c2', '42761', 'RC-0132'),
  ('5c0c6b2c-5980-4025-bfe3-b39826d7381e', '42701', 'RC-0132'),
  ('184c0f24-6c86-4763-b7bf-523bc8c093ce', '42700', 'RC-0132'),
  ('dc53c8ae-14b4-4dbe-b50a-f2635264722d', '42697', 'RC-0132'),
  ('40e7a48e-87e5-4e47-bbef-dc0d1b3cb11f', '43002', 'RC-0132'),
  ('13072dc8-bf53-4f17-8c8f-96bbb08adfae', '43001', 'RC-0132'),
  ('cadc0e10-eb7d-40ae-9e93-13d21bb28dbd', '43004', 'RC-0132'),
  ('4d4fc229-9d5c-4421-b1e6-73f3c6cbdb0b', '42997', 'RC-0132'),
  ('c259cede-44ee-48c7-ad88-3e4ed7e08022', '43653', 'RC-0132'),
  ('f2592db3-dbd1-4523-a23e-dd851899c6a3', '42696', 'RC-0132'),
  ('1b6daaba-b7e5-4fba-b19a-bd84ffc43301', '42695', 'RC-0132'),
  ('35e378b9-e7e6-4ebf-bff4-3e1f0e9e87d1', '43000', 'RC-0132'),
  ('fa353962-684b-4b4f-b0df-a80b720d4275', '42664', 'RC-0132'),
  ('fc40b7cd-9941-40a5-a4ef-4bef50474d19', '42926', 'RC-0133'),
  ('ac6c7b7a-ced2-4a87-9c93-c6e3b1d77edb', '42996', 'RC-0133'),
  ('4ab98d3b-a3bf-4435-a8e7-a3e52110dbe5', '42994', 'RC-0134'),
  ('f2747762-c9a5-443b-83c3-132bb74b7e0e', '42995', 'RC-0134'),
  ('fbb2fcf3-9237-4a67-b2cd-eb6db7717894', '43257', 'RC-0135'),
  ('68ab0356-6e43-4255-a081-02417289a45a', '42662', 'RC-0138'),
  ('2f994031-27c0-4670-b008-201955689b69', '43256', 'RC-0139'),
  ('0c6f6977-e74a-47f4-8e8b-16ab6024990f', '43487', 'RC-0139'),
  ('ddcc07d9-5bd4-4ba2-91c4-93b0d058527e', '42993', 'RC-0141'),
  ('a10123f7-c322-4390-ad4b-c3ef9094ae91', '42870', 'RC-0142'),
  ('4f9dafd8-0cbf-420a-bec0-27e74d012ad5', '42874', 'RC-0142'),
  ('e11ce198-f5bd-41fa-8f71-9a082eb20a0d', '42868', 'RC-0142'),
  ('93cac252-ee4e-4129-b733-6bbed2472021', '42867', 'RC-0142'),
  ('d88e18ef-4102-4036-b6ed-335c2b86e3a8', '42878', 'RC-0142'),
  ('3e960b54-afca-4453-b051-c5a22a2af904', '42881', 'RC-0142'),
  ('30e33cfb-5306-4004-a2f7-0fdc2aadd835', '42871', 'RC-0142'),
  ('00ca5111-9b19-4d08-bc89-4f8f2a46c364', '43058', 'RC-0142'),
  ('001cd024-9be7-4893-bc19-ff0cf121d7ad', '43060', 'RC-0142'),
  ('0fd5bfe0-d27e-41ae-b502-7917a7b7c1ae', '42879', 'RC-0142'),
  ('cf34516a-db6f-4c40-b758-0606c76981f7', '42882', 'RC-0142'),
  ('d48093b1-e8c3-45da-9ce6-caede19bab2b', '43059', 'RC-0142'),
  ('26a7730c-1ae6-4861-a2f9-15529be63e5c', '42880', 'RC-0142'),
  ('4a18a39c-5e31-4188-9cc6-3cae4a1fbdc0', '42896', 'RC-0142'),
  ('7882df5a-870c-4824-8282-49f4db9c1202', '42877', 'RC-0142'),
  ('f02c1170-fb94-4cd8-8db8-f8c89ca49a0f', '42869', 'RC-0142'),
  ('ff916a34-521c-429d-834e-78795743b09b', '42876', 'RC-0142'),
  ('db5d1b95-ce20-41f5-9d7e-f000a4c3874b', '42872', 'RC-0142'),
  ('669cd770-c1b6-47ee-9601-249e99ec64af', '42875', 'RC-0142'),
  ('92dc415c-f957-4130-afb8-a244467d4c8f', '42897', 'RC-0144'),
  ('b1d02e9e-37db-4309-88de-9abc2064e096', '43454', 'RC-0159'),
  ('53033378-2920-443c-a27a-8354e3664888', '43289', 'RC-0159'),
  ('af0cf289-1bf0-48c3-bcc8-a00e0095252f', '43290', 'RC-0159'),
  ('e6ecdd0f-f925-47ed-a4a8-8be9791095cb', '43322', 'RC-0159'),
  ('03f04384-e4da-42e8-8c6f-eb22f3975a3b', '43092', 'RC-0163'),
  ('b08313bc-86a4-4c5f-b8b9-5d65ba4097bd', '43227', 'RC-0164'),
  ('63e865f6-b4ca-4957-ada5-2266d7118410', '43224', 'RC-0164'),
  ('9de5e63a-5c03-4f36-a2cb-eecc785c2721', '43228', 'RC-0164'),
  ('5db65289-1b07-46a2-9c51-fb2904b199d1', '43226', 'RC-0164'),
  ('e460d43c-fd2a-4ccd-8072-b966b88f261b', '43225', 'RC-0164'),
  ('dce4a55f-a848-49cd-8ecd-89a0295b2678', '43223', 'RC-0164');

do $migration$
declare
  target_count integer;
  invalid_count integer;
  case_row record;
  now_utc timestamptz := timezone('utc', now());
  live_verified_at constant timestamptz := '2026-09-07 12:57:58.477+00';
begin
  select count(*) into target_count from tmp_dsal_contingency_hires;
  if target_count <> 60 then
    raise exception 'Guard DSAL: se esperaban 60 fichas BUK verificadas y se recibieron %', target_count;
  end if;

  select count(*) into invalid_count
  from tmp_dsal_contingency_hires target
  left join public.recruitment_case_candidates rcc on rcc.id = target.candidate_id
  left join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
  left join public.recruitment_precandidates rp on rp.approved_case_candidate_id = rcc.id
  where rcc.id is null
     or rc.case_code is distinct from target.expected_case_code
     or upper(coalesce(rc.contract_name, '')) not like '%DSAL%'
     or rc.status in ('cancelled', 'closed_unfilled')
     or rp.id is null
     or rp.source_code <> 'dsal_public'
     or rp.status <> 'approved';
  if invalid_count <> 0 then
    raise exception 'Guard DSAL: % objetivos ya no corresponden a precandidatos aprobados del folio esperado', invalid_count;
  end if;

  select count(*) into invalid_count
  from tmp_dsal_contingency_hires target
  join public.recruitment_case_candidates rcc on rcc.id = target.candidate_id
  where rcc.stage_code not in ('lead', 'who_approved', 'in_process', 'rejected', 'hired');
  if invalid_count <> 0 then
    raise exception 'Guard DSAL: % candidatos cambiaron a una etapa incompatible con la conciliacion', invalid_count;
  end if;

  select count(*) into invalid_count
  from tmp_dsal_contingency_hires target
  where not exists (
    select 1
    from public.buk_sync_jobs bsj
    where bsj.recruitment_case_candidate_id = target.candidate_id
      and bsj.payload_snapshot ? 'contingency'
      and public.is_effective_buk_generation_success(
        bsj.status,
        bsj.buk_employee_id,
        bsj.result_snapshot
      )
  );
  if invalid_count <> 0 then
    raise exception 'Guard DSAL: % candidatos no conservan una alta BUK contingente efectiva', invalid_count;
  end if;

  if exists (
    select 1
    from public.candidate_stage_approvals csa
    join tmp_dsal_contingency_hires target
      on target.candidate_id = csa.recruitment_case_candidate_id
    where csa.status = 'pending'
  ) then
    raise exception 'Guard DSAL: existen aprobaciones Who pendientes en el lote';
  end if;

  if not exists (
    select 1
    from public.recruitment_case_candidates rcc
    join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
    join public.candidate_profiles cp on cp.id = rcc.candidate_profile_id
    where rcc.id = 'f7d8c5a2-47f6-4390-9eb8-92c26c3f429b'
      and rc.case_code = 'RC-0142'
      and cp.national_id = '134792353'
      and rcc.stage_code = 'rejected'
  ) then
    raise exception 'Guard DSAL: Simón Escobar ya no conserva el descarte esperado tras no encontrarse su ficha BUK';
  end if;

  update tmp_dsal_contingency_hires target
     set previous_stage = rcc.stage_code,
         source_job_id = job.id,
         actor_user_id = job.requested_by
    from public.recruitment_case_candidates rcc
    cross join lateral (
      select bsj.id, bsj.requested_by
      from public.buk_sync_jobs bsj
      where bsj.recruitment_case_candidate_id = rcc.id
        and bsj.payload_snapshot ? 'contingency'
        and public.is_effective_buk_generation_success(
          bsj.status,
          bsj.buk_employee_id,
          bsj.result_snapshot
        )
      order by bsj.created_at desc
      limit 1
    ) job
   where rcc.id = target.candidate_id;

  select count(*) into invalid_count
  from (
    select rc.id
    from public.recruitment_cases rc
    join (
      select rcc.recruitment_case_id,
             count(*) filter (where rcc.stage_code <> 'hired')::integer as hires_to_apply
      from tmp_dsal_contingency_hires target
      join public.recruitment_case_candidates rcc on rcc.id = target.candidate_id
      group by rcc.recruitment_case_id
    ) projected on projected.recruitment_case_id = rc.id
    cross join lateral public.get_recruitment_case_effective_metrics(rc.id) metrics
    where metrics.effective_filled_vacancies + projected.hires_to_apply > rc.requested_vacancies
  ) overfilled_cases;
  if invalid_count <> 0 then
    raise exception 'Guard DSAL: la conciliacion sobrellenaria % folios', invalid_count;
  end if;

  update public.recruitment_case_candidates rcc
     set stage_code = 'hired',
         stage_entered_at = now_utc,
         hired_at = coalesce(rcc.hired_at, now_utc),
         rejection_reason = null,
         withdrawal_reason = null,
         updated_at = now_utc
    from tmp_dsal_contingency_hires target
   where rcc.id = target.candidate_id
     and rcc.stage_code <> 'hired';

  insert into public.recruitment_case_candidate_stage_history (
    recruitment_case_candidate_id,
    from_stage,
    to_stage,
    changed_by,
    reason_code,
    comment
  )
  select
    target.candidate_id,
    target.previous_stage,
    'hired',
    target.actor_user_id,
    'dsal_contingency_buk_live_reconciliation',
    'Contratación DSAL regularizada en ERP tras verificar la ficha y el trabajo DSAL directamente en BUK.'
  from tmp_dsal_contingency_hires target
  where target.previous_stage <> 'hired';

  insert into public.recruitment_case_audit_log (
    recruitment_case_id,
    recruitment_case_candidate_id,
    actor_user_id,
    action_type,
    old_values,
    new_values,
    metadata
  )
  select
    rcc.recruitment_case_id,
    target.candidate_id,
    target.actor_user_id,
    'candidate_hired',
    jsonb_build_object('stage_code', target.previous_stage),
    jsonb_build_object('stage_code', 'hired', 'hired_at', rcc.hired_at),
    jsonb_build_object(
      'source', 'dsal_contingency_buk_live_reconciliation',
      'buk_sync_job_id', target.source_job_id,
      'live_buk_employee_id', target.live_buk_employee_id,
      'buk_live_verified_at', live_verified_at,
      'buk_contract', 'CODELCO - DSAL',
      'buk_area_id', 2911,
      'buk_company_id', 5
    )
  from tmp_dsal_contingency_hires target
  join public.recruitment_case_candidates rcc on rcc.id = target.candidate_id
  where target.previous_stage <> 'hired';

  for case_row in
    select distinct rcc.recruitment_case_id
    from tmp_dsal_contingency_hires target
    join public.recruitment_case_candidates rcc on rcc.id = target.candidate_id
    order by rcc.recruitment_case_id
  loop
    perform public.sync_recruitment_case_status(case_row.recruitment_case_id, null);
  end loop;

  select count(*) into invalid_count
  from tmp_dsal_contingency_hires target
  join public.recruitment_case_candidates rcc on rcc.id = target.candidate_id
  where rcc.stage_code <> 'hired' or rcc.hired_at is null;
  if invalid_count <> 0 then
    raise exception 'Verificacion DSAL: % candidatos no quedaron contratados', invalid_count;
  end if;

  select count(*) into invalid_count
  from public.recruitment_cases rc
  where rc.case_code in (
    'RC-0091','RC-0132','RC-0133','RC-0134','RC-0135','RC-0138','RC-0139',
    'RC-0141','RC-0142','RC-0144','RC-0163','RC-0164'
  )
    and (rc.status <> 'filled' or rc.filled_vacancies <> rc.requested_vacancies);
  if invalid_count <> 0 then
    raise exception 'Verificacion DSAL: % folios que debian cubrirse no quedaron cerrados por cupo', invalid_count;
  end if;

  if not exists (
    select 1
    from public.recruitment_cases rc
    where rc.case_code = 'RC-0159'
      and rc.status = 'partially_filled'
      and rc.filled_vacancies = 4
      and rc.requested_vacancies = 10
  ) then
    raise exception 'Verificacion DSAL: RC-0159 no quedo parcialmente cubierto en 4 de 10 cupos';
  end if;

  select count(*) into invalid_count
  from (
    select rc.id
    from public.recruitment_cases rc
    join (
      select distinct rcc.recruitment_case_id
      from tmp_dsal_contingency_hires target
      join public.recruitment_case_candidates rcc on rcc.id = target.candidate_id
    ) affected on affected.recruitment_case_id = rc.id
    cross join lateral public.get_recruitment_case_effective_metrics(rc.id) metrics
    where metrics.effective_filled_vacancies > rc.requested_vacancies
  ) overfilled_cases;
  if invalid_count <> 0 then
    raise exception 'Verificacion DSAL: % folios quedaron sobrellenados', invalid_count;
  end if;
end;
$migration$;

commit;
