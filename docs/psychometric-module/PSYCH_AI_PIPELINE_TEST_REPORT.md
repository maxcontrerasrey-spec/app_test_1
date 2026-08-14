# Psych AI pipeline test report

## Gates locales

- Deno check `psycholaboral-assessment`: OK.
- Vitest integridad y guardrails: OK, 28 tests.
- Guardian: pendiente de cierre final.

## Regresión cubierta

La suite bloquea:

- proveedor distinto a OpenAI en Psych AI activo;
- uso accidental de Groq;
- uso de Responses API con schema estricto;
- ausencia de Analyst/Reviewer;
- fallback de proveedor real como contenido revisable;
- locks semánticos PRP/BIS/IPIP/IPC;
- PDF usando `display_output`.

## Criterio funcional

RC-1807 se usa como canario productivo. Debe quedar con:

- provider `openai`;
- model `gpt-5.6-luna`;
- run `SUCCESS`;
- estado `PENDING_REVIEW`;
- certificado e informe `generated`.

## Canario RC-1807

Resultado productivo V4:

- provider `openai`;
- model `gpt-5.6-luna`;
- pipeline `gpt56-luna-objective-v5.3`;
- Analyst attempt `1`;
- Reviewer attempt `1`;
- run `SUCCESS`;
- estado `PENDING_REVIEW`;
- certificado e informe `generated`;
- PRP queda pendiente de revisión profesional;
- BIS-11 conserva clasificación `SOBRE_EL_PROMEDIO`.
