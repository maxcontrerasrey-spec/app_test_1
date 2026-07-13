do $$
declare
  target_job public.buk_sync_jobs%rowtype;
  repaired_request jsonb;
  repaired_response jsonb;
  repaired_context jsonb;
begin
  select *
  into target_job
  from public.buk_sync_jobs
  where id = '9a242225-c808-4865-a103-3f7e49949a30'::uuid
    and recruitment_case_candidate_id = 'fe2605ce-c6ad-4649-b234-6043fb52884c'::uuid
    and buk_employee_id = '41969'
    and status = 'success'
  for update;

  if not found then
    raise exception 'Expected Cecilia Caceres BUK sync job was not found for repair audit';
  end if;

  if coalesce(target_job.result_snapshot -> 'job' -> 'response' ->> 'id', '') <> '142427' then
    raise exception 'Unexpected Cecilia Caceres BUK job response id: %',
      target_job.result_snapshot -> 'job' -> 'response' ->> 'id';
  end if;

  repaired_request :=
    coalesce(target_job.result_snapshot -> 'job' -> 'request', '{}'::jsonb)
    || jsonb_build_object(
      'area_id', 2942,
      'role_id', 1,
      'cost_center', '719',
      'company_id', 1
    );

  repaired_response :=
    coalesce(target_job.result_snapshot -> 'job' -> 'response', '{}'::jsonb)
    || jsonb_build_object(
      'area_id', 2942,
      'role', jsonb_build_object('id', 1, 'name', 'CONDUCTOR DE BUS'),
      'cost_center', '719',
      'company_id', 1
    );

  repaired_context :=
    coalesce(target_job.result_snapshot -> 'job' -> 'resolvedContext', '{}'::jsonb)
    || jsonb_build_object(
      'areaCode', '719',
      'areaName', 'SERCOING - DRT',
      'areaId', 2942,
      'companyId', 1,
      'roleId', 1,
      'roleName', 'CONDUCTOR DE BUS',
      'costCenter', '719'
    );

  update public.buk_sync_jobs
  set result_snapshot =
    jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(result_snapshot, '{}'::jsonb),
          '{job,request}',
          repaired_request,
          true
        ),
        '{job,response}',
        repaired_response,
        true
      ),
      '{job,resolvedContext}',
      repaired_context,
      true
    )
    || jsonb_build_object(
      'manualRepair',
      jsonb_build_object(
        'reason', 'Cecilia Caceres was initially loaded in Puerto Terrestre because SERCOING - DRT used stale buk_area_code 106',
        'appliedAt', timezone('utc', now()),
        'bukEmployeeId', '41969',
        'bukJobId', 142427,
        'correctAreaId', 2942,
        'correctCostCenter', '719',
        'correctAreaName', 'SERCOING - DRT'
      )
    )
  where id = target_job.id;
end $$;
