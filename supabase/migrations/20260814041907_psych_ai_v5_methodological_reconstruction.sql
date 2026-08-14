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
  'psych-ai-prompt-v5',
  'psych-ai-schema-v5',
  'openai',
  'gpt-5-mini',
  'Eres un asistente especializado en análisis psicolaboral integrado para el ERP Buses JM. Interpreta exclusivamente resultados ya calculados por el ERP, metodología versionada, perfil de cargo y calidad de respuesta. El ERP calcula; GPT-5 mini interpreta. No recalcules scores, no inviertas ítems, no inventes baremos, percentiles, eneatipos, factores PRP, diagnósticos clínicos ni decisiones APTO/NO APTO. No presentes IPIP-16 como 16PF propietario ni IPIP-IPC como DISC o Everything DiSC. Si automatic_interpretation_allowed=true, interpreta activamente ese instrumento en forma descriptiva. Si una dimensión o factor no tiene significado documentado, omite solo esa parte, no bloquees todo el informe. La ausencia de baremo local no impide interpretación descriptiva. Distingue medición directa, inferencia laboral y relevancia para el cargo. Redacta para RR.HH. o profesional laboral en español de Chile, con tono claro, ejecutivo, profundo y no clínico. Evita códigos internos, evidence IDs, estados técnicos y disclaimers repetidos. La advertencia metodológica debe quedar solo como limitación breve final.',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":[
      "executive_profile",
      "personality_profile",
      "interpersonal_profile",
      "safety_and_impulse_profile",
      "job_fit_analysis",
      "strengths",
      "points_to_explore",
      "interview_questions",
      "integrated_conclusion",
      "material_limitations"
    ],
    "properties":{
      "executive_profile":{"type":"string"},
      "personality_profile":{
        "type":"object",
        "additionalProperties":false,
        "required":["summary","self_regulation","discipline_structure","interpersonal_style","adaptability_thinking"],
        "properties":{
          "summary":{"type":"string"},
          "self_regulation":{"type":"string"},
          "discipline_structure":{"type":"string"},
          "interpersonal_style":{"type":"string"},
          "adaptability_thinking":{"type":"string"}
        }
      },
      "interpersonal_profile":{
        "type":"object",
        "additionalProperties":false,
        "required":["summary","communication","cooperation","initiative","response_under_pressure"],
        "properties":{
          "summary":{"type":"string"},
          "communication":{"type":"string"},
          "cooperation":{"type":"string"},
          "initiative":{"type":"string"},
          "response_under_pressure":{"type":"string"}
        }
      },
      "safety_and_impulse_profile":{
        "type":"object",
        "additionalProperties":false,
        "required":["summary","bis11","prp","combined_interpretation"],
        "properties":{
          "summary":{"type":"string"},
          "bis11":{"type":"string"},
          "prp":{"type":"string"},
          "combined_interpretation":{"type":"string"}
        }
      },
      "job_fit_analysis":{"type":"string"},
      "strengths":{
        "type":"array",
        "items":{
          "type":"object",
          "additionalProperties":false,
          "required":["title","text"],
          "properties":{
            "title":{"type":"string"},
            "text":{"type":"string"}
          }
        }
      },
      "points_to_explore":{
        "type":"array",
        "items":{
          "type":"object",
          "additionalProperties":false,
          "required":["title","text"],
          "properties":{
            "title":{"type":"string"},
            "text":{"type":"string"}
          }
        }
      },
      "interview_questions":{
        "type":"array",
        "items":{
          "type":"object",
          "additionalProperties":false,
          "required":["question","target"],
          "properties":{
            "question":{"type":"string"},
            "target":{"type":"string"}
          }
        }
      },
      "integrated_conclusion":{"type":"string"},
      "material_limitations":{
        "type":"array",
        "items":{"type":"string"}
      }
    }
  }'::jsonb,
  encode(extensions.digest(
    'psych-ai-prompt-v5|psych-ai-schema-v5|openai|gpt-5-mini|methodological integrated report',
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
