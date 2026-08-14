set check_function_bodies = off;

-- V6.1 is additive: historical prompt/profile rows remain available for audit.
update private.psych_prompt_versions
set is_active = false
where prompt_code = 'psych-ai-interpretation' and is_active = true;

update private.psych_job_profile_versions
set is_active = false
where is_active = true;

with source_profiles as (
  select
    profile_code,
    label,
    description,
    match_rules,
    profile_payload
  from private.psych_job_profile_versions
  where version = 'profile-v5.3'
), enriched as (
  select
    profile_code,
    label,
    description,
    match_rules,
    profile_payload || jsonb_build_object(
      'competency_framework', jsonb_build_object(
        'evidence_levels', jsonb_build_array('DIRECT_EVIDENCE', 'INTEGRATED_EVIDENCE', 'INSUFFICIENT_EVIDENCE'),
        'levels', jsonb_build_object(
          '1', 'Bajo lo esperado',
          '2', 'Dentro de parámetro',
          '3', 'Sobre lo esperado',
          'S/E', 'Sin evidencia suficiente'
        ),
        'competencies', jsonb_build_object(
          'Trabajo en equipo', 'Integrarse a grupos, comprender objetivos comunes, cooperar y ajustar el comportamiento al funcionamiento del equipo.',
          'Comunicación', 'Escuchar, comprender, expresar información claramente y formular preguntas pertinentes.',
          'Iniciativa', 'Actuar oportunamente frente a dificultades y resolver situaciones cotidianas sin dependencia excesiva de instrucciones.',
          'Calidad de trabajo', 'Comprender exigencias de la tarea y desarrollar respuestas prácticas y consistentes.',
          'Orientación al cliente', 'Comprender necesidades y entregar respuestas apropiadas a clientes internos o externos.',
          'Responsabilidad y compromiso', 'Mantener compromiso con tareas, obligaciones y responsabilidades asignadas.',
          'Tolerancia a la presión', 'Mantener funcionamiento adecuado frente a dificultades, cambios y exigencias operacionales.',
          'Autocontrol', 'Regular emociones y conducta frente a estrés, provocación, hostilidad o alta exigencia.',
          'Seguridad', 'Orientación preventiva, percepción de riesgos, cautela y respeto por normas y procedimientos.',
          'Adaptación a situaciones', 'Ajustar apropiadamente el comportamiento frente a cambios, dificultades o nuevos antecedentes.'
        )
      ),
      'criticality_order', case profile_code
        when 'CONDUCCION' then jsonb_build_array('Seguridad', 'Autocontrol', 'Adherencia a normas y procedimientos', 'Tolerancia a la presión', 'Responsabilidad y compromiso', 'Orden', 'Adaptación a situaciones', 'Trabajo en equipo', 'Comunicación', 'Orientación al cliente')
        when 'ADMINISTRACION' then jsonb_build_array('Responsabilidad y compromiso', 'Calidad de trabajo', 'Comunicación', 'Orden', 'Trabajo en equipo', 'Adaptación a situaciones')
        when 'SUPERVISION' then jsonb_build_array('Comunicación', 'Autocontrol', 'Responsabilidad y compromiso', 'Tolerancia a la presión', 'Trabajo en equipo', 'Iniciativa')
        when 'MANTENIMIENTO' then jsonb_build_array('Seguridad', 'Responsabilidad y compromiso', 'Calidad de trabajo', 'Autocontrol', 'Orden', 'Adaptación a situaciones')
        when 'HSEC' then jsonb_build_array('Seguridad', 'Responsabilidad y compromiso', 'Comunicación', 'Autocontrol', 'Iniciativa', 'Trabajo en equipo')
        when 'LIDERAZGO' then jsonb_build_array('Responsabilidad y compromiso', 'Autocontrol', 'Comunicación', 'Iniciativa', 'Tolerancia a la presión', 'Trabajo en equipo')
        else jsonb_build_array('Responsabilidad y compromiso', 'Autocontrol', 'Calidad de trabajo', 'Comunicación', 'Adaptación a situaciones')
      end,
      'psych_v6_1', jsonb_build_object(
        'prp_ranges', jsonb_build_array(
          jsonb_build_object('min', 81, 'max', 117, 'classification', 'NO_ADECUADO', 'meaning', 'Manejo no adecuado en aspectos referentes a seguridad ocupacional'),
          jsonb_build_object('min', 118, 'max', 136, 'classification', 'NEUTRO', 'meaning', 'Manejo neutro en aspectos referentes a seguridad ocupacional'),
          jsonb_build_object('min', 137, 'max', 150, 'classification', 'ADECUADO', 'meaning', 'Manejo adecuado en aspectos referentes a seguridad ocupacional')
        ),
        'out_of_range', 'OUT_OF_DOCUMENTED_RANGE',
        'prp_decision_rule', 'contextual_not_decisive'
      )
    ) as profile_payload
  from source_profiles
)
insert into private.psych_job_profile_versions(profile_code, version, label, description, match_rules, profile_payload, is_active)
select profile_code, 'profile-v6.1', label, description, match_rules, profile_payload, true
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
values (
  'psych-ai-interpretation',
  'psych-ai-prompt-v6.1',
  'psych-ai-schema-v6.1',
  'openai',
  'gpt-5.6-luna',
  'Psych V6.1: interpretar resultados calculados por el ERP con razonamiento medio, exactitud metodológica, convergencia/divergencia de evidencia, criticidad por perfil de cargo y marco histórico de competencias JM. PRP usa rangos inclusivos 81-117 NO_ADECUADO, 118-136 NEUTRO y 137-150 ADECUADO; fuera de rango no se extrapola. La clasificación PRP no determina por sí sola la clasificación laboral final. No recalcular resultados, inventar baremos, conducta observada, diagnósticos, equivalencias de instrumentos ni antecedentes. No exponer tecnología ni procesos internos. Devolver informe natural y objetivo con cuatro categorías finales: ADECUADO, ADECUADO_CON_OBSERVACIONES, REQUIERE_PROFUNDIZACION y NO_ADECUADO.',
  jsonb_build_object(
    'type', 'object',
    'additionalProperties', false,
    'required', jsonb_build_array('recommendation','recommendation_confidence','critical_strengths','critical_gaps','critical_uncertainties','decision_rationale','executive_profile','personality_profile','interpersonal_profile','safety_and_impulse_profile','job_fit_analysis','adjustment_to_role','competency_matrix','evidence_integration','prp_assessment','strengths','points_to_explore','interview_questions','integrated_conclusion','material_limitations'),
    'properties', jsonb_build_object(
      'recommendation', jsonb_build_object('type','string','enum',jsonb_build_array('ADECUADO','ADECUADO_CON_OBSERVACIONES','REQUIERE_PROFUNDIZACION','NO_ADECUADO')),
      'recommendation_confidence', jsonb_build_object('type','string','enum',jsonb_build_array('BAJA','MEDIA','ALTA')),
      'critical_strengths', jsonb_build_object('type','array','minItems',0,'maxItems',4,'items',jsonb_build_object('type','string')),
      'critical_gaps', jsonb_build_object('type','array','minItems',0,'maxItems',4,'items',jsonb_build_object('type','string')),
      'critical_uncertainties', jsonb_build_object('type','array','minItems',0,'maxItems',5,'items',jsonb_build_object('type','string')),
      'decision_rationale', jsonb_build_object('type','string'),
      'executive_profile', jsonb_build_object('type','string'),
      'personality_profile', jsonb_build_object('type','object','additionalProperties',false,'required',jsonb_build_array('summary','self_regulation','discipline_structure','interpersonal_style','adaptability_thinking'),'properties',jsonb_build_object('summary',jsonb_build_object('type','string'),'self_regulation',jsonb_build_object('type','string'),'discipline_structure',jsonb_build_object('type','string'),'interpersonal_style',jsonb_build_object('type','string'),'adaptability_thinking',jsonb_build_object('type','string'))),
      'interpersonal_profile', jsonb_build_object('type','object','additionalProperties',false,'required',jsonb_build_array('summary','communication','cooperation','initiative','response_under_pressure'),'properties',jsonb_build_object('summary',jsonb_build_object('type','string'),'communication',jsonb_build_object('type','string'),'cooperation',jsonb_build_object('type','string'),'initiative',jsonb_build_object('type','string'),'response_under_pressure',jsonb_build_object('type','string'))),
      'safety_and_impulse_profile', jsonb_build_object('type','object','additionalProperties',false,'required',jsonb_build_array('summary','bis11','prp','combined_interpretation'),'properties',jsonb_build_object('summary',jsonb_build_object('type','string'),'bis11',jsonb_build_object('type','string'),'prp',jsonb_build_object('type','string'),'combined_interpretation',jsonb_build_object('type','string'))),
      'job_fit_analysis', jsonb_build_object('type','string'),
      'adjustment_to_role', jsonb_build_object('type','string'),
      'competency_matrix', jsonb_build_object('type','array','minItems',0,'maxItems',10,'items',jsonb_build_object('type','object','additionalProperties',false,'required',jsonb_build_array('competency','evidence_level','level','interpretation'),'properties',jsonb_build_object('competency',jsonb_build_object('type','string'),'evidence_level',jsonb_build_object('type','string','enum',jsonb_build_array('DIRECT_EVIDENCE','INTEGRATED_EVIDENCE','INSUFFICIENT_EVIDENCE')),'level',jsonb_build_object('type','string','enum',jsonb_build_array('1','2','3','S/E')),'interpretation',jsonb_build_object('type','string')))),
      'evidence_integration', jsonb_build_object('type','object','additionalProperties',false,'required',jsonb_build_array('summary','convergences','divergences'),'properties',jsonb_build_object('summary',jsonb_build_object('type','string'),'convergences',jsonb_build_object('type','array','maxItems',4,'items',jsonb_build_object('type','string')),'divergences',jsonb_build_object('type','array','maxItems',4,'items',jsonb_build_object('type','string')))),
      'prp_assessment', jsonb_build_object('type','object','additionalProperties',false,'required',jsonb_build_array('classification','meaning','status'),'properties',jsonb_build_object('classification',jsonb_build_object('type','string','enum',jsonb_build_array('NO_ADECUADO','NEUTRO','ADECUADO','OUT_OF_DOCUMENTED_RANGE')),'meaning',jsonb_build_object('type','string'),'status',jsonb_build_object('type','string','enum',jsonb_build_array('DOCUMENTED','OUT_OF_DOCUMENTED_RANGE','NOT_AVAILABLE')))),
      'strengths', jsonb_build_object('type','array','minItems',0,'maxItems',4,'items',jsonb_build_object('type','object','additionalProperties',false,'required',jsonb_build_array('title','text'),'properties',jsonb_build_object('title',jsonb_build_object('type','string'),'text',jsonb_build_object('type','string')))),
      'points_to_explore', jsonb_build_object('type','array','minItems',0,'maxItems',4,'items',jsonb_build_object('type','object','additionalProperties',false,'required',jsonb_build_array('title','text'),'properties',jsonb_build_object('title',jsonb_build_object('type','string'),'text',jsonb_build_object('type','string')))),
      'interview_questions', jsonb_build_object('type','array','minItems',3,'maxItems',5,'items',jsonb_build_object('type','object','additionalProperties',false,'required',jsonb_build_array('question','target'),'properties',jsonb_build_object('question',jsonb_build_object('type','string'),'target',jsonb_build_object('type','string')))),
      'integrated_conclusion', jsonb_build_object('type','string'),
      'material_limitations', jsonb_build_object('type','array','minItems',0,'maxItems',2,'items',jsonb_build_object('type','string'))
    )
  ),
  encode(extensions.digest('psych-ai-prompt-v6.1|psych-ai-schema-v6.1|openai|gpt-5.6-luna|medium reasoning|PRP documentary ranges|competency convergence', 'sha256'), 'hex'),
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
