-- Dotación BI por región de residencia/trabajador.
-- La región se toma del mismo campo extraído desde BUK al crear/actualizar
-- personas y se canoniza a los nombres exactos del GeoJSON del mapa de Chile.

create or replace function public.normalize_bi_region_name(p_region text)
returns text
language sql
immutable
set search_path = public
as $function$
  with normalized as (
    select public.normalize_buk_area_name(p_region) as value
  )
  select case
    when value is null or value = '' then 'SIN REGION'
    when value like '%ARICA%' or value like '%PARINACOTA%' then 'Región de Arica y Parinacota'
    when value like '%TARAPACA%' then 'Región de Tarapacá'
    when value like '%ANTOFAGASTA%' then 'Región de Antofagasta'
    when value like '%ATACAMA%' then 'Región de Atacama'
    when value like '%COQUIMBO%' then 'Región de Coquimbo'
    when value like '%VALPARAISO%' then 'Región de Valparaíso'
    when value like '%METROPOLITANA%' or value like '%SANTIAGO%' then 'Región Metropolitana de Santiago'
    when value like '%OHIGGINS%' or value like '%LIBERTADOR%' then 'Región del Libertador Bernardo O''Higgins'
    when value like '%MAULE%' then 'Región del Maule'
    when value like '%BIOBIO%' or value like '%BIO-BIO%' or value like '%BIO BIO%' then 'Región del Bío-Bío'
    when value like '%ARAUCANIA%' then 'Región de La Araucanía'
    when value like '%LOS RIOS%' then 'Región de Los Ríos'
    when value like '%LOS LAGOS%' then 'Región de Los Lagos'
    when value like '%AYSEN%' or value like '%IBANEZ%' then 'Región de Aysén del Gral.Ibañez del Campo'
    when value like '%MAGALLANES%' then 'Región de Magallanes y Antártica Chilena'
    when value like '%NUBLE%' then 'Región de Ñuble'
    else 'SIN REGION'
  end
  from normalized;
$function$;

create or replace function public.get_bi_headcount_by_region(
  p_period_code text default null,
  p_contract_codes text[] default null,
  p_job_titles text[] default null
)
returns table (
  region_name text,
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
    public.normalize_bi_region_name(population.region_name) as region_name,
    count(*)::bigint as headcount
  from population
  group by 1
  order by headcount desc, region_name asc;
end;
$function$;

revoke all on function public.normalize_bi_region_name(text) from public, anon, authenticated;
revoke all on function public.get_bi_headcount_by_region(text, text[], text[]) from public, anon;
grant execute on function public.get_bi_headcount_by_region(text, text[], text[]) to authenticated;

notify pgrst, 'reload schema';
