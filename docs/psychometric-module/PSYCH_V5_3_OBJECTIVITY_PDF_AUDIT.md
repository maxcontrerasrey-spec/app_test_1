# Psych AI V5.3 - objetividad discriminativa y rediseño PDF

Fecha: 2026-08-14

## Cambios metodológicos

- Se agregan perfiles de cargo versionados con criticidad explícita: competencias críticas, altas, medias y de baja relevancia.
- La IA recibe matriz de criticidad antes de redactar.
- Se agregan campos estructurados:
  - `recommendation`
  - `recommendation_confidence`
  - `critical_strengths`
  - `critical_gaps`
  - `critical_uncertainties`
  - `decision_rationale`
- Resultados intermedios quedan neutros por defecto.
- PRP queda como antecedente descriptivo sin peso decisional automático.
- BIS-11 conserva ponderación contextual alta en cargos de conducción/autocontrol, sin convertir clasificación en conducta observada.

## Guardrails activos

- Eliminación de fortalezas artificiales por resultados medios o inferencias no medidas.
- Enforzamiento de recomendación cuando el marco determinístico detecta brecha o incertidumbre crítica.
- Bloqueo de inferencias como reserva-concentración, calidez-seguridad, orden medio-adherencia demostrada o baja dominancia-prudencia vial.
- Separación explícita entre resultado psicométrico, hipótesis laboral y conducta observada.

## Cambios PDF

- Informe interno rediseñado con tokens editoriales centralizados.
- Párrafos narrativos justificados.
- Cards dinámicas con padding y altura calculada.
- Saltos de página semánticos por secciones.
- Footer de confidencialidad y versión V5.3.
- Primera página destaca recomendación preliminar, confianza y racionalidad.

## Límites preservados

- No se automatiza contratación ni descarte.
- La recomendación es preliminar y requiere validación humana.
- No se cambian scores ni respuestas existentes.
- El certificado e informe siguen en Storage privado.

