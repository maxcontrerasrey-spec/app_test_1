begin;

do $$
declare
  v_buk_job_id constant uuid := 'c8f135db-594f-41a2-b0a4-82a316907a2b';
begin
  if not exists (
    select 1
      from public.buk_sync_jobs bsj
     where bsj.id = v_buk_job_id
       and bsj.status = 'success'
       and bsj.buk_employee_id = '41937'
       and bsj.result_snapshot #>> '{erpRepair,target_case_code}' = 'RC-0082'
  ) then
    raise exception 'Guard failed: Domingo BUK repair snapshot is not in expected RC-0082 state';
  end if;

  update public.buk_sync_jobs
     set result_snapshot = jsonb_set(
           coalesce(result_snapshot, '{}'::jsonb),
           '{erpRepair,buk_employee_patch}',
           jsonb_build_object(
             'active_since', '2026-07-20',
             'start_date', '2026-07-20',
             'patched_at', timezone('utc', now())
           ),
           true
         ),
         updated_at = timezone('utc', now())
   where id = v_buk_job_id;
end $$;

commit;
