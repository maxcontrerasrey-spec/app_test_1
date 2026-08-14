# Psych AI GPT-5 mini migration report

## Decisión

Se implementa arquitectura GPT-5 mini dual-pass:

```text
Analyst → Reviewer → hard checks ERP → revisión profesional
```

## Ajustes frente al prompt V4

- No se relajan los bloqueos de seguridad ya existentes.
- No se modifican scoring, respuestas ni historial.
- No se crean columnas nuevas en esta fase para evitar una migración de datos sensible; la trazabilidad del pipeline queda en flags y runs existentes.
- El PDF/UI siguen usando la salida final compatible con el schema actual.

## Rollback

El rollback operativo sigue siendo:

- `PSYCH_AI_ENABLED=false`, o
- retirar `OPENAI_API_KEY`.

En ambos casos el sistema no usa proveedor externo y evita publicar una interpretación IA falsa.
