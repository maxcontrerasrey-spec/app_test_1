# Rollback Psych AI

## Apagado inmediato

Configurar:

```text
PSYCH_AI_ENABLED=false
```

Con esto no se invoca Groq; el flujo queda en Mock/fallback.

## Rollback frontend

Ocultar acciones `Generar IA` y `Revisar IA` en `PsycholaboralManagementPage.tsx`. El módulo psicolaboral base sigue operando con resultados y certificados.

## Rollback Edge

Revertir despliegue de `psycholaboral-assessment` y `generate-psycholaboral-certificate` al commit anterior. Las tablas IA pueden permanecer sin afectar scoring.

## Rollback SQL

No eliminar tablas en caliente si ya existe evidencia profesional. Para desactivar:

- Revocar acciones de generación/revisión si fuese necesario.
- Mantener datos para auditoría.
- Solo eliminar tablas privadas en una migración explícita y aprobada.
