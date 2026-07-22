---
document_id: EEES-FOUNDATION-02
title: Engineering Principles
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Principios de ingenieria

## Reglas base

- Preferir cambios incrementales con frontera clara.
- Mantener servicios de dominio como punto unico de llamadas a Supabase.
- Evitar logica de permisos en componentes.
- Usar helpers compartidos para errores, fechas, RUT, query keys y labels de negocio.
- No editar migraciones historicas aplicadas; usar forward-fix versionado.
- Toda deuda grande debe quedar en auditoria con accion, esfuerzo y prueba requerida.

## Patrones prohibidos

- Service role en navegador.
- Permisos por email hardcodeado.
- Duplicar reglas frontend/backend sin guardrail.
- Esconder errores operativos bajo mensajes genericos cuando el usuario necesita accion.
- Refactors masivos mezclados con fixes productivos.
