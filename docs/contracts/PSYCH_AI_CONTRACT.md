# Atlas — Contrato Psych AI V6.3

Status: ACTIVE
Document Type: ACTIVE_CONTRACT
Owner: Psicología + Engineering
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: supabase/functions/_shared/psychAi/* y migraciones private.*
Supersedes: PSYCH_AI_PROMPT.md, PSYCH_AI_SCHEMA.md y contratos V4/V5
Related Controls: AI_GOVERNANCE, privacy, review workflow
Change Approval: Psicología + Engineering + Legal/Compliance cuando corresponda

## Baseline

Pipeline gpt56-luna-medium-v6.3; modelo gpt-5.6-luna; prompt psych-ai-prompt-v6.3; schema psych-ai-schema-v6.3; metodología psych-methodology-v6.3.

## Límites

La IA interpreta datos estructurados ya calculados. No recibe nombre, RUT, correo, teléfono, dirección, respuestas crudas ni texto libre innecesario. No recalcula scoring, no inventa baremos, no genera diagnósticos y no decide contratación.

La salida final solo puede ser ADECUADO, ADECUADO_CON_OBSERVACIONES o NO_ADECUADO. La evaluación es antecedente interno y no mueve etapas automáticamente.

PRP conserva 81–117 NO_ADECUADO, 118–136 NEUTRO y 137–150 ADECUADO; fuera de rango no se extrapola. Barratt conserva sus clasificaciones vigentes y no se convierte en riesgo bajo/medio/alto sin validación metodológica.

## Trazabilidad

Cada ejecución debe conservar, cuando esté disponible, provider, model, prompt/schema/metodología, hashes, estado, revisión y telemetría. Los documentos históricos registran el modelo realmente usado en su fecha.
