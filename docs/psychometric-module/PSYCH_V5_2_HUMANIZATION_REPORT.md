# PSYCH AI V5.2 - Humanización del informe

Fecha: 2026-08-14

## Problema corregido

El informe V5 podía ser metodológicamente correcto, pero su forma de explicar seguía demasiado cerca de una traducción del JSON:

- comenzaba por resultados de test;
- exponía códigos técnicos o reglas internas;
- repetía advertencias metodológicas;
- convertía valores intermedios en hallazgos relevantes;
- separaba los instrumentos en vez de integrar a la persona en el cargo.

## Criterio V5.2

La persona es el objeto del informe. Los instrumentos son evidencia.

El informe ahora instruye al Analyst a responder:

```text
Qué tipo de trabajador parece ser esta persona,
cómo probablemente se desenvuelve en el contexto evaluado,
cuáles son sus recursos relevantes
y qué conviene corroborar para el cargo.
```

## Cambios de redacción

| Sección | Cambio |
| --- | --- |
| Perfil ejecutivo | 200-300 palabras, persona + cargo, no encabezado técnico. |
| Personalidad laboral | Agrupa patrones funcionales: autorregulación, estructura, adaptabilidad, relación interpersonal y presión. |
| Estilo interpersonal | Traduce IPIP-IPC a conducta laboral comprensible, sin tratarlo como DISC. |
| Seguridad/autocontrol | Integra BIS-11 + PRP + rasgos relevantes sin escalar a riesgo crítico. |
| Fortalezas | Máximo 4, conductuales y relevantes al cargo. |
| Aspectos a profundizar | Máximo 4, hipótesis de entrevista/verificación, no disclaimers. |
| Preguntas | Máximo 5, conductuales, neutrales y no acusatorias. |
| Conclusión | Integra recursos + punto de atención + corroboración; no repite el resumen. |

## Términos bloqueados en informe profesional

V5.2 detecta y sanea antes/después de normalizar:

- `raw_total`
- `F1-F6`
- `ev_*`
- `norm_status`
- `schema`
- `payload`
- `metadata`
- `guardrail`
- `PROFESSIONAL_ONLY`
- `PENDING_REVIEW`
- códigos como `SOBRE_EL_PROMEDIO` o `INTERMEDIO_EN_RANGO_TEORICO`
- frases como `no se opera escalamiento`, `clasificación literal`, `según metadata`

## PRP

V5.2 no inventa baremos ni nombres de factores si la metodología disponible no los documenta de forma suficiente.

PRP se usa como antecedente descriptivo preventivo:

- puntaje directo;
- posición matemática respecto de escala mínima/media/máxima;
- lectura prudente de prácticas y actitudes preventivas;
- advertencia compacta si no existe referencia poblacional documentada.

## Resultado esperado

El informe debe sonar profesional, natural, prudente, claro y aplicado al cargo. No debe sonar a backend, prompt, auditoría interna ni JSON traducido.
