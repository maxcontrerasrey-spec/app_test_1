# PSYCH AI SEMANTIC GUARDRAILS V3

Fecha: 2026-08-13  
Alcance: corrección semántica de la capa IA psicolaboral existente. No modifica scoring, respuestas, consentimientos, RLS, Storage ni flujo de decisión humana.

## Resumen ejecutivo

Se implementó una capa determinística de guardrails semánticos entre el scoring del ERP y la redacción IA. La IA ya no decide significado, intensidad ni clasificación: recibe un contexto con niveles, locks y evidencia calculada por el ERP, redacta una salida estructurada y luego un validador backend bloquea regresiones antes de persistir.

La salida se mantiene compatible con la UI y el PDF existentes mediante normalización a los campos legacy, pero incorpora schema V3 con `profile_summary`, `strengths`, `points_to_explore`, `instrument_analysis`, `interview_questions`, `recommendations` y `limitations`.

## Antes vs después

| Regresión detectada | Antes | Después |
| --- | --- | --- |
| APE 3.14/5 | Podía aparecer como “alta apertura”. | Queda `INTERMEDIO_EN_RANGO_TEORICO`; se bloquea lenguaje alto/elevado/marcado. |
| NOR 3.00/5 | Podía convertirse en “baja adherencia”. | Se expresa como nivel intermedio; si el cargo lo vuelve crítico, se pide profundizar sin llamarlo déficit. |
| EST 3.33 / TEN 2.83 | Podía hablar de promedio poblacional o “irritabilidad sostenida”. | Se bloquea promedio sin baremo, dirección no documentada y términos prohibidos. |
| BIS-11 70 | Podía escalar a “alta”, “riesgo crítico” o “requiere intervención”. | Se conserva `SOBRE_EL_PROMEDIO`; no escala a alto/crítico/severo/intervención. |
| PRP 90 | Podía inventar constructos como documentación, organización, responsabilidad o control. | Queda `PROFESSIONAL_ONLY` hasta tener respaldo/baremo documentado. |
| Fortalezas | Podían rellenarse con recomendaciones metodológicas. | Solo acepta atributos respaldados con `evidence_ids`; bloquea “revisar”, “validar”, “profundizar”, etc. |
| Preguntas | Podían presuponer defectos. | Se exigen preguntas conductuales, neutrales y abiertas. |
| IPC | Podía describir Directivo como segunda tendencia. | Orden determinístico: Estable, Influyente, Analítico, Directivo; Directivo no puede ser tendencia secundaria. |

## Archivos modificados

- `supabase/functions/_shared/psychAi/semantic.ts`: motor semántico V3, evidencia, locks, normalizador y validador post-LLM.
- `supabase/functions/_shared/psychAi/schema.ts`: schema V3 y compatibilidad legacy.
- `supabase/functions/_shared/psychAi/guardrails.ts`: payload con contexto semántico, validación semántica y fallback determinístico V3.
- `supabase/functions/_shared/psychAi/index.ts`: reintento único ante fallo semántico y fallback revisable.
- `supabase/functions/_shared/psychAi/types.ts`: tipos V3.
- `src/modules/psycholaboral/types.ts`: tipos V3 para UI.
- `supabase/migrations/20260814030634_psych_ai_semantic_guardrails_v3.sql`: prompt/schema semántico V3.
- `supabase/migrations/20260814032407_psych_ai_openai_gpt5_mini_provider.sql`: proveedor activo OpenAI `gpt-5-mini`.
- `tests/unit/psych-ai-semantic-guardrails.test.ts`: fixtures y regresiones obligatorias.
- `tests/integrity/psycholaboral-module-integrity.test.ts`: contrato V3 incorporado a integridad del módulo.

## Validaciones implementadas

- `validatePsychSemanticOutput()` exige evidencia válida en fortalezas, aspectos a profundizar y preguntas.
- Bloquea lenguaje de riesgo no determinístico.
- Bloquea intensidades incompatibles con niveles IPIP intermedios.
- Mantiene clasificación BIS-11 como lock determinístico.
- Mantiene PRP en `PROFESSIONAL_ONLY`.
- Bloquea preguntas no neutrales.
- Deduplica limitaciones.
- Si OpenAI devuelve una salida semánticamente inválida, se reintenta una vez con errores concretos. Si vuelve a fallar, se usa fallback determinístico revisable.

## Tests agregados

- `semantic-intensity.test`
- `bis11-classification-lock.test`
- `prp-hard-lock.test`
- `ipip-theoretical-level.test`
- `ipc-macrostyle-consistency.test`
- `evidence-validation.test`
- `strength-classification.test`
- `interview-neutrality.test`
- `risk-language.test`
- `limitations-dedup.test`
- `semantic-output-regression.test`

## Riesgos pendientes

1. PRP sigue bloqueado como `PROFESSIONAL_ONLY` hasta que exista documentación metodológica suficiente para interpretar factores.
2. Los niveles IPIP son descriptivos del rango teórico 1-5, no percentiles ni baremos chilenos.
3. La revisión profesional sigue siendo obligatoria antes de usar el informe como antecedente del proceso.
4. La calidad semántica final depende también del prompt activo en producción; por eso se versionó `psych-ai-prompt-v3` y `psych-ai-schema-v3`.

## Estado final esperado

`PSYCH SEMANTIC GUARDRAILS — COMPLETE` queda condicionado a despliegue, regeneración del canario RC-1807 y verificación productiva del informe.
