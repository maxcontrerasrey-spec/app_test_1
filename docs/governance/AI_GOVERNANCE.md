# Atlas — Gobierno de IA

Status: ACTIVE
Document Type: ACTIVE_POLICY
Owner: Engineering Governance + Psicología
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: supabase/functions/_shared/psychAi, migraciones private.* y tests
Supersedes: contratos Psych históricos basados en gpt-5-mini o versiones V4/V5
Related Controls: privacidad, RLS, revisión profesional, auditoría, AI_MODEL_CONTRACT
Change Approval: Engineering Governance, Psicología y Legal/Compliance cuando corresponda

## Alcance vigente

La IA es una capa interpretativa asistida. El ERP calcula scoring, calidad, perfiles y hashes de forma determinística. La IA no recalcula scores, no altera respuestas, no inventa baremos, no diagnostica y no ejecuta contrataciones o rechazos.

## Pipeline canónico

Scoring determinístico ERP → sanitización → FACTS compactos → homologaciones funcionales → Analyst → Structured Output → validación semántica → guardrails → reviewer patch-only cuando corresponde → validación de consistencia → persistencia → telemetría → revisión/informe.

## Provider y extensibilidad

El contrato se separa en provider, modelo, runtime, prompt, schema y metodología. El diseño futuro admite un AI Gateway con OpenAI, vLLM local y otros proveedores, sin acoplar la política a un único modelo. Esa abstracción futura no implica que exista hoy un gateway físico.

## Decisiones y revisión

La salida psicolaboral es antecedente interno. Puede producir ADECUADO, ADECUADO_CON_OBSERVACIONES o NO_ADECUADO, pero no cambia etapas ni decide contratación automáticamente. La revisión profesional sigue siendo independiente cuando el workflow la exige.

## Privacidad

Solo se envía información saneada y estructurada. Se excluyen identificadores directos, respuestas crudas y texto libre innecesario. Las tablas sensibles permanecen en private y el acceso se valida por RPC/RLS. Retención, base jurídica y usos masivos requieren aprobación Legal/Compliance.
