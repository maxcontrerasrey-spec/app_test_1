# Atlas — Gestión del cambio

Status: ACTIVE
Document Type: ACTIVE_POLICY
Owner: Engineering Governance
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: Git, migraciones, CI, Guardian, runbooks y evidencia productiva
Supersedes: cambios manuales sin trazabilidad
Related Controls: deployment, rollback, release checklist, migration audits
Change Approval: dueño del dominio y responsables de seguridad/operación

## Precondiciones

Cada cambio declara alcance, riesgo, pre-check, impacto de datos, impacto de permisos, downtime esperado, validación y procedimiento de rollback. Las migraciones históricas no se editan.

## Secuencia

Inspeccionar contratos reales → documentar plan → cambiar de forma incremental → ejecutar tests y auditorías → revisar diff → aplicar solo el alcance autorizado → verificar producción → registrar evidencia.

## SQL y runtime

Usar migraciones forward-only. Evitar DROP CASCADE, TRUNCATE, borrados, recreación de tablas y cambios incompatibles. Antes de aplicar SQL, ejecutar audit:migrations y dry-run vinculado; si aparece una operación destructiva inesperada, detenerse.

## Criterio de cierre

No se declara completado un cambio sin evidencia downstream. Si el cambio puede resolverse solo en documentación, no se toca runtime.
