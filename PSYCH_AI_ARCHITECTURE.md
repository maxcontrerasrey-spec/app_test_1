# Arquitectura Psych AI

Estado: implementado con feature flag apagado por defecto.

## Frontera funcional

El ERP calcula y persiste scores, calidad, perfiles internos y hashes. La capa IA interpreta únicamente el payload estructurado ya calculado. No recibe respuestas crudas, RUN, nombre, correo ni identificadores directos.

## Componentes

- `private.psych_job_profile_versions`: perfiles versionados por familia de cargo.
- `private.psych_prompt_versions`: system prompt, modelo, provider y JSON Schema activos.
- `private.psych_ai_interpretations`: input saneado, salida original IA, revisión profesional, estado y hashes.
- `private.psych_ai_runs`: observabilidad de cada ejecución, intento, latencia, tokens y errores.
- `supabase/functions/_shared/psychAi`: provider abstracto, Mock, OpenAI, sanitización, schema y guardrails.
- `psycholaboral-assessment`: acción autenticada `generate_ai_interpretation` y workflow de revisión.
- `generate-psycholaboral-certificate`: informe interno de 4 páginas con interpretación IA o fallback determinístico.

## Estados

`NOT_REQUESTED -> PROCESSING -> PENDING_REVIEW -> REVIEWED|VALIDATED|OBSERVED`

`FAILED` permite reintento controlado. `VALIDATED` no mueve etapas ni decide contratación.

## Idempotencia

La clave de cache es `assessment_id + input_hash + provider + model`. Si el scoring, calidad, perfil, prompt o schema no cambian, no se vuelve a invocar proveedor.

## Activación

La implementación queda desplegable con `PSYCH_AI_ENABLED=false`. En ese estado se usa Mock/fallback, con la misma persistencia y revisión profesional.

Proveedor productivo actual: `openai` con modelo `gpt-5-mini` y Structured Outputs mediante JSON Schema estricto.
