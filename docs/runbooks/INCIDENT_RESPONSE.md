# Atlas — Respuesta a incidentes

Status: ACTIVE
Document Type: ACTIVE_RUNBOOK
Owner: Operations + Security
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: EEES playbooks, logs de dominio y runtime
Supersedes: respuesta informal sin clasificación
Related Controls: RLS-PERMISSION-INCIDENT, SECURITY-INCIDENT, INTEGRATION-OUTAGE
Change Approval: Operations + Security

## Secuencia

Detectar y preservar evidencia → clasificar impacto → contener sin ampliar permisos → identificar dominio/actor/recurso → consultar logs y runtime → mitigar reversiblemente → verificar usuarios afectados → registrar causa raíz y acciones preventivas.

## Casos críticos

Un bypass de permisos, exposición de datos, fallo de RLS, secreto expuesto, corrupción de datos o caída de BUK requiere detener cambios no relacionados y activar el playbook correspondiente. No se elimina evidencia ni se modifica historial para ocultar el incidente.

## Comunicación

Separar hechos confirmados, hipótesis y datos faltantes. Legal/Compliance participa cuando hay datos personales, sensibles, incidentes notificables o transferencias internacionales.
