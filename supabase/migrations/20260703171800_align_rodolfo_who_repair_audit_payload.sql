begin;

do $$
declare
  target_case_candidate_id uuid := 'ef4064a2-d076-4258-9691-2d270e3c7d0b';
  repaired_approval_id bigint := 84;
  approved_ts timestamptz := '2026-07-03T17:26:07.003137+00:00'::timestamptz;
begin
  if not exists (
    select 1
      from public.recruitment_case_candidates rcc
     where rcc.id = target_case_candidate_id
  ) then
    raise notice 'Skipping Rodolfo WHO audit payload alignment: target candidate % not found in this environment', target_case_candidate_id;
    return;
  end if;

  if not exists (
    select 1
      from public.candidate_stage_approvals csa
     where csa.id = repaired_approval_id
       and csa.recruitment_case_candidate_id = target_case_candidate_id
  ) then
    raise notice 'Skipping Rodolfo WHO audit payload alignment: repaired approval % not found for candidate %', repaired_approval_id, target_case_candidate_id;
    return;
  end if;

  update public.recruitment_case_audit_log
     set new_values = jsonb_set(
       new_values,
       '{approved_at}',
       to_jsonb(approved_ts),
       true
     )
   where recruitment_case_candidate_id = target_case_candidate_id
     and action_type = 'candidate_stage_approval_approved'
     and metadata ->> 'source' = 'versioned_repair'
     and new_values ->> 'approval_id' = repaired_approval_id::text;

  update public.candidate_stage_approvals
     set updated_at = approved_ts
   where id = repaired_approval_id
     and recruitment_case_candidate_id = target_case_candidate_id;

  update public.recruitment_case_candidates
     set updated_at = approved_ts
   where id = target_case_candidate_id
     and stage_code = 'who_approved';
end
$$;

commit;
