-- EEES-DB-005: approved
-- owner: Human Resources
-- rollback: forward-only; preserve contracted state and contingency evidence.
begin;

do $migration$
declare
  v_definition text;
  v_before text;
  v_after text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'get_recruitment_personnel_page_bucket'
     and pg_get_function_identity_arguments(p.oid) = 'p_search text, p_limit integer, p_offset integer, p_stage_code text';

  if v_definition is null then
    raise exception 'No existe la RPC get_recruitment_personnel_page_bucket';
  end if;

  v_before := $$    ) as successful_buk_job on true
    left join lateral (
      select *
      from public.get_recruitment_case_buk_capacity_snapshot($$;
  v_after := $$    ) as successful_buk_job on true
    left join lateral (
      select
        external_hire.employee_buk_employee_id,
        external_hire.hired_at,
        external_hire.created_at
      from public.recruitment_case_external_hires external_hire
      where external_hire.recruitment_case_id = rcc.recruitment_case_id
        and external_hire.recruitment_case_candidate_id = rcc.id
      order by coalesce(external_hire.hired_at, external_hire.created_at) desc, external_hire.id desc
      limit 1
    ) as external_buk_hire on true
    left join lateral (
      select *
      from public.get_recruitment_case_buk_capacity_snapshot($$;

  if position(v_before in v_definition) = 0 then
    raise exception 'La RPC no tiene el punto de insercion esperado para evidencia BUK contingente';
  end if;
  v_definition := replace(v_definition, v_before, v_after);

  v_before := $$        'buk_generated_at', successful_buk_job.generated_at,
        'buk_employee_id', successful_buk_job.buk_employee_id,
        'has_buk_generation_success', successful_buk_job.id is not null,$$;
  v_after := $$        'buk_generated_at', coalesce(successful_buk_job.generated_at, external_buk_hire.hired_at, external_buk_hire.created_at),
        'buk_employee_id', coalesce(successful_buk_job.buk_employee_id, external_buk_hire.employee_buk_employee_id),
        'has_buk_generation_success', successful_buk_job.id is not null or external_buk_hire.employee_buk_employee_id is not null,$$;

  if position(v_before in v_definition) = 0 then
    raise exception 'La RPC no tiene el contrato esperado de salida BUK';
  end if;
  v_definition := replace(v_definition, v_before, v_after);

  v_before := $$          and successful_buk_job.id is not null$$;
  v_after := $$          and (successful_buk_job.id is not null or external_buk_hire.employee_buk_employee_id is not null)$$;

  if position(v_before in v_definition) = 0 then
    raise exception 'La RPC no tiene el guard esperado de contratados';
  end if;
  v_definition := replace(v_definition, v_before, v_after);

  execute v_definition;
end;
$migration$;

create or replace function public.get_recruitment_contracted_personnel_page(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
security definer
set search_path = public
as $function$
  select public.get_recruitment_personnel_page_bucket(
    p_search,
    p_limit,
    p_offset,
    'hired'
  );
$function$;

revoke all on function public.get_recruitment_contracted_personnel_page(text, integer, integer)
  from public, anon;
grant execute on function public.get_recruitment_contracted_personnel_page(text, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
