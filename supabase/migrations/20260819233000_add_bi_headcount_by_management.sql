-- Dotación BI agrupada por gerencia usando el catálogo corporativo BUK.
-- La dimensión se resuelve en backend para mantener consistencia entre períodos
-- actuales e históricos y no exponer tablas de soporte directamente al cliente.

create or replace function public.get_bi_headcount_by_management(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  management_name text,
  headcount bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.user_can_access_bi_analytics(current_user_id) then
    raise exception 'Sin permisos para consultar BI';
  end if;

  return query
  with population as (
    select *
    from public.get_bi_employee_population(p_period_code, p_contract_codes, p_job_titles)
  )
  select
    coalesce(
      nullif(trim(mapping.cost_center_name), ''),
      'SIN GERENCIA'
    ) as management_name,
    count(*)::bigint as headcount
  from population
  left join public.buk_contract_mappings mapping
    on mapping.buk_area_name_normalized = public.normalize_buk_area_name(population.area_name)
  group by 1
  order by headcount desc, management_name asc;
end;
$function$;

revoke all on function public.get_bi_headcount_by_management(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_headcount_by_management(text, text[], text[]) to authenticated;

notify pgrst, 'reload schema';
