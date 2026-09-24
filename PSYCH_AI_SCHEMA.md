Status: HISTORICAL
Document Type: HISTORICAL_EVIDENCE
Owner: Psicología + Engineering
Version: archived
Effective Date: 2026-08-13
Last Reviewed: 2026-09-22
Next Review: N/A
Source of Truth: runtime versionado de su fecha
Supersedes: none
Related Controls: docs/contracts/PSYCH_AI_CONTRACT.md
Change Approval: Engineering Governance

> Do Not Use As Current Production Contract. Este schema conserva una versión anterior; el runtime vigente está documentado en el contrato V6.3.

# Schema Psych AI

Versión activa: `psych-ai-schema-v2`

La salida debe ser un objeto JSON con `additionalProperties=false`.

Campos obligatorios:

- `version`
- `executive_summary`
- `response_quality`
- `strengths`
- `development_areas`
- `interview_questions`
- `ipip16`
- `ipc`
- `bis11`
- `prp`
- `integrated_analysis`
- `preliminary_conclusion`
- `limitations`
- `evidence`

Reglas:

- `strengths`: 3 a 6 textos.
- `development_areas`: 3 a 6 textos.
- `interview_questions`: 4 a 8 preguntas.
- `limitations`: 3 a 8 textos.
- `evidence`: 4 a 10 textos.
- `ipc.disc_disclaimer` debe declarar que no corresponde a DISC ni Everything DiSC.
- `ipip16.clusters` usa claves fijas compatibles con Structured Outputs:
  - `autocontrol_estabilidad`
  - `disciplina_estructura`
  - `interaccion_laboral`
  - `analisis_adaptacion`

Postvalidación:

- Normaliza shape aunque el proveedor falle.
- Remueve palabras de decisión o diagnóstico.
- Agrega limitaciones obligatorias si faltan.
- Conserva flags de validación y guardrail.
