-- Funciones SQL para ORION Function Calling
-- Se utilizan bajo el modelo de Security Invoker (por defecto) para que ORION solo pueda leer lo que el usuario autenticado tiene permiso de ver según RLS.

-- Función 1: Resumen de Contrataciones Activas
create or replace function public.orion_get_hiring_summary()
returns jsonb
language sql
as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  from (
    select
      job_position_name as "Cargo",
      status as "Estado",
      count(*) as "Total Casos",
      sum(requested_vacancies) as "Total Vacantes Solicitadas",
      sum(filled_vacancies) as "Total Vacantes Llenadas"
    from public.recruitment_cases
    where status not in ('filled', 'closed_unfilled', 'cancelled')
    group by job_position_name, status
    order by count(*) desc
  ) t;
$$;

-- Función 2: Búsqueda del Estado de un Candidato
create or replace function public.orion_search_candidate(
  query_text text
)
returns jsonb
language sql
as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  from (
    select
      cp.full_name as "Nombre Candidato",
      cp.national_id as "RUT",
      rc.title as "Caso de Contratación",
      rc.status as "Estado del Caso",
      rcc.stage_code as "Etapa Actual",
      rcc.suitability_status as "Idoneidad",
      rcc.is_selected as "Seleccionado"
    from public.candidate_profiles cp
    join public.recruitment_case_candidates rcc on rcc.candidate_profile_id = cp.id
    join public.recruitment_cases rc on rc.id = rcc.recruitment_case_id
    where cp.full_name ilike '%' || query_text || '%'
       or cp.national_id ilike '%' || query_text || '%'
    order by cp.full_name, rc.title
    limit 10
  ) t;
$$;
