# Atlas — Gobierno ERP

Status: ACTIVE
Document Type: ACTIVE_POLICY
Owner: Engineering Governance
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: runtime versionado, contratos ejecutables, tests y configuración productiva
Supersedes: afirmaciones documentales no fechadas que contradigan el runtime
Related Controls: EEES, Guardian, RLS, auditorías Supabase, CI
Change Approval: Engineering Governance y dueño del dominio

## Propósito

Atlas se gobierna como un ERP productivo con cambios incrementales, trazables y reversibles. La documentación explica el sistema, pero no puede sustituir migraciones aplicadas, RPCs, RLS, Edge Functions, TypeScript, tests ni configuración activa.

## Jerarquía de autoridad

1. Runtime y contratos ejecutables.
2. Políticas normativas activas.
3. Referencias técnicas vigentes.
4. Evidencia histórica fechada.

Ante una contradicción se inspecciona primero el runtime, se conserva la evidencia y se corrige o etiqueta la documentación. No se modifica el comportamiento para satisfacer un documento antiguo sin evidencia objetiva, aprobación y plan reversible.

## Principios operativos

- Agregar, compatibilizar y validar antes de reemplazar.
- Preservar datos, historial, permisos, RLS, grants, rutas y contratos existentes.
- No usar controles visuales como sustituto de autorización backend.
- No asumir auditoría global cuando la cobertura real es por dominio.
- No cambiar scoring, respuestas, hashes ni metodología Psych sin defecto probado y aprobación explícita.
- Toda afirmación de producción debe indicar su evidencia y fecha.

## Estado de esta normalización

Esta iteración solo normaliza documentación y gobernanza. No cambia runtime, permisos efectivos, datos, migraciones aplicadas, integraciones, feature flags ni despliegues productivos.
