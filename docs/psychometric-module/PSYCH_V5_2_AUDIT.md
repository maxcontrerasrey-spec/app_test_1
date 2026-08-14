# PSYCH AI V5.2 - Auditoría de implementación

Fecha: 2026-08-14  
Alcance: evolución incremental sobre Psych AI V5 para humanización, optimización de tokens y telemetría.

## Resumen ejecutivo

V5 estaba funcional, pero arrastraba dos problemas:

1. La narrativa seguía demasiado cerca de la estructura técnica del ERP: test por test, códigos metodológicos y lenguaje defensivo.
2. Cada evaluación ejecutaba Analyst + Reviewer por defecto y enviaba información duplicada dentro del payload, incluyendo prompt y schema embebidos en `input_payload.prompt`.

V5.2 mantiene GPT-5 mini, scoring backend, RLS, consentimientos, hashes, Storage privado, revisión humana y PDF existente. La modificación se limita a la capa de interpretación IA, telemetría de runs y presentación técnica en la UI de revisión.

## Matriz V5.2

| Feature | Expected | Found V5 | Status V5.2 | Action |
| --- | --- | --- | --- | --- |
| Modelo | `gpt-5-mini` | Confirmado | Conservado | Sin cambio de proveedor |
| Scoring | Backend determinístico | Confirmado | Conservado | No se tocó scoring |
| PDF | Consumir salida IA persistida | Confirmado | Conservado | No dispara IA desde PDF |
| Compact facts | Payload reducido sin respuestas crudas ni prompt/schema duplicado | Parcial/no efectivo | Implementado | `buildCompactPsychAIFacts` + `delete cloned.prompt` |
| Reviewer | Condicional | V5 lo ejecutaba siempre | Implementado | Reviewer solo ante flags |
| Reviewer output | Patch-only | V5 devolvía salida completa | Implementado | `REVIEW_PATCH_SCHEMA` |
| Telemetría | Por fase/call/cache/retry/costo | Solo total general | Implementado | Nuevas columnas y metadata |
| Lenguaje profesional | Sin códigos backend | Parcial | Endurecido | Guardrails pre/post sanitización |
| PRP | Descriptivo, sin baremo inventado | Parcial | Ajustado | Direct score + escala matemática + semántica prudente |

## Cambios de arquitectura

Flujo V5.2:

```text
SCORING ERP
  -> SANITIZE INPUT
  -> COMPACT FACTS
  -> GPT-5 MINI ANALYST
  -> VALIDATOR/GUARDRAILS
  -> PASS: guardar salida
  -> REVIEW_REQUIRED: GPT-5 MINI REVIEWER PATCH-ONLY
  -> aplicar parches mínimos
  -> guardar salida final + telemetría
```

## Controles preservados

- No se modificaron respuestas, puntajes ni cálculo de instrumentos.
- No se relajaron permisos, RLS ni grants.
- No se incorporó Groq ni Orion.
- La decisión sigue siendo humana.
- Rechazar sigue dependiendo del flujo transaccional existente.
- El informe profesional no expone `evidence_ids`, RUT, correo, respuestas crudas ni tokens.

## Riesgo residual

La calidad final sigue dependiendo de GPT-5 mini y de la suficiencia metodológica disponible por instrumento. V5.2 reduce metareglas visibles y consumo esperado, pero no convierte PRP en instrumento con baremos poblacionales si estos no están documentados.
