# Psych V6.3 - auditoría de implementación

Fecha: 2026-08-17
Producción: `pzblmbahnoyntrhistea`

## Contrato activo

- Prompt: `psych-ai-prompt-v6.3`
- Schema: `psych-ai-schema-v6.3` (Structured Output compatible con el renderer vigente)
- Metodología: `psych-methodology-v6.3`
- Runtime: `gpt56-luna-medium-v6.3`
- Modelo: `gpt-5.6-luna`
- Categorías finales: `ADECUADO`, `ADECUADO_CON_OBSERVACIONES`, `NO_ADECUADO`

No se modificaron respuestas, scoring ni interpretaciones históricas. La migración se ejecutó directamente porque el remoto contiene versiones antiguas ausentes en este checkout; la versión `20260817200000` quedó registrada en `supabase_migrations.schema_migrations`.

## Matriz funcional

La matriz vive en `supabase/functions/_shared/psychAi/semantic.ts` y se entrega al modelo dentro de `functional_mappings`:

| Instrumento | Evidencia | Uso laboral | Límite |
| --- | --- | --- | --- |
| IPIP-16 | INTEGRATED | estabilidad, presión, tensión, normas, orden, adaptación, análisis, asertividad e interacción | rango teórico 1-5; no 16PF, diagnóstico ni conducta observada |
| IPIP-16 | INSUFFICIENT | sensibilidad, cautela, reserva, autosuficiencia y seguridad social | se omiten como ejes laborales no sustentados |
| IPIP-IPC | INTEGRATED | emociones, criterio interpersonal, influencia, sobreutilización, presión, tensión y eficacia | octantes/ejes propios; no DISC ni D/I/S/C |
| IPIP-IPC | INSUFFICIENT | meta/motivadores y valor para la organización | no se derivan con el payload actual |

## Barratt y PRP

- Barratt conserva únicamente las tres clasificaciones existentes: Bajo el promedio, Promedio y Sobre el promedio.
- El mapeo a riesgo bajo/medio/alto está marcado `BLOCKED_NOT_VALIDATED`; no se inventó umbral y `Sobre el promedio` no se convierte en criterio excluyente.
- PRP conserva exactamente 81-117, 118-136 y 137-150; fuera de rango no se extrapola y no decide por sí solo.

## Canary productivo

Evaluación `773584ef-1eb9-4db1-b203-b6a3ad0a8d55`:

- V6.2: 7.567 tokens totales.
- V6.3: 8.377 tokens totales, una llamada, `PENDING_REVIEW`, recomendación `ADECUADO`, `guardrail_flags=[]`.
- Informe regenerado en Storage privado y verificado con `pypdf`/Poppler: 7 páginas, encabezado visual `Página X de 7`, sin `GPT`, `OpenAI`, `REQUIERE_PROFUNDIZACION` ni `Síntesis de resultado`.

El objetivo preferente de 6.000-8.500 tokens se cumple. El PDF conserva 7 páginas por volumen de evidencia; se corrigieron saltos forzados, tarjetas IPIP fusionadas y títulos huérfanos sin eliminar contenido requerido.
