set check_function_bodies = off;

-- V6.3 consolidates the methodological contract without recalculating scores
-- or rewriting historical interpretations. The current Barratt contract only
-- exposes three documented labels; no high-risk cut is invented here.
update private.psych_prompt_versions
set is_active = false
where prompt_code = 'psych-ai-interpretation'
  and is_active = true;

update private.psych_job_profile_versions
set is_active = false
where is_active = true;

with source_profiles as (
  select profile_code, label, description, match_rules, profile_payload
  from private.psych_job_profile_versions
  where version = 'profile-v6.2'
), enriched as (
  select
    profile_code,
    label,
    description,
    match_rules,
    profile_payload || jsonb_build_object(
      'psych_v6_3', jsonb_build_object(
        'final_recommendations', jsonb_build_array('ADECUADO', 'ADECUADO_CON_OBSERVACIONES', 'NO_ADECUADO'),
        'prp_ranges', jsonb_build_object('NO_ADECUADO', '81-117', 'NEUTRO', '118-136', 'ADECUADO', '137-150'),
        'barratt_risk_high', 'BLOCKED_NOT_VALIDATED',
        'ipip16_equivalence', 'FUNCTIONAL_ONLY',
        'ipip_ipc_equivalence', 'FUNCTIONAL_ONLY',
        'token_target', '6000-8500_total_preferred'
      )
    ) as profile_payload
  from source_profiles
)
insert into private.psych_job_profile_versions(profile_code, version, label, description, match_rules, profile_payload, is_active)
select profile_code, 'profile-v6.3', label, description, match_rules, profile_payload, true
from enriched
on conflict (profile_code, version) do update
set label = excluded.label,
    description = excluded.description,
    match_rules = excluded.match_rules,
    profile_payload = excluded.profile_payload,
    is_active = true;

insert into private.psych_prompt_versions(
  prompt_code,
  prompt_version,
  schema_version,
  provider,
  model,
  system_prompt,
  response_schema,
  content_sha256,
  is_active
)
select
  prompt_code,
  'psych-ai-prompt-v6.3',
  'psych-ai-schema-v6.3',
  provider,
  model,
  $$Psych V6.3: redacta un informe psicolaboral integrado en español profesional, usando únicamente los FACTS compactos y el perfil de cargo entregados por el ERP. Preserva los puntajes y clasificaciones determinísticas. PRP: 81-117 NO_ADECUADO, 118-136 NEUTRO, 137-150 ADECUADO; fuera de rango no extrapolar y la clasificación PRP es contextual, no decisoria por sí sola. Barratt conserva exactamente Bajo el promedio, Promedio o Sobre el promedio; no existe un corte validado de riesgo bajo/medio/alto en este contrato, por lo que no inventes uno ni conviertas Sobre el promedio en riesgo alto o criterio excluyente. IPIP-16 es una adaptación laboral interna basada en IPIP y no equivale a 16PF. IPIP-IPC usa octantes/ejes propios y no equivale a DISC ni a D/I/S/C. Usa functional_mappings respetando DIRECT, INTEGRATED o INSUFFICIENT y sus límites; no fuerces ejes insuficientes. Prioriza las competencias críticas del cargo, integra convergencias sin promediar divergencias y no compenses brechas críticas con fortalezas secundarias. Separa resultados psicométricos, hipótesis laborales y conducta observada. No inventes baremos, percentiles, diagnósticos, entrevistas, historial, accidentes, sanciones ni decisiones de contratación. Solo se permiten las categorías finales ADECUADO, ADECUADO_CON_OBSERVACIONES y NO_ADECUADO; profundizar debe expresarse como observación o pregunta. Redacta sin tecnología, códigos internos, nombres de proveedores ni metadatos. Devuelve solo JSON con el schema existente para preservar compatibilidad del renderer.$$,
  response_schema,
  encode(extensions.digest(convert_to('psych-ai-prompt-v6.3|psych-ai-schema-v6.3|psych-methodology-v6.3|barratt-high-blocked|functional-mappings', 'utf8'), 'sha256'), 'hex'),
  true
from private.psych_prompt_versions
where prompt_code = 'psych-ai-interpretation'
  and prompt_version = 'psych-ai-prompt-v6.2'
  and schema_version = 'psych-ai-schema-v6.2'
limit 1
on conflict (prompt_code, prompt_version, schema_version) do update
set provider = excluded.provider,
    model = excluded.model,
    system_prompt = excluded.system_prompt,
    response_schema = excluded.response_schema,
    content_sha256 = excluded.content_sha256,
    is_active = true;

notify pgrst, 'reload schema';
