# PSYCH AI V5.2 - Análisis de tokens

Fecha: 2026-08-14  
Canario: RC-1807

## Baseline productivo V5

Consulta productiva sobre RC-1807 antes de aplicar V5.2:

| Run | Estado | Pipeline | Input | Output | Total | Cache | Reviewer | Latencia |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: |
| `1e334190-aa57-47f8-8792-34118057b280` | SUCCESS | `gpt5-mini-methodological-v5` | 14.416 | 4.468 | 18.884 | no persistido | sí, por defecto | 36.888 ms |
| `d5d4a55b-7ee6-4ed4-abf2-326048f323a8` | SUCCESS | `gpt5-mini-methodological-v5` | 14.331 | 4.194 | 18.525 | no persistido | sí, por defecto | 36.502 ms |
| `1856b279-fc14-47e6-a3d0-96d5b5a75eeb` | CACHE_HIT | `gpt5-mini-methodological-v5` | n/a | n/a | n/a | n/a | n/a | n/a |

## Causa del consumo cercano a 18.5k

La cifra mostrada correspondía a `total_tokens` del run de IA, no a un costo de PDF ni a una métrica agregada de UI.

Causas verificadas:

1. V5 ejecutaba Analyst + Reviewer por defecto en cada generación exitosa.
2. El payload persistido contenía `input_payload.prompt`.
3. Dentro de `input_payload.prompt` había:
   - `system_prompt`: 1.111 caracteres en el canario V5.
   - `response_schema`: 2.199 caracteres en el canario V5.
4. El provider además enviaba prompt y schema formalmente a la API, duplicando parte del contexto.
5. La telemetría V5 no separaba input cacheado, reasoning tokens ni desglose Analyst/Reviewer.

## Cambios V5.2

| Área | Cambio |
| --- | --- |
| Payload | Se elimina `prompt` del facts enviado al modelo. |
| Facts | Se reemplaza payload amplio por `buildCompactPsychAIFacts`. |
| Reviewer | Deja de ejecutarse por defecto; corre solo ante flags de validación. |
| Reviewer output | Devuelve parches mínimos, no un informe completo. |
| Telemetría | Se persiste analyst/reviewer input, cached input, output, reasoning, total, retries, calls y costo. |

## Meta de consumo

Objetivo inicial: ≤ 6.000 tokens por evaluación PASS.  
Target deseado: 4.500-5.000 tokens cuando la calidad se mantenga.

## Resultado productivo V5.2

Canario RC-1807 final, interpretación `ff42459d-aba8-4188-9ec9-33cdfb8d1e9b`:

| Métrica | Valor |
| --- | ---: |
| Provider | openai |
| Modelo | gpt-5-mini |
| Pipeline | gpt5-mini-humanized-v5.2 |
| API calls | 1 |
| Retries | 0 |
| Reviewer ejecutado | no |
| Reviewer reason | analyst_passed |
| Analyst input tokens | 2.574 |
| Analyst cached input tokens | 2.432 |
| Analyst output tokens | 2.263 |
| Analyst reasoning tokens | 64 |
| Total tokens | 4.837 |
| Estimated cost USD | 0,004622 |
| Latencia | 30.331 ms |

## Comparación

| Métrica | V5 before | V5.2 after | Cambio |
| --- | ---: | ---: | ---: |
| API calls | 2 | 1 | -50% |
| Input tokens | 14.331-14.416 | 2.574 | -82% aprox. |
| Cached input tokens | no persistido | 2.432 | ahora visible |
| Output tokens | 4.194-4.468 | 2.263 | -46% aprox. |
| Total tokens | 18.525-18.884 | 4.837 | -74% aprox. |
| Reviewer | siempre | condicional/no ejecutado | corregido |
| Latencia | 36,5-36,9 s | 30,3 s | -17% aprox. |

La medición cumple el objetivo inicial de ≤ 6.000 tokens por evaluación PASS y cae dentro del target deseado de 4.500-5.000 tokens para este canario.
