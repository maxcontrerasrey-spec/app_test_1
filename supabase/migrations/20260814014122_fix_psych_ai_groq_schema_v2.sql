set check_function_bodies = on;

update private.psych_prompt_versions
set is_active = false
where prompt_code = 'psych-ai-interpretation'
  and is_active = true;

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
values (
  'psych-ai-interpretation',
  'psych-ai-prompt-v2',
  'psych-ai-schema-v2',
  'groq',
  'openai/gpt-oss-120b',
  'Eres un asistente técnico de apoyo psicolaboral para el ERP Buses JM. Interpreta únicamente resultados estructurados ya calculados por el ERP. No calcules ni modifiques scores, dimensiones, índices, calidad de respuesta ni ajuste al cargo. No emitas diagnósticos clínicos, aptitud, contratación, rechazo, percentiles ni baremos no entregados. Redacta en español chileno formal, descriptivo y prudente. Toda conclusión es preliminar y requiere revisión profesional. En ipip16.clusters usa exactamente las cuatro claves solicitadas en el schema.',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":["version","executive_summary","response_quality","strengths","development_areas","interview_questions","ipip16","ipc","bis11","prp","integrated_analysis","preliminary_conclusion","limitations","evidence"],
    "properties":{
      "version":{"type":"string"},
      "executive_summary":{"type":"string"},
      "response_quality":{"type":"string"},
      "strengths":{"type":"array","items":{"type":"string"},"minItems":3,"maxItems":6},
      "development_areas":{"type":"array","items":{"type":"string"},"minItems":3,"maxItems":6},
      "interview_questions":{"type":"array","items":{"type":"string"},"minItems":4,"maxItems":8},
      "ipip16":{
        "type":"object",
        "additionalProperties":false,
        "required":["summary","clusters"],
        "properties":{
          "summary":{"type":"string"},
          "clusters":{
            "type":"object",
            "additionalProperties":false,
            "required":["autocontrol_estabilidad","disciplina_estructura","interaccion_laboral","analisis_adaptacion"],
            "properties":{
              "autocontrol_estabilidad":{"type":"string"},
              "disciplina_estructura":{"type":"string"},
              "interaccion_laboral":{"type":"string"},
              "analisis_adaptacion":{"type":"string"}
            }
          }
        }
      },
      "ipc":{"type":"object","additionalProperties":false,"required":["summary","predominant_profile","disc_disclaimer"],"properties":{"summary":{"type":"string"},"predominant_profile":{"type":"string"},"disc_disclaimer":{"type":"string"}}},
      "bis11":{"type":"object","additionalProperties":false,"required":["summary","impulsivity_interpretation"],"properties":{"summary":{"type":"string"},"impulsivity_interpretation":{"type":"string"}}},
      "prp":{"type":"object","additionalProperties":false,"required":["summary","documentation_status"],"properties":{"summary":{"type":"string"},"documentation_status":{"type":"string"}}},
      "integrated_analysis":{"type":"string"},
      "preliminary_conclusion":{"type":"string"},
      "limitations":{"type":"array","items":{"type":"string"},"minItems":3,"maxItems":8},
      "evidence":{"type":"array","items":{"type":"string"},"minItems":4,"maxItems":10}
    }
  }'::jsonb,
  encode(extensions.digest(
    'psych-ai-prompt-v2|psych-ai-schema-v2|openai/gpt-oss-120b|fixed ipip16 clusters properties',
    'sha256'
  ), 'hex'),
  true
)
on conflict (prompt_code, prompt_version, schema_version) do update
set provider = excluded.provider,
    model = excluded.model,
    system_prompt = excluded.system_prompt,
    response_schema = excluded.response_schema,
    content_sha256 = excluded.content_sha256,
    is_active = true;

with invalidated as (
  update private.psych_ai_interpretations i
  set status = 'FAILED',
      last_error = 'Interpretación invalidada: Groq rechazó psych-ai-schema-v1 por JSON Schema dinámico; regenerar con psych-ai-schema-v2.',
      updated_at = timezone('utc', now())
  where i.provider = 'groq'
    and i.status = 'PENDING_REVIEW'
    and (
      i.original_output ->> 'executive_summary' ilike '%groq_400_invalid JSON schema%'
      or exists (
        select 1
        from private.psych_ai_runs r
        where r.interpretation_id = i.id
          and coalesce(r.error_message, '') ilike '%invalid JSON schema%'
      )
    )
  returning i.assessment_id
)
update private.psychometric_assessments a
set ai_status = 'FAILED',
    ai_updated_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
where a.id in (select assessment_id from invalidated);

notify pgrst, 'reload schema';
