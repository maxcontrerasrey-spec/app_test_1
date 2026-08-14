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
  'psych-ai-prompt-v3',
  'psych-ai-schema-v3',
  'groq',
  'openai/gpt-oss-120b',
  'Eres un asistente técnico de apoyo psicolaboral para el ERP Buses JM. El ERP ya determinó scores, niveles descriptivos, clasificaciones, evidencia e intensidad máxima permitida. Tu tarea es redactar, no interpretar libremente. Reglas obligatorias: no cambies intensidad semántica entregada por el ERP; INTERMEDIO_EN_RANGO_TEORICO no puede convertirse en alto, bajo, elevado, deficiente, crítico ni severo; SOBRE_EL_PROMEDIO debe conservar esa intensidad exacta; criticidad del cargo no significa resultado crítico; no confundas ausencia de score alto con debilidad; no uses por encima/debajo del promedio salvo clasificación normativa documentada; no interpretes PRP si está PROFESSIONAL_ONLY; toda fortaleza, aspecto y pregunta requiere evidence_ids válidos; no pongas recomendaciones metodológicas en fortalezas; no presumas conductas negativas en preguntas; no recomiendes tratamiento ni intervención psicológica; no conviertas resultados en diagnóstico, causalidad, predicción de accidentes, aptitud, rechazo ni contratación; ante incertidumbre, reduce intensidad. Redacta en español chileno formal, prudente y operacional.',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":["profile_summary","strengths","points_to_explore","instrument_analysis","integrated_analysis","interview_questions","preliminary_conclusion","recommendations","limitations"],
    "properties":{
      "profile_summary":{"type":"string"},
      "strengths":{
        "type":"array",
        "minItems":0,
        "maxItems":5,
        "items":{
          "type":"object",
          "additionalProperties":false,
          "required":["title","text","evidence_ids"],
          "properties":{
            "title":{"type":"string"},
            "text":{"type":"string"},
            "evidence_ids":{"type":"array","minItems":1,"maxItems":4,"items":{"type":"string"}}
          }
        }
      },
      "points_to_explore":{
        "type":"array",
        "minItems":1,
        "maxItems":6,
        "items":{
          "type":"object",
          "additionalProperties":false,
          "required":["title","text","evidence_ids"],
          "properties":{
            "title":{"type":"string"},
            "text":{"type":"string"},
            "evidence_ids":{"type":"array","minItems":1,"maxItems":4,"items":{"type":"string"}}
          }
        }
      },
      "instrument_analysis":{
        "type":"object",
        "additionalProperties":false,
        "required":["ipip16","ipip_ipc","bis11","prp"],
        "properties":{
          "ipip16":{"type":"string"},
          "ipip_ipc":{"type":"string"},
          "bis11":{"type":"string"},
          "prp":{"type":"string"}
        }
      },
      "integrated_analysis":{"type":"string"},
      "interview_questions":{
        "type":"array",
        "minItems":4,
        "maxItems":8,
        "items":{
          "type":"object",
          "additionalProperties":false,
          "required":["question","target","evidence_ids"],
          "properties":{
            "question":{"type":"string"},
            "target":{"type":"string"},
            "evidence_ids":{"type":"array","minItems":1,"maxItems":4,"items":{"type":"string"}}
          }
        }
      },
      "preliminary_conclusion":{"type":"string"},
      "recommendations":{"type":"array","minItems":0,"maxItems":4,"items":{"type":"string"}},
      "limitations":{"type":"array","minItems":2,"maxItems":8,"items":{"type":"string"}}
    }
  }'::jsonb,
  encode(extensions.digest(
    'psych-ai-prompt-v3|psych-ai-schema-v3|semantic meaning determined by ERP|evidence ids required|prp hard lock|bis11 lock',
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

notify pgrst, 'reload schema';
