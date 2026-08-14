# Test Report Psych AI

Fecha: 2026-08-13

## Ejecutado

- `deno check --no-config --node-modules-dir=auto supabase/functions/psycholaboral-assessment/index.ts`
- `deno check --no-config --node-modules-dir=auto supabase/functions/generate-psycholaboral-certificate/index.ts`
- `node ./node_modules/typescript/bin/tsc -b --pretty false`
- `node ./node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/integrity/psycholaboral-module-integrity.test.ts`
- `npm run test:integrity`
- `npm run audit:migrations`
- `npm run audit:supabase-security`
- `npm run build:frontend-check`
- `npm run audit:performance-baseline`
- `npm run guardian`
- `git diff --check`

## Produccion

- Migracion aplicada y registrada: `20260814005242_psych_ai_interpretation_foundation.sql`.
- Migracion correctiva aplicada y registrada: `20260814011614_fix_psych_ai_runtime_helpers.sql`.
- Edge Function `psycholaboral-assessment` desplegada con capa IA.
- Edge Function `generate-psycholaboral-certificate` desplegada con informe interno de 4 paginas.
- Smoke SQL reducido: 4 tablas IA, 5 RPC IA, 1 prompt activo, 7 perfiles activos, 0 grants directos a `anon/authenticated`, perfil conductor resuelto.
- Smoke HTTP negativo: endpoint IA rechaza acceso sin JWT con `401` y CORS restringido al dominio ERP.
- Corrección schema v2: `ipip16.clusters` usa propiedades fijas para evitar rechazo de JSON Schema dinámico.

## Cobertura agregada

- Tablas IA privadas y sin grants directos.
- Payload IA service-role only.
- Sanitización de PII y respuestas crudas.
- Mock y OpenAI providers.
- Feature flag `PSYCH_AI_ENABLED`.
- JSON Schema estricto.
- Guardrails contra decisión, diagnóstico y baremos inventados.
- PDF interno de 4 páginas.

## Pendiente por credencial

`LIVE_OPENAI_INTEGRATION_TEST`: ejecutar desde una evaluación terminada con `PSYCH_AI_PROVIDER=openai`, `PSYCH_AI_MODEL=gpt-5-mini` y `OPENAI_API_KEY`.

Estado final: `IMPLEMENTATION COMPLETE — LIVE OPENAI VALIDATION PENDING API KEY`.
