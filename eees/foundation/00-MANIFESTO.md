---
document_id: EEES-FOUNDATION-00
title: Manifesto EEES
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Manifesto

## Proposito

Establecer una norma ejecutable para mantener el ERP seguro, auditable y operable mientras crece por dominios.

## Principios

- El backend autoritativo vive en Supabase PostgreSQL, RLS, RPCs y Edge Functions.
- El frontend guia la experiencia, pero no decide permisos criticos.
- Toda integracion externa debe ser idempotente, trazable y recuperable.
- Cada cambio debe cerrar con evidencia: build, auditoria, smoke o razon documentada.
- La deuda historica se clasifica; no se normaliza como patron.

## Clasificacion de evidencia

- CANONICAL: patron permitido y recomendado.
- ACCEPTABLE: valido para contexto acotado.
- LEGACY: existe por historia, no debe expandirse.
- TECH_DEBT: deuda conocida con plan o backlog.
- SECURITY_RISK: requiere mitigacion y gate.
- UNKNOWN: requiere auditoria antes de reutilizar.
