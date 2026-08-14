# Psych AI GPT-5 mini dual-pass architecture

Estado: implementado como pipeline backend para Gestión Psicolaboral.

## Contrato

El ERP calcula y conserva la fuente de verdad: scoring, inversión de ítems, medias, octantes, macroestilos documentados, BIS-11, PRP, calidad, hashes y estados.

GPT-5 mini redacta e interpreta únicamente facts pseudonimizados.

```text
ERP scoring
→ facts payload saneado
→ GPT-5 mini Analyst
→ GPT-5 mini Reviewer
→ normalización y hard checks ERP
→ final AI draft
→ revisión profesional humana
```

## Seguridad

- `OPENAI_API_KEY` vive solo en Supabase Edge Functions.
- No se envían nombre, RUN, correo, teléfono ni respuestas crudas.
- No hay tools, browsing, web ni code execution.
- Si OpenAI no responde, rechaza, queda incompleto o entrega contenido vacío, el estado queda `FAILED`.
- Si OpenAI responde pero requiere corrección semántica, el ERP normaliza y registra flags; el informe no queda vacío por errores corregibles.

## Estados

El estado final visible sigue usando el contrato existente: `PENDING_REVIEW`, `REVIEWED`, `VALIDATED`, `OBSERVED`, `FAILED`.

La traza del pipeline se conserva en `validation_flags` y `guardrail_flags` con versión `gpt5-mini-analyst-reviewer-v1`.
