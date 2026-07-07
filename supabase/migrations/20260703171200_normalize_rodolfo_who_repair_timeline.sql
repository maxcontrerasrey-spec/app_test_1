begin;

do $$
declare
  target_case_candidate_id uuid := 'ef4064a2-d076-4258-9691-2d270e3c7d0b';
  repaired_approval_id bigint := 84;
  base_ts timestamptz := '2026-07-03T17:26:07.000137+00:00'::timestamptz;
begin
  if not exists (
    select 1
      from public.recruitment_case_candidates rcc
     where rcc.id = target_case_candidate_id
  ) then
    raise notice 'Skipping Rodolfo WHO timeline normalization: target candidate % not found in this environment', target_case_candidate_id;
    return;
  end if;

  if not exists (
    select 1
      from public.candidate_stage_approvals csa
     where csa.id = repaired_approval_id
       and csa.recruitment_case_candidate_id = target_case_candidate_id
  ) then
    raise notice 'Skipping Rodolfo WHO timeline normalization: repaired approval % not found for candidate %', repaired_approval_id, target_case_candidate_id;
    return;
  end if;

  update public.recruitment_case_candidate_stage_history
     set created_at = base_ts + interval '1 millisecond'
   where recruitment_case_candidate_id = target_case_candidate_id
     and reason_code = 'candidate_reactivated_who_correction'
     and comment = 'Reapertura auditada para corregir rechazo WHO emitido por error.';

  update public.recruitment_case_candidate_stage_history
     set created_at = base_ts + interval '2 milliseconds'
   where recruitment_case_candidate_id = target_case_candidate_id
     and reason_code = 'who_requested_repair'
     and comment = 'Corrección auditada de rechazo WHO emitido por error. Antecedentes aprobados.';

  update public.recruitment_case_candidate_stage_history
     set created_at = base_ts + interval '3 milliseconds'
   where recruitment_case_candidate_id = target_case_candidate_id
     and reason_code = 'who_approved'
     and comment = 'Corrección auditada de rechazo WHO emitido por error. Antecedentes aprobados.'
     and changed_by = '0de4ef6f-3e52-4bab-8042-ab04ea7763ae';

  update public.recruitment_case_audit_log
     set created_at = base_ts + interval '1 millisecond'
   where recruitment_case_candidate_id = target_case_candidate_id
     and action_type = 'candidate_stage_changed'
     and metadata ->> 'source' = 'versioned_repair';

  update public.recruitment_case_audit_log
     set created_at = base_ts + interval '2 milliseconds'
   where recruitment_case_candidate_id = target_case_candidate_id
     and action_type = 'candidate_stage_approval_requested'
     and metadata ->> 'source' = 'versioned_repair'
     and new_values ->> 'approval_id' = repaired_approval_id::text;

  update public.recruitment_case_audit_log
     set created_at = base_ts + interval '3 milliseconds'
   where recruitment_case_candidate_id = target_case_candidate_id
     and action_type = 'candidate_stage_approval_approved'
     and metadata ->> 'source' = 'versioned_repair'
     and new_values ->> 'approval_id' = repaired_approval_id::text;

  update public.candidate_stage_approvals
     set requested_at = base_ts + interval '2 milliseconds',
         approved_at = base_ts + interval '3 milliseconds',
         created_at = base_ts + interval '2 milliseconds',
         updated_at = base_ts + interval '3 milliseconds'
   where id = repaired_approval_id
     and recruitment_case_candidate_id = target_case_candidate_id;

  update public.recruitment_case_candidates
     set stage_entered_at = base_ts + interval '3 milliseconds',
         updated_at = base_ts + interval '3 milliseconds'
   where id = target_case_candidate_id
     and stage_code = 'who_approved';
end
$$;

commit;
