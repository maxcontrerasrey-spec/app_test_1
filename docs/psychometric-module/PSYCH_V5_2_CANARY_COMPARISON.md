# PSYCH AI V5.2 - Comparación canario RC-1807

Fecha: 2026-08-14  
Canario: RC-1807

## V5 before

Baseline productivo medido:

| Métrica | Valor |
| --- | ---: |
| Provider | openai |
| Modelo | gpt-5-mini |
| Pipeline | gpt5-mini-methodological-v5 |
| Calls IA inferidas | 2 |
| Reviewer | ejecutado por defecto |
| Input tokens | 14.331 - 14.416 |
| Output tokens | 4.194 - 4.468 |
| Total tokens | 18.525 - 18.884 |
| Cached input | no persistido |
| Reasoning tokens | no persistido |
| Latencia | 36,5 - 36,9 s |

Observación: el payload V5 del canario persistía `input_payload.prompt` con prompt y schema embebidos. Esa misma información también era enviada como prompt/schema al provider.

## V5.2 after

Canario productivo final:

| Métrica | Valor |
| --- | ---: |
| Interpretación | `ff42459d-aba8-4188-9ec9-33cdfb8d1e9b` |
| Estado | PENDING_REVIEW |
| Run | SUCCESS |
| API calls | 1 |
| Reviewer | no ejecutado |
| Input tokens | 2.574 |
| Cached input | 2.432 |
| Output tokens | 2.263 |
| Total tokens | 4.837 |
| Guardrail flags | 0 |
| Términos técnicos bloqueados | 0 |
| Certificado | generated |
| Informe | generated |

Fragmento V5.2, perfil ejecutivo:

> Persona orientada a la operación y la rutina, que combina calidez en el trato con una tendencia a la reserva personal. Interpersonalmente se muestra respetuosa y capaz de relacionarse de forma equilibrada con pasajeros y colegas...

Fragmento V5.2, conclusión integrada:

> La persona parece adecuada para tareas de conducción operacional donde primen rutinas claras, trato respetuoso y atención sostenida. Sus recursos principales son la calidez en el trato, la reserva que favorece concentración y una estabilidad emocional...

Checks cumplidos:

- una evaluación PASS usa una llamada IA;
- Reviewer solo si aparecen flags;
- informe no contiene `raw_total`, `F1-F6`, `ev_*`, `schema`, `payload`, `metadata`, `guardrail`;
- PRP aparece como antecedente descriptivo preventivo, sin baremos inventados;
- el perfil ejecutivo habla de la persona en el cargo;
- la conclusión no repite el resumen;
- PDF consume la interpretación persistida.

## Verificación de calidad

La mejora principal no es solo token/costo. La salida V5.2 cambia el eje narrativo desde “resultado de test” hacia “persona en cargo”: integra estilo operativo, relación interpersonal, rutina, autocontrol y corroboración en entrevista. Mantiene prudencia metodológica y no emite APTO/NO APTO automático.
