-- EEES-DB-005: approved
-- owner: Recursos Humanos / Gobierno de remuneraciones
-- rollback: forward-only; restaurar la versión anterior mediante una migración posterior.

begin;

create or replace function public.save_hr_rent_structure_config(
  p_contract_id bigint,
  p_job_position_id bigint,
  p_authorized_headcount integer,
  p_lines jsonb,
  p_afp_code text,
  p_health_mode text,
  p_health_provider_name text,
  p_health_plan_value numeric,
  p_unemployment_contract_type text,
  p_include_income_tax boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  current_user_id uuid := auth.uid();
  target_structure_id uuid;
begin
  target_structure_id := public.save_hr_rent_structure_config(
    p_contract_id,
    p_job_position_id,
    p_authorized_headcount,
    p_lines,
    p_afp_code,
    p_health_mode,
    p_health_provider_name,
    p_health_plan_value,
    p_unemployment_contract_type
  );

  update public.hr_rent_structures structure_row
  set include_income_tax = coalesce(p_include_income_tax, false),
      updated_at = timezone('utc', now())
  where structure_row.id = target_structure_id;

  update public.hr_rent_structure_audit audit_row
  set snapshot = jsonb_set(
    audit_row.snapshot,
    '{legal_scenario,include_income_tax}',
    to_jsonb(coalesce(p_include_income_tax, false)),
    true
  )
  where audit_row.id = (
    select latest_audit.id
    from public.hr_rent_structure_audit latest_audit
    where latest_audit.structure_id = target_structure_id
      and latest_audit.changed_by = current_user_id
    order by latest_audit.changed_at desc, latest_audit.id desc
    limit 1
  );

  return target_structure_id;
end;
$function$;

revoke all on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean) from public, anon;
grant execute on function public.save_hr_rent_structure_config(bigint, bigint, integer, jsonb, text, text, text, numeric, text, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
