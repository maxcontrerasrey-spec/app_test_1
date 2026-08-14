set check_function_bodies = off;

update private.psych_job_profile_versions
set is_active = false
where is_active = true;

with profiles(profile_code, label, description, match_rules, profile_payload) as (
  values
  ('CONDUCCION','Conducción operacional','Cargos de conducción, traslado de pasajeros, buses, furgones, minibuses, camiones y operación móvil.',
   '[{"field":"job_position_name","contains":["CONDUCTOR","CHOFER","BUS","BUSES","FURGON","FURGÓN","MINIBUS","MINIBÚS","CAMION","CAMIÓN","OPERADOR"]}]'::jsonb,
   '{
     "job_family":"CONDUCCION_OPERACIONAL",
     "critical_competencies":[
       {"competency":"Seguridad y autocontrol","evidence_focus":["BARRATT_BIS11_30","IPIP16_EST","IPIP16_TEN","IPIP16_CAU"]},
       {"competency":"Control de impulsividad","evidence_focus":["BARRATT_BIS11_30"]},
       {"competency":"Adherencia a normas y procedimientos","evidence_focus":["IPIP16_CUM","IPIP16_ORD","IPIP16_CAU"]}
     ],
     "high_competencies":[
       {"competency":"Decisión bajo presión","evidence_focus":["IPIP16_EST","IPIP16_TEN","BARRATT_BIS11_30"]},
       {"competency":"Estabilidad emocional","evidence_focus":["IPIP16_EST","IPIP16_TEN","IPIP16_APR"]},
       {"competency":"Orden y disciplina operacional","evidence_focus":["IPIP16_ORD","IPIP16_CUM"]},
       {"competency":"Atención/rutina operacional","evidence_focus":["IPIP16_ORD","IPIP16_CAU"]}
     ],
     "medium_competencies":[
       {"competency":"Adaptabilidad ante contingencias","evidence_focus":["IPIP16_ANA","IPIP16_APE","IPIP16_EST"]},
       {"competency":"Trato con pasajeros","evidence_focus":["IPIP16_CAL","IPIP_IPC_32"]},
       {"competency":"Cooperación","evidence_focus":["IPIP_IPC_32","IPIP16_CAL"]}
     ],
     "low_relevance_competencies":[
       {"competency":"Liderazgo"},
       {"competency":"Creatividad"}
     ],
     "critical_context":["seguridad y autocontrol","control de impulsividad","adherencia a normas y procedimientos","decisión bajo presión","rutina operacional"],
     "risk_watch":["impulsividad sobre el promedio en BIS-11","cumplimiento normativo bajo","tensión elevada","baja cautela interpersonal"],
     "interview_focus":["manejo de presión en conducción","respuesta ante instrucciones contradictorias","cumplimiento de procedimiento crítico","historial operacional verificable"],
     "decision_rules":{"middle_results_default":"NEUTRAL","prp_decision_weight":0,"critical_over_secondary":true}
   }'::jsonb),
  ('SUPERVISION','Supervisión y coordinación','Roles con coordinación de equipos, control operativo o jefatura directa.',
   '[{"field":"job_position_name","contains":["SUPERVISOR","JEFE","COORDINADOR","ENCARGADO"]}]'::jsonb,
   '{
     "job_family":"SUPERVISION_COORDINACION",
     "critical_competencies":[
       {"competency":"Comunicación y seguimiento","evidence_focus":["IPIP_IPC_32","IPIP16_CUM","IPIP16_ORD"]},
       {"competency":"Regulación bajo presión","evidence_focus":["IPIP16_EST","IPIP16_TEN","BARRATT_BIS11_30"]}
     ],
     "high_competencies":[
       {"competency":"Criterio de priorización","evidence_focus":["IPIP16_ANA","IPIP16_CAU"]},
       {"competency":"Manejo de conflicto","evidence_focus":["IPIP_IPC_32","IPIP16_ASE","IPIP16_CAL"]}
     ],
     "medium_competencies":[
       {"competency":"Liderazgo operativo","evidence_focus":["IPIP_IPC_32","IPIP16_ASE"]},
       {"competency":"Orden administrativo","evidence_focus":["IPIP16_ORD","IPIP16_CUM"]}
     ],
     "low_relevance_competencies":[{"competency":"Creatividad estética"}],
     "critical_context":["comunicación clara","regulación bajo presión","seguimiento de normas"],
     "risk_watch":["dominancia rígida","baja escucha","tensión sostenida"],
     "interview_focus":["retroalimentación difícil","decisiones bajo presión","escalamiento de riesgos"],
     "decision_rules":{"middle_results_default":"NEUTRAL","prp_decision_weight":0,"critical_over_secondary":true}
   }'::jsonb),
  ('MANTENIMIENTO','Mantenimiento','Roles técnicos de mantenimiento, mecánica, electricidad y soporte operacional.',
   '[{"field":"job_position_name","contains":["MECANICO","MECÁNICO","ELECTRICO","ELÉCTRICO","MANTENIMIENTO","TECNICO","TÉCNICO"]}]'::jsonb,
   '{
     "job_family":"MANTENIMIENTO_TECNICO",
     "critical_competencies":[
       {"competency":"Seguimiento de procedimiento seguro","evidence_focus":["IPIP16_CUM","IPIP16_CAU","IPIP16_ORD"]},
       {"competency":"Autocontrol preventivo","evidence_focus":["BARRATT_BIS11_30","IPIP16_EST","IPIP16_TEN"]}
     ],
     "high_competencies":[
       {"competency":"Orden técnico","evidence_focus":["IPIP16_ORD","IPIP16_ANA"]},
       {"competency":"Reporte de anomalías","evidence_focus":["IPIP16_CAU","IPIP_IPC_32"]}
     ],
     "medium_competencies":[{"competency":"Cooperación operativa","evidence_focus":["IPIP_IPC_32","IPIP16_CAL"]}],
     "low_relevance_competencies":[{"competency":"Liderazgo formal"}],
     "critical_context":["orden técnico","atención al detalle","seguimiento de procedimiento","reporte de anomalías"],
     "risk_watch":["improvisación riesgosa","baja planificación","tolerancia excesiva a fallas"],
     "interview_focus":["bloqueo de equipo inseguro","trabajo con checklist","errores detectados tarde"],
     "decision_rules":{"middle_results_default":"NEUTRAL","prp_decision_weight":0,"critical_over_secondary":true}
   }'::jsonb),
  ('HSEC','Prevención y HSEC','Roles de prevención, seguridad, salud ocupacional y control documental HSEC.',
   '[{"field":"job_position_name","contains":["PREVENCION","PREVENCIÓN","HSEC","SEGURIDAD","RIESGOS"]}]'::jsonb,
   '{
     "job_family":"PREVENCION_HSEC",
     "critical_competencies":[
       {"competency":"Criterio preventivo","evidence_focus":["IPIP16_CAU","IPIP16_CUM","IPIP16_ANA"]},
       {"competency":"Firmeza comunicacional","evidence_focus":["IPIP_IPC_32","IPIP16_ASE"]},
       {"competency":"Adherencia normativa","evidence_focus":["IPIP16_CUM","IPIP16_ORD"]}
     ],
     "high_competencies":[{"competency":"Regulación bajo presión","evidence_focus":["IPIP16_EST","IPIP16_TEN","BARRATT_BIS11_30"]}],
     "medium_competencies":[{"competency":"Cooperación","evidence_focus":["IPIP_IPC_32","IPIP16_CAL"]}],
     "low_relevance_competencies":[{"competency":"Creatividad"}],
     "critical_context":["influencia normativa","criterio preventivo","firmeza comunicacional","registro documental"],
     "risk_watch":["baja asertividad","flexibilidad excesiva con normas","dificultad para intervenir"],
     "interview_focus":["detención de trabajos","manejo de resistencia","comunicación de hallazgos"],
     "decision_rules":{"middle_results_default":"NEUTRAL","prp_decision_weight":0,"critical_over_secondary":true}
   }'::jsonb),
  ('ADMINISTRACION','Administración','Roles administrativos, soporte, control documental y gestión interna.',
   '[{"field":"job_position_name","contains":["ADMINISTRATIVO","ASISTENTE","ANALISTA","CONTROL DOCUMENTAL"]}]'::jsonb,
   '{
     "job_family":"ADMINISTRACION",
     "critical_competencies":[
       {"competency":"Orden y confiabilidad","evidence_focus":["IPIP16_ORD","IPIP16_CUM"]},
       {"competency":"Seguimiento de pendientes","evidence_focus":["IPIP16_CAU","IPIP16_ANA"]}
     ],
     "high_competencies":[{"competency":"Comunicación interna","evidence_focus":["IPIP_IPC_32","IPIP16_CAL"]}],
     "medium_competencies":[{"competency":"Manejo de volumen","evidence_focus":["IPIP16_EST","IPIP16_TEN"]}],
     "low_relevance_competencies":[{"competency":"Liderazgo"}],
     "critical_context":["orden","confiabilidad","comunicación interna","seguimiento de pendientes"],
     "risk_watch":["baja estructura","desorganización","evitación de coordinación"],
     "interview_focus":["manejo de volumen","errores administrativos","priorización"],
     "decision_rules":{"middle_results_default":"NEUTRAL","prp_decision_weight":0,"critical_over_secondary":true}
   }'::jsonb),
  ('LIDERAZGO','Liderazgo','Roles de conducción estratégica, liderazgo transversal o responsabilidad gerencial.',
   '[{"field":"job_position_name","contains":["GERENTE","DIRECTOR","SUBGERENTE","LIDER","LÍDER"]}]'::jsonb,
   '{
     "job_family":"LIDERAZGO",
     "critical_competencies":[
       {"competency":"Criterio estratégico y regulación","evidence_focus":["IPIP16_ANA","IPIP16_EST","IPIP16_TEN"]},
       {"competency":"Influencia responsable","evidence_focus":["IPIP_IPC_32","IPIP16_ASE","IPIP16_CAL"]}
     ],
     "high_competencies":[{"competency":"Decisión con información incompleta","evidence_focus":["BARRATT_BIS11_30","IPIP16_CAU"]}],
     "medium_competencies":[{"competency":"Lectura organizacional","evidence_focus":["IPIP_IPC_32"]}],
     "low_relevance_competencies":[{"competency":"Rutina operacional repetitiva"}],
     "critical_context":["criterio estratégico","influencia","regulación emocional","lectura organizacional"],
     "risk_watch":["dominancia sin escucha","decisiones impulsivas","baja adaptación"],
     "interview_focus":["dilemas éticos","conflictos entre áreas","decisiones con información incompleta"],
     "decision_rules":{"middle_results_default":"NEUTRAL","prp_decision_weight":0,"critical_over_secondary":true}
   }'::jsonb),
  ('GENERAL','Perfil general','Perfil por defecto cuando el cargo no calza con una familia específica.',
   '[]'::jsonb,
   '{
     "job_family":"GENERAL",
     "critical_competencies":[
       {"competency":"Calidad y consistencia de respuesta","evidence_focus":["quality"]},
       {"competency":"Regulación general","evidence_focus":["IPIP16_EST","IPIP16_TEN","BARRATT_BIS11_30"]}
     ],
     "high_competencies":[{"competency":"Adherencia a normas","evidence_focus":["IPIP16_CUM","IPIP16_ORD"]}],
     "medium_competencies":[{"competency":"Interacción laboral","evidence_focus":["IPIP_IPC_32","IPIP16_CAL"]}],
     "low_relevance_competencies":[{"competency":"Creatividad"}],
     "critical_context":["calidad de respuesta","estabilidad general","interacción laboral","adherencia a normas"],
     "risk_watch":["patrones extremos","inconsistencia","baja variabilidad"],
     "interview_focus":["motivación por el cargo","experiencia previa","situaciones de presión"],
     "decision_rules":{"middle_results_default":"NEUTRAL","prp_decision_weight":0,"critical_over_secondary":true}
   }'::jsonb)
)
insert into private.psych_job_profile_versions(profile_code, version, label, description, match_rules, profile_payload, is_active)
select profile_code, 'profile-v5.3', label, description, match_rules, profile_payload, true
from profiles
on conflict (profile_code, version) do update
set label = excluded.label,
    description = excluded.description,
    match_rules = excluded.match_rules,
    profile_payload = excluded.profile_payload,
    is_active = true;

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
  'psych-ai-prompt-v5.3',
  'psych-ai-schema-v5.3',
  'openai',
  'gpt-5.6-luna',
  'Psych AI V5.3. Interpretar resultados calculados por el ERP contra perfil de cargo versionado. Mantener objetividad discriminativa, no compensar alertas críticas con rasgos secundarios, no convertir resultados medios en fortalezas, PRP sin peso decisional automático, recomendación preliminar separada de validación humana.',
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
      "material_limitations":{"type":"array","minItems":1,"maxItems":2,"items":{"type":"string"}}
    }
  }'::jsonb,
  encode(extensions.digest(
    'psych-ai-prompt-v5.3|psych-ai-schema-v5.3|openai|gpt-5.6-luna|objective job profile criticality pdf editorial',
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
