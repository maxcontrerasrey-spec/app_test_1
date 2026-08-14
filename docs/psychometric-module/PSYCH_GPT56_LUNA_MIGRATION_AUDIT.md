# Psych AI - auditoría de migración GPT-5.6 Luna

Fecha: 2026-08-14

## Objetivo

Reemplazar el runtime psicolaboral desde `gpt-5-mini` hacia `gpt-5.6-luna` como único modelo del flujo activo, sin alterar scoring psicométrico, consentimientos, RLS, Storage privado, revisión humana ni metodología V5.3.

## Estado anterior

- Provider activo: `openai`.
- Modelo operativo anterior: `gpt-5-mini`.
- Pipeline anterior reciente: `gpt5-mini-humanized-v5.2.3` / V5.
- Estructura vigente: Analyst condicional + Reviewer patch-only con Responses API y Structured Outputs.
- Registros históricos deben conservar el modelo real usado al momento de generación.

## Estado nuevo

- Provider activo: `openai`.
- Modelo único del runtime: `gpt-5.6-luna`.
- Pipeline activo: `gpt56-luna-objective-v5.3`.
- Runtime Edge: `gpt56-luna-objective-v5.3.0`.
- Prompt/schema: `psych-ai-prompt-v5.3` / `psych-ai-schema-v5.3`.
- Analyst y Reviewer usan el mismo modelo. No hay fallback a GPT-5 mini, Terra, Sol, Groq, Orion ni otro LLM.

## Controles implementados

- Fuente de verdad de modelo en `DEFAULT_PSYCH_AI_MODEL = "gpt-5.6-luna"`.
- `PSYCH_AI_MODEL` ya no puede reactivar un modelo anterior en runtime.
- Retrys técnicos mantienen el mismo provider/modelo.
- Structured Outputs permanece con `text.format.json_schema` y `strict: true`.
- Telemetría conserva provider, model, tokens, cached tokens, costo estimado, latencia, intentos y reviewer.
- Tabla de costo actualizada para Luna: input 0.20, cached input 0.02 y output 1.20 USD por millón de tokens, según pricing público vigente de OpenAI al momento de esta migración.

## Referencias oficiales revisadas

- OpenAI Models: `gpt-5.6-luna` existe como modelo GPT-5.6 orientado a workloads sensibles a costo.
- OpenAI Structured Outputs: Responses API soporta salida estricta contra JSON Schema.
- OpenAI Compare Models: `gpt-5.6-luna` declara Structured Outputs y endpoint `v1/responses`.

## Exclusiones intencionales

- No se tocó scoring.
- No se reescribieron respuestas históricas.
- No se cambió el flujo de revisión profesional.
- No se agregó A/B permanente.
- No se agregó fallback multi-modelo.

