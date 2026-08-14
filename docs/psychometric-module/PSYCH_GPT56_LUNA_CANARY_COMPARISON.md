# Psych AI - comparación canario GPT-5.6 Luna

Fecha: 2026-08-14

Canario operativo: RC-1807 / assessment `a48773d1-b296-4b9a-9524-84aa400ffdca`.

## Baseline anterior documentado

- Provider: `openai`.
- Modelo: `gpt-5-mini`.
- Estado IA: `PENDING_REVIEW`.
- Certificado e informe: `generated`.
- Observación metodológica: el informe tendía a presentar resultados neutros como fortalezas y a suavizar señales críticas en conducción.

## Criterios de aceptación V5.3 + Luna

1. No inventar datos ni conducta observada.
2. No convertir resultados medios en fortalezas.
3. Priorizar competencias críticas del cargo sobre rasgos secundarios.
4. PRP mantiene peso decisional automático 0.
5. BIS-11 sobre el promedio se pondera como señal a profundizar en conducción, sin transformarlo en conducta peligrosa.
6. Debe existir una recomendación preliminar explícita de cuatro estados.
7. Preguntas de entrevista deben ser neutrales.
8. PDF debe renderizar sin solapes, con texto justificado y paginación semántica.

## Resultado esperado del canario

Para conducción operacional, si se mantiene una señal BIS-11 sobre el promedio junto con cumplimiento/orden en rango medio, el resultado no debe cerrar como "parece adecuado" sin observaciones. La salida aceptable debe inclinarse a:

- `REQUIERE_PROFUNDIZACION`, o
- `RECOMENDADO_CON_OBSERVACIONES`

según el conjunto completo, pero con racionalidad explícita y sin compensación artificial por rasgos interpersonales secundarios.

## Estado de ejecución

Pendiente de regeneración productiva después de aplicar migración y desplegar funciones.

