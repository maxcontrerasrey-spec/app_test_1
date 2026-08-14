begin;

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
  'psych-ai-prompt-v5.4',
  'psych-ai-schema-v5.4',
  'openai',
  'gpt-5.6-luna',
  'Psych V5.4. Redactar un informe psicolaboral profesional, natural, sobrio y objetivo. No exponer mecanismo tecnologico, IA, modelos, proveedores, prompts, schemas, automatizacion, confianza del modelo, fallback, guardrails ni versiones tecnicas en el contenido entregable. Mantener scoring ERP como fuente de verdad, ponderar criticidad real del cargo, no compensar brechas criticas con fortalezas secundarias, no convertir resultados intermedios en fortalezas, abstenerse de interpretar PRP sin sustento metodologico y no inventar baremos, conducta observada, diagnosticos ni antecedentes inexistentes.',
  '{
    "type":"object",
    "additionalProperties":false,
    "required":["recommendation","recommendation_confidence","critical_strengths","critical_gaps","critical_uncertainties","decision_rationale","executive_profile","personality_profile","interpersonal_profile","safety_and_impulse_profile","job_fit_analysis","strengths","points_to_explore","interview_questions","integrated_conclusion","material_limitations"],
    "properties":{
      "recommendation":{"type":"string","enum":["RECOMENDADO","RECOMENDADO_CON_OBSERVACIONES","REQUIERE_PROFUNDIZACION","NO_RECOMENDADO"]},
      "recommendation_confidence":{"type":"string","enum":["BAJA","MEDIA","ALTA"]},
      "critical_strengths":{"type":"array","minItems":0,"maxItems":4,"items":{"type":"string"}},
      "critical_gaps":{"type":"array","minItems":0,"maxItems":4,"items":{"type":"string"}},
      "critical_uncertainties":{"type":"array","minItems":0,"maxItems":5,"items":{"type":"string"}},
      "decision_rationale":{"type":"string"},
      "executive_profile":{"type":"string"},
      "personality_profile":{"type":"object","additionalProperties":false,"required":["summary","self_regulation","discipline_structure","interpersonal_style","adaptability_thinking"],"properties":{"summary":{"type":"string"},"self_regulation":{"type":"string"},"discipline_structure":{"type":"string"},"interpersonal_style":{"type":"string"},"adaptability_thinking":{"type":"string"}}},
      "interpersonal_profile":{"type":"object","additionalProperties":false,"required":["summary","communication","cooperation","initiative","response_under_pressure"],"properties":{"summary":{"type":"string"},"communication":{"type":"string"},"cooperation":{"type":"string"},"initiative":{"type":"string"},"response_under_pressure":{"type":"string"}}},
      "safety_and_impulse_profile":{"type":"object","additionalProperties":false,"required":["summary","bis11","prp","combined_interpretation"],"properties":{"summary":{"type":"string"},"bis11":{"type":"string"},"prp":{"type":"string"},"combined_interpretation":{"type":"string"}}},
      "job_fit_analysis":{"type":"string"},
      "strengths":{"type":"array","minItems":0,"maxItems":4,"items":{"type":"object","additionalProperties":false,"required":["title","text"],"properties":{"title":{"type":"string"},"text":{"type":"string"}}}},
      "points_to_explore":{"type":"array","minItems":0,"maxItems":5,"items":{"type":"object","additionalProperties":false,"required":["title","text"],"properties":{"title":{"type":"string"},"text":{"type":"string"}}}},
      "interview_questions":{"type":"array","minItems":3,"maxItems":5,"items":{"type":"object","additionalProperties":false,"required":["question","target"],"properties":{"question":{"type":"string"},"target":{"type":"string"}}}},
      "integrated_conclusion":{"type":"string"},
      "material_limitations":{"type":"array","minItems":0,"maxItems":2,"items":{"type":"string"}}
    }
  }'::jsonb,
  encode(extensions.digest(
    'psych-ai-prompt-v5.4|psych-ai-schema-v5.4|openai|gpt-5.6-luna|humanized report content without automation language',
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

commit;
