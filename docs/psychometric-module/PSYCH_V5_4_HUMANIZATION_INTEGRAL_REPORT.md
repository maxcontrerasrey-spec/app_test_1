# Psych AI V5.4 - Humanización integral del informe

Fecha: 2026-08-14

## Alcance aplicado

- Prompt activo versionado como `psych-ai-prompt-v5.4`.
- Schema activo versionado como `psych-ai-schema-v5.4`.
- Modelo productivo declarado: `gpt-5.6-luna`.
- Pipeline runtime: `gpt56-luna-humanized-v5.4.1`.

## Regla de separación

El ERP mantiene trazabilidad técnica en metadata interna:

- provider/model;
- prompt/schema;
- tokens, latencia y costos;
- flags de validación;
- retries y estado de ejecución.

El contenido entregable del informe y del PDF consume únicamente el output profesional saneado más metadata documental legítima: folio, confidencialidad y paginación.

## Textos eliminados del contenido entregable

El sanitizador y los guardrails bloquean o reemplazan lenguaje visible asociado a:

- inteligencia artificial, proveedor, modelo o versión técnica;
- automatización, fallback, prompt, schema o guardrails;
- confianza automatizada;
- validación humana o revisión profesional separada;
- disclaimers repetitivos sobre baremos locales o conducta observada;
- mensajes PRP de incapacidad automática o pendiente de revisión.

## Objetividad

La recomendación se conserva proporcional a evidencia y criticidad del cargo. Para conducción operacional, los guardrails priorizan seguridad, autocontrol, normas, orden, presión e impulsividad. Fortalezas relacionales secundarias no compensan brechas críticas.

Se agregaron pruebas sintéticas para:

- caso favorable;
- caso mixto con incertidumbre crítica;
- caso desfavorable con brechas críticas múltiples.

## PDF

El informe queda encabezado como:

- `Informe Psicolaboral Integrado`
- `Resultado de evaluación: [CATEGORÍA]`

El pie queda limitado a:

- documento confidencial;
- folio PS;
- página actual y total.

No se imprime versión técnica del informe ni estado de validación profesional.
