# Psych AI - reporte técnico GPT-5.6 Luna

Fecha: 2026-08-14

## Gates locales ejecutados

- `deno check supabase/functions/psycholaboral-assessment/index.ts`: OK.
- `deno check supabase/functions/generate-psycholaboral-certificate/index.ts`: OK.
- `npm run test:integrity -- tests/integrity/psycholaboral-module-integrity.test.ts`: OK, 39 tests.
- `npm run audit:migrations`: OK.
- `npm run audit:supabase-security`: OK con advertencias históricas del baseline.
- `npm run build:frontend-check`: OK.

## Cobertura agregada

- Runtime activo contiene `gpt56-luna-objective-v5.3`.
- Provider centralizado usa `gpt-5.6-luna`.
- No existe prompt activo que diga `Eres GPT-5 mini`.
- V5.3 registra `critical_competencies`, recomendación de cuatro estados y `prp_decision_weight`.
- PDF V5.3 usa paginación dinámica, tarjetas respirables y párrafos justificados.

## Búsqueda final esperada

Permitido encontrar `gpt-5-mini` solo en:

- migraciones históricas;
- documentación histórica;
- pruebas que validan migraciones históricas.

No debe aparecer como default, fallback ni modelo activo del runtime psicolaboral.
